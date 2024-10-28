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
}

io.on('connection', (socket) => {
    console.log('A user connected');

    // Send a list of public rooms to the user on connection
    broadcastPublicRooms();

    socket.on('joinRoom', ({ roomID, isPublic, teamSize }) => {
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
                creator: socket.id, // Set creator to the initial user
                banList: [] // Initialize ban list for the room
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
        updateMemberCount(roomID);
    });


    // Handle name submission or update with AFKQ Tool status
    socket.on('submitName', ({ roomID, name, afkq }) => {
        const room = rooms[roomID];
        if (room) {
            room.users[socket.id] = { name, afkq };

            // Broadcast the updated list to all users in the room
            io.to(roomID).emit('updateNames', Object.entries(room.users).map(([id, user]) => ({ id, ...user })));
            updateMemberCount(roomID); // Update member count
        }
    });

    // Kick a user from the room
    socket.on('kickUser', ({ roomID, userID }) => {
        const room = rooms[roomID];
        if (room && socket.id === room.creator && room.users[userID]) {
            // Add the kicked user to the ban list
            room.banList.push(userID);

            // Notify the kicked user
            io.to(userID).emit('kicked', 'You have been kicked from the room.');

            // Remove the user from the room and update the user list
            delete room.users[userID];
            io.to(roomID).emit('updateNames', Object.entries(room.users).map(([id, user]) => ({ id, ...user })));
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
