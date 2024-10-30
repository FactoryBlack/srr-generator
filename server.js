const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

/* Function to Broadcast Public Rooms */
function broadcastPublicRooms() {
    const publicRooms = Object.entries(rooms)
        .filter(([_, roomData]) => roomData.public)
        .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }));
    io.emit('activeRooms', publicRooms);
    console.log("Broadcasting public rooms:", publicRooms);
}

/* Function to Update Member Count */
function updateMemberCount(roomID) {
    const room = rooms[roomID];
    if (room) {
        const total = Object.keys(room.users).length;
        const named = Object.values(room.users).filter(user => user.name !== "Unnamed").length;
        const unnamed = total - named;
        io.to(roomID).emit('memberCount', { total, named, unnamed });
    }
}

/* Socket.io Connection Handler */
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    broadcastPublicRooms();

    /* Handle Joining or Creating a Room */
    socket.on('joinRoom', ({ roomID, isPublic, teamSize }) => {
        const room = rooms[roomID] || { users: {}, banList: [] };

        if (room.banList.includes(socket.id)) {
            socket.emit('joinDenied', 'You have been banned from this room.');
            console.log(`User ${socket.id} denied access to room ${roomID}`);
            return;
        }

        socket.join(roomID);

        if (!rooms[roomID]) {
            rooms[roomID] = {
                users: {},
                public: isPublic,
                teamSize: teamSize || 2,
                creator: socket.id,
                banList: []
            };
            broadcastPublicRooms();
            console.log(`Room created: ${roomID} by ${socket.id}`);
        }

        rooms[roomID].users[socket.id] = { id: socket.id, name: "Unnamed", afkq: false };

        socket.emit('creatorStatus', { isCreator: socket.id === rooms[roomID].creator });
        io.to(roomID).emit('updateNames', Object.values(rooms[roomID].users));
        updateMemberCount(roomID);

        console.log(`User ${socket.id} joined room ${roomID}`);
    });

    /* Handle Name Submission */
    socket.on('submitName', ({ roomID, name, afkq }) => {
        const room = rooms[roomID];
        if (room && room.users[socket.id]) {
            room.users[socket.id] = { id: socket.id, name, afkq };
            io.to(roomID).emit('updateNames', Object.values(room.users));
            updateMemberCount(roomID);
            console.log(`User ${socket.id} submitted name '${name}' in room ${roomID}`);
        }
    });

    /* Handle Adding Name Manually */
    socket.on('addName', ({ roomID, name }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator) {
            // Check for duplicate names
            const existingNames = Object.values(room.users).map(user => user.name.toLowerCase());
            if (existingNames.includes(name.toLowerCase())) {
                socket.emit('joinDenied', 'This name already exists in the room.');
                console.log(`Duplicate name '${name}' not added to room ${roomID}`);
                return;
            }

            // Generate a unique ID for the new user
            const newUserId = `manual-${Date.now()}-${Math.random()}`;
            room.users[newUserId] = { id: newUserId, name, afkq: false, manual: true };
            io.to(roomID).emit('updateNames', Object.values(room.users));
            updateMemberCount(roomID);
            console.log(`Creator added name '${name}' to room ${roomID}`);
        }
    });

    /* Handle Kicking a User */
    socket.on('kickUser', ({ roomID, userID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator && room.users[userID]) {
            // If the user is connected via socket, disconnect them
            if (io.sockets.sockets.get(userID)) {
                room.banList.push(userID);
                io.to(userID).emit('kicked', 'You have been kicked from the room.');
                io.sockets.sockets.get(userID).leave(roomID);
                console.log(`User ${userID} kicked and banned from room ${roomID}`);
            } else {
                console.log(`Manual user '${room.users[userID].name}' removed from room ${roomID}`);
            }
            delete room.users[userID];
            io.to(roomID).emit('updateNames', Object.values(room.users));
            updateMemberCount(roomID);
        }
    });

    /* Helper Function to Shuffle an Array */
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /* Handle Team Generation */
    socket.on('generateTeams', ({ roomID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator) {
            let users = Object.values(room.users).map(user => user.name);

            // Shuffle the users array before generating teams
            users = shuffle(users);

            const teams = [];
            while (users.length) {
                teams.push(users.splice(0, room.teamSize));
            }

            io.to(roomID).emit('displayTeams', teams);
            console.log(`Teams generated for room ${roomID}:`, teams);
        }
    });

    /* Handle User Disconnection */
    socket.on('disconnect', () => {
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.creator === socket.id) {
                io.to(roomID).emit('roomClosed');
                delete rooms[roomID];
                broadcastPublicRooms();
                console.log(`Room ${roomID} closed by creator ${socket.id}`);
            } else if (room.users[socket.id]) {
                delete room.users[socket.id];
                io.to(roomID).emit('updateNames', Object.values(room.users));
                updateMemberCount(roomID);
                console.log(`User ${socket.id} disconnected from room ${roomID}`);
            }
        }
    });
});

server.listen(8888, () => {
    console.log('Server is running on port 8888');
});
