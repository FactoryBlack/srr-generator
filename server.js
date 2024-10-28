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

        if (!rooms[roomID]) {
            // Initialize room if it doesn't exist
            rooms[roomID] = {
                users: {}, // Store user info with name and AFKQ status
                public: isPublic,
                teamSize: teamSize || 2,
                creator: socket.id
            };
            console.log(`Room created: ${roomID} (Public: ${isPublic}, Team Size: ${rooms[roomID].teamSize})`);

            // Notify all users of the updated public room list
            io.emit('activeRooms', Object.entries(rooms)
                .filter(([_, roomData]) => roomData.public)
                .map(([roomID, roomData]) => ({ roomID, teamSize: roomData.teamSize }))
            );
        } else {
            isCreator = false;
        }

        // Add user as "Unnamed" upon joining
        rooms[roomID].users[socket.id] = { name: "Unnamed", afkq: false };

        // Send creator status and initial member count to client
        socket.emit('creatorStatus', { isCreator });
        updateMemberCount(roomID);
    });

    // Handle name submission or update with AFKQ Tool status
    socket.on('submitName', ({ roomID, name, afkq }) => {
        const room = rooms[roomID];
        if (room) {
            // Update user's name and AFKQ status
            room.users[socket.id] = { name, afkq };

            // Broadcast the updated list to all users in the room
            io.to(roomID).emit('updateNames', Object.values(room.users));
            updateMemberCount(roomID); // Update member count
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
        }
    }

    // Handle team generation request (only the creator can generate teams)
    socket.on('generateTeams', ({ roomID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator) { // Only the creator can generate teams
            const teams = generateTeams(Object.values(room.users).map(user => user.name), room.teamSize);
            io.to(roomID).emit('displayTeams', teams);
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('A user disconnected');
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room.users[socket.id]) {
                delete room.users[socket.id];
                io.to(roomID).emit('updateNames', Object.values(room.users));
                updateMemberCount(roomID); // Update member count on disconnect
            }
        }
    });
});

// Start the server
const PORT = process.env.PORT || 8888;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
