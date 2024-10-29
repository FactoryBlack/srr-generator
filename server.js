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

function broadcastPublicRooms() {
    const publicRooms = Object.entries(rooms)
        .filter(([_, roomData]) => roomData.public)
        .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }));
    io.emit('activeRooms', publicRooms);
    console.log("Broadcasting public rooms:", publicRooms); // Added context for debugging
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    broadcastPublicRooms();

    socket.on('joinRoom', ({ roomID, isPublic, teamSize }) => {
        const room = rooms[roomID] || { users: {}, banList: [] };

        if (room.banList.includes(socket.id)) {
            socket.emit('joinDenied', 'You have been banned from this room.');
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
        }

        rooms[roomID].users[socket.id] = { name: "Unnamed", afkq: false };

        socket.emit('creatorStatus', { isCreator: socket.id === rooms[roomID].creator });
        io.to(roomID).emit('updateNames', Object.values(rooms[roomID].users));
    });

    socket.on('submitName', ({ roomID, name, afkq }) => {
        if (rooms[roomID]) {
            rooms[roomID].users[socket.id] = { name, afkq };
            io.to(roomID).emit('updateNames', Object.values(rooms[roomID].users));
        }
    });

    socket.on('kickUser', ({ roomID, userID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator) {
            room.banList.push(userID);
            io.to(userID).emit('kicked', 'You have been kicked from the room.');
            delete room.users[userID];
            io.to(roomID).emit('updateNames', Object.values(room.users));
        }
    });

    // Helper function to shuffle an array
    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

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
            console.log(`Teams generated for room ${roomID}:`, teams); // For logging each generation
        }
    });

    socket.on('disconnect', () => {
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.creator === socket.id) {
                io.to(roomID).emit('roomClosed');
                delete rooms[roomID];
                broadcastPublicRooms();
            } else if (room.users[socket.id]) {
                delete room.users[socket.id];
                io.to(roomID).emit('updateNames', Object.values(room.users));
            }
        }
    });
});

server.listen(8888, () => {
    console.log('Server is running on port 8888');
});
