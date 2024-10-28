const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store room data in memory
const rooms = {};

// Serve static files
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected');

    // Join room
    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        if (!rooms[roomID]) {
            rooms[roomID] = [];
        }
        socket.emit('updateNames', rooms[roomID]); // Send current names to new user
    });

    // Handle name submission
    socket.on('submitName', (data) => {
        const { roomID, name } = data;
        if (rooms[roomID]) {
            rooms[roomID].push(name);
            io.to(roomID).emit('updateNames', rooms[roomID]); // Broadcast new names to room
        }
    });

    // Handle disconnects
    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

const PORT = process.env.PORT || 8888;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
