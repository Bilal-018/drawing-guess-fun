// server.js
const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const rooms = new Map(); // roomCode → { players: [], hostId: null }

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res);
    });

    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        socket.on("get-players", (roomCode) => {
            const room = rooms.get(roomCode);
            if (room) {
                socket.emit("players-update", room.players);
            }
        });

        // Real-time drawing
        socket.on("draw", (data) => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            // Send to everyone in the room except the sender
            socket.to(roomCode).emit("draw", data);
        });

        // Clear canvas
        socket.on("clear-canvas", () => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            socket.to(roomCode).emit("clear-canvas");
        });

        /// Create room
        socket.on("create-room", (playerName, callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            rooms.set(roomCode, {
                players: [{ id: socket.id, name: playerName, score: 0 }],
                hostId: socket.id,
            });

            socket.join(roomCode);
            socket.roomCode = roomCode;

            callback({ roomCode, success: true });
            // No need to emit players-update here yet
        });

        // Join room
        socket.on("join-room", ({ roomCode, playerName }, callback) => {
            const room = rooms.get(roomCode);

            if (!room) {
                return callback({ success: false, message: "Room not found" });
            }

            // Prevent the same player from being added multiple times
            const alreadyInRoom = room.players.some((p) => p.id === socket.id);
            if (alreadyInRoom) {
                socket.join(roomCode);
                socket.roomCode = roomCode;
                return callback({ success: true });
            }

            room.players.push({ id: socket.id, name: playerName, score: 0 });
            socket.join(roomCode);
            socket.roomCode = roomCode;

            callback({ success: true });
            io.to(roomCode).emit("players-update", room.players);
        });

        // Disconnect
        socket.on("disconnect", () => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            const room = rooms.get(roomCode);
            if (!room) return;

            room.players = room.players.filter((p) => p.id !== socket.id);

            if (room.players.length === 0) {
                rooms.delete(roomCode);
            } else {
                // If host left, give host to someone else
                if (room.hostId === socket.id) {
                    room.hostId = room.players[0].id;
                }
                io.to(roomCode).emit("players-update", room.players);
            }
        });
    });

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});