const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const rooms = {};

app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

function broadcastPublicRooms() {
    const publicRooms = Object.entries(rooms).filter(([_, room]) => room.public)
        .map(([roomID, room]) => ({ roomID, teamSize: room.teamSize }));
    io.emit('activeRooms', publicRooms);
}

io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomID, isPublic, teamSize }) => {
        const room = rooms[roomID] || { users: {}, public: isPublic, teamSize };
        room.users[socket.id] = { id: socket.id, name: "Unnamed", afkq: false };
        rooms[roomID] = room;
        socket.join(roomID);
        broadcastPublicRooms();
        updateMemberCount(roomID);
    });

    socket.on('submitName', ({ roomID, name, afkq }) => {
        const room = rooms[roomID];
        if (room && room.users[socket.id]) {
            room.users[socket.id] = { id: socket.id, name, afkq };
            io.to(roomID).emit('updateNames', Object.values(room.users));
            updateMemberCount(roomID);
        }
    });

    socket.on('generateTeams', ({ roomID }) => {
        const room = rooms[roomID];
        if (room) {
            const users = Object.values(room.users).map(user => user.name);
            const teams = [];
            while (users.length) teams.push(users.splice(0, room.teamSize));
            room.teams = teams;
            io.to(roomID).emit('displayTeams', teams);
        }
    });

    socket.on('disconnect', () => {
        for (const roomID in rooms) {
            const room = rooms[roomID];
            if (room && room.users[socket.id]) {
                delete room.users[socket.id];
                io.to(roomID).emit('updateNames', Object.values(room.users));
                updateMemberCount(roomID);
            }
        }
    });
});

server.listen(8888, () => console.log('Server is running on port 8888'));
