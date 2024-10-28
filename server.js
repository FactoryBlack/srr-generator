const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const rooms = {};

// Serve static files from the root directory
app.use(express.static(__dirname));

// Route to serve index.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Helper function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Helper function to divide names into teams
function generateTeams(names, teamSize) {
    shuffleArray(names);
    const teams = [];
    for (let i = 0; i < names.length; i += teamSize) {
        teams.push(names.slice(i, i + teamSize));
    }
    return teams;
}

// Function to broadcast the updated list of public rooms to all clients
function broadcastPublicRooms() {
    const publicRooms = Object.entries(rooms)
        .filter(([_, roomData]) => roomData.public)
        .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }));
    io.emit('activeRooms', publicRooms);
    console.log("Broadcasting public rooms:", publicRooms);
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Send a list of public rooms to the user on connection
    broadcastPublicRooms();

    socket.on('joinRoom', ({ roomID, isPublic, teamSize }) => {
        console.log(`joinRoom event received from ${socket.id} for room ${roomID}`);

        const room = rooms[roomID];

        // Prevent banned users from joining
        if (room && room.banList && room.banList.includes(socket.id)) {
            socket.emit('joinDenied', 'You have been banned from this room.');
            return;
        }

        socket.join(roomID);

        if (!room) {
            // Initialize room if it doesn't exist
            rooms[roomID] = {
                users: {},
                public: isPublic,
                teamSize: teamSize || 2,
                creator: socket.id,
                banList: []
            };
            console.log(`Room created: ${roomID} (Public: ${isPublic}, Team Size: ${rooms[roomID].teamSize})`);

            // Broadcast the updated list of public rooms
            broadcastPublicRooms();

            // Emit creatorStatus to this user indicating they are the creator
            socket.emit('creatorStatus', { isCreator: true });
        } else {
            // For non-creators joining an existing room
            socket.emit('creatorStatus', { isCreator: false });
        }

        // Add user as "Unnamed" upon joining
        rooms[roomID].users[socket.id] = { name: "Unnamed", afkq: false };
        console.log(`User ${socket.id} joined room ${roomID}`);

        // Emit updated names to everyone in the room
        emitUpdateNames(roomID);
        updateMemberCount(roomID);
    });

    // Handle name submission or update with AFKQ Tool status
    socket.on('submitName', ({ roomID, name, afkq }) => {
        console.log(`submitName event received from ${socket.id} for room ${roomID} with name ${name}`);

        const room = rooms[roomID];
        if (room) {
            room.users[socket.id] = { name, afkq };

            // Broadcast the updated list to all users in the room
            emitUpdateNames(roomID);
            updateMemberCount(roomID);
        }
    });

    // Kick a user from the room
    socket.on('kickUser', ({ roomID, userID }) => {
        console.log(`kickUser event received from ${socket.id} to kick user ${userID} in room ${roomID}`);

        const room = rooms[roomID];
        if (room && socket.id === room.creator && room.users[userID]) {
            // Add the kicked user to the ban list
            room.banList.push(userID);

            // Notify the kicked user
            io.to(userID).emit('kicked', 'You have been kicked from the room.');

            // Remove the user from the room and update the user list
            delete room.users[userID];
            console.log(`User ${userID} was kicked from room ${roomID}`);

            emitUpdateNames(roomID);
            updateMemberCount(roomID);
        }
    });

    // Function to update and broadcast member count
    function updateMemberCount(roomID) {
        const room = rooms[roomID];
        if (room) {
            const totalMembers = Object.keys(room.users).length;
            const namedMembers = Object.values(room.users).filter(user => user.name !== "Unnamed").length;
            const unnamedMembers = totalMembers - namedMembers;
            io.to(roomID).emit('memberCount', { total: totalMembers, named: namedMembers, unnamed: unnamedMembers });
            console.log(`Member count updated for room ${roomID}:`, { totalMembers, namedMembers, unnamedMembers });
        }
    }

    // Function to emit updated names to the room
    function emitUpdateNames(roomID) {
        const room = rooms[roomID];
        if (room) {
            const userList = Object.entries(room.users).map(([id, user]) => ({ id, ...user }));
            io.to(roomID).emit('updateNames', userList);
            console.log(`Emitting updateNames for room ${roomID}:`, userList);
        }
    }

    // Handle team generation request (only the creator can generate teams)
    socket.on('generateTeams', ({ roomID }) => {
        console.log(`generateTeams event received from ${socket.id} for room ${roomID}`);

        const room = rooms[roomID];
        if (room && socket.id === room.creator) { // Only the creator can generate teams
            const teams = generateTeams(Object.values(room.users).map(user => user.name), room.teamSize);
            io.to(roomID).emit('displayTeams', teams);
            console.log(`Teams generated for room ${roomID}:`, teams);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        for (const roomID in rooms) {
            const room = rooms[roomID];

            if (room.creator === socket.id) {
                // Notify users in the room that it has been closed
                io.to(roomID).emit('roomClosed');
                delete rooms[roomID];
                console.log(`Room ${roomID} closed because the creator disconnected.`);
                broadcastPublicRooms();
            } else if (room.users[socket.id]) {
                delete room.users[socket.id];
                emitUpdateNames(roomID);
                updateMemberCount(roomID);
                console.log(`User ${socket.id} removed from room ${roomID} on disconnect.`);
            }
        }
    });
});

// Start the server
const PORT = process.env.PORT || 8888;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
