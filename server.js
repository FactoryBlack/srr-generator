const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store room data with visibility, names, and creator details
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

// Handle Socket.IO connections
io.on('connection', (socket) => {
    console.log('A user connected');

    // Send a list of public rooms to the user on connection
    socket.emit('activeRooms', Object.entries(rooms)
        .filter(([_, roomData]) => roomData.public)
        .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }))
    );

    // Join or create a room with visibility and team size settings
    socket.on('joinRoom', ({ roomID, isPublic, teamSize, isCreator }) => {
        socket.join(roomID);

        if (isCreator) {
            // If the user is the creator, initialize the room
            rooms[roomID] = { users: [], public: isPublic, teamSize: teamSize || 2, creator: socket.id };
            console.log(`Room created: ${roomID} (Public: ${isPublic}, Team Size: ${rooms[roomID].teamSize})`);

            // Notify all users of the updated public room list
            io.emit('activeRooms', Object.entries(rooms)
                .filter(([_, roomData]) => roomData.public)
                .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }))
            );
        }

        // Send current names in the room to the user who joined
        socket.emit('updateNames', rooms[roomID].users);

        console.log(`User joined room: ${roomID}`);
    });

    // Handle name submission
    socket.on('submitName', ({ roomID, name }) => {
        if (rooms[roomID]) {
            rooms[roomID].users.push(name);

            // Broadcast the updated list to all users in the room
            io.to(roomID).emit('updateNames', rooms[roomID].users);
        }
    });

    // Handle team generation request
    socket.on('generateTeams', ({ roomID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator) { // Only the creator can generate teams
            const teams = generateTeams(room.users, room.teamSize);

            // Broadcast the teams to all users in the room
            io.to(roomID).emit('displayTeams', teams);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
