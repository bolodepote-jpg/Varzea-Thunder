const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

io.on('connection', (socket) => {
    console.log(`Jogador conectado: ${socket.id}`);

    socket.on('create_room', (tankIndex, callback) => {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        rooms[roomId] = {
            players: [{ id: socket.id, tankIndex, x: 0, z: 0, yaw: 0, tYaw: 0, gPitch: 0, hp: 100 }],
            host: socket.id
        };
        socket.join(roomId);
        socket.roomId = roomId;
        callback({ success: true, roomId });
        console.log(`Sala criada: ${roomId} por ${socket.id}`);
    });

    socket.on('join_room', ({ roomId, tankIndex }, callback) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && rooms[roomId].players.length < 4) {
            rooms[roomId].players.push({ id: socket.id, tankIndex, x: (Math.random() - 0.5) * 20, z: (Math.random() - 0.5) * 20, yaw: 0, tYaw: 0, gPitch: 0, hp: 100 });
            socket.join(roomId);
            socket.roomId = roomId;
            callback({ success: true, players: rooms[roomId].players });
            io.to(roomId).emit('update_players', rooms[roomId].players);
            console.log(`Jogador ${socket.id} entrou na sala ${roomId}`);
        } else {
            callback({ success: false, message: 'Sala cheia, não encontrada ou partida em andamento.' });
        }
    });

    socket.on('player_state', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            const player = rooms[roomId].players.find(p => p.id === socket.id);
            if (player) {
                Object.assign(player, data);
                socket.to(roomId).emit('player_state', data);
            }
        }
    });

    socket.on('fire_shell', (data) => {
        const roomId = socket.roomId;
        if (roomId) {
            socket.to(roomId).emit('fire_shell', { id: socket.id, ...data });
        }
    });

    socket.on('player_hit', (data) => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            io.to(roomId).emit('player_hit', data);
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(p => p.id !== socket.id);
            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
                console.log(`Sala ${roomId} removida (vazia).`);
            } else {
                if (rooms[roomId].host === socket.id) {
                    rooms[roomId].host = rooms[roomId].players[0].id;
                }
                io.to(roomId).emit('update_players', rooms[roomId].players);
            }
        }
        console.log(`Jogador desconectado: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
