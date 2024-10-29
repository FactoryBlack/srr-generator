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
        const room = rooms[roomID];
        const userIP = socket.handshake.address; // Use IP as an identifier

        // Ensure the room has a ban list even if it's newly created
        if (!room) {
            rooms[roomID] = {
                users: {},
                public: isPublic,
                teamSize: teamSize || 2,
                creator: socket.id,
                banList: []
            };
        }

        // Check if the user is banned based on their IP address or another unique identifier
        if (rooms[roomID].banList.includes(userIP)) {
            socket.emit('joinDenied', 'You have been banned from this room.');
            console.log(`User with IP ${userIP} attempted to join room ${roomID} but is banned.`);
            return;
        }

        socket.join(roomID);

        if (!room.creator) {
            rooms[roomID].creator = socket.id; // Assign creator if none exists
        } else if (room.creator !== socket.id) {
            // Prevent anyone else from taking over the room
            socket.emit('joinDenied', 'This room already has a creator.');
            return;
        }

        rooms[roomID].users[socket.id] = { name: "Unnamed", afkq: false };

        // Emit the updated list of public rooms and the creator status
        broadcastPublicRooms();
        socket.emit('creatorStatus', { isCreator: room.creator === socket.id });
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

    // Server-side: Handle the kickUser event
    socket.on('kickUser', ({ roomID, userID }) => {
        const room = rooms[roomID];
        const userSocket = io.sockets.sockets.get(userID);

        if (room && socket.id === room.creator && userSocket) {
            const userIP = userSocket.handshake.address; // Identify the user by IP

            // Add the user's IP to the ban list
            room.banList.push(userIP);
            userSocket.emit('kicked', 'You have been kicked from the room.');

            // Remove the user from the room
            delete room.users[userID];
            userSocket.leave(roomID); // Disconnect them from the room
            io.to(roomID).emit('updateNames', Object.entries(room.users).map(([id, user]) => ({ id, ...user })));
            updateMemberCount(roomID);

            console.log(`User with IP ${userIP} kicked and banned from room ${roomID}`);
        } else {
            console.log("Kick failed: Either not the creator or user does not exist in the room.");
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
        console.log('A user disconnected');
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
                io.to(roomID).emit('updateNames', Object.entries(room.users).map(([id, user]) => ({ id, ...user })));
                updateMemberCount(roomID);
            }
        }
    });
});

// Start the server
const PORT = process.env.PORT || 8888;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
