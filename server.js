const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const rooms = new Map();

function getRandomWords(count = 3) {
    const WORDS = [
        "elephant", "guitar", "pizza", "astronaut", "bicycle",
        "rainbow", "castle", "dragon", "umbrella", "kangaroo",
        "lighthouse", "sandwich", "volcano", "penguin", "treasure",
        "butterfly", "spaceship", "octopus", "mountain", "wizard",
        "hamburger", "tornado", "mermaid", "robot", "cactus",
        "firetruck", "jellyfish", "skyscraper", "vampire", "backpack",
        "helicopter", "pineapple", "skeleton", "trampoline", "dolphin",
        "mushroom", "telescope", "zombie", "hotdog", "pyramid",
        "scooter", "alligator", "cupcake", "ninja", "sailboat",
        "avocado", "firefighter", "snowman", "toothbrush", "dinosaur"
    ];
    const shuffled = [...WORDS].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

app.prepare().then(() => {
    const httpServer = createServer((req, res) => {
        handle(req, res);
    });

    const io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
        console.log("User connected:", socket.id);

        // ========== ROOM SYSTEM ==========
        socket.on("create-room", (playerName, callback) => {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            rooms.set(roomCode, {
                code: roomCode,                 // ← added
                players: [{ id: socket.id, name: playerName, score: 0 }],
                hostId: socket.id,
                gameState: "waiting",
                currentDrawerId: null,
                currentWord: null,
                wordOptions: [],
                round: 0,
                maxRounds: 3,
                timer: null,
                timeLeft: 80,
            });

            socket.join(roomCode);
            socket.roomCode = roomCode;

            callback({ roomCode, success: true });
        });

        socket.on("join-room", ({ roomCode, playerName }, callback) => {
            const room = rooms.get(roomCode);
            if (!room) return callback({ success: false, message: "Room not found" });

            const alreadyInRoom = room.players.some((p) => p.id === socket.id);
            if (!alreadyInRoom) {
                room.players.push({ id: socket.id, name: playerName, score: 0 });
            }

            socket.join(roomCode);
            socket.roomCode = roomCode;

            callback({ success: true });
            io.to(roomCode).emit("players-update", room.players);
            io.to(roomCode).emit("game-state", getPublicState(room));
        });

        socket.on("get-players", (roomCode) => {
            const room = rooms.get(roomCode);
            if (room) {
                socket.emit("players-update", room.players);
                socket.emit("game-state", getPublicState(room));
            }
        });

        // ========== GAME LOGIC ==========
        socket.on("start-game", () => {
            const room = rooms.get(socket.roomCode);
            if (!room || room.hostId !== socket.id) return;
            if (room.players.length < 2) return;

            room.round = 0;
            room.players.forEach((p) => (p.score = 0));
            startNewRound(room);
        });

        socket.on("choose-word", (word) => {
            const room = rooms.get(socket.roomCode);
            if (!room || room.currentDrawerId !== socket.id) return;

            room.currentWord = word;
            room.gameState = "drawing";
            room.timeLeft = 80;

            io.to(room.roomCode || socket.roomCode).emit("game-state", getPublicState(room));
            io.to(socket.roomCode).emit("clear-canvas");

            // Start timer
            clearInterval(room.timer);
            room.timer = setInterval(() => {
                room.timeLeft--;
                io.to(socket.roomCode).emit("timer", room.timeLeft);

                if (room.timeLeft <= 0) {
                    endRound(room);
                }
            }, 1000);
        });

        socket.on("guess", (guess) => {
            const room = rooms.get(socket.roomCode);
            if (!room || room.gameState !== "drawing") return;
            if (socket.id === room.currentDrawerId) return; // drawer can't guess

            const normalizedGuess = guess.trim().toLowerCase();
            const normalizedWord = room.currentWord?.toLowerCase();

            if (normalizedGuess === normalizedWord) {
                // Correct guess
                const player = room.players.find((p) => p.id === socket.id);
                const drawer = room.players.find((p) => p.id === room.currentDrawerId);

                if (player) player.score += 100;
                if (drawer) drawer.score += 50;

                io.to(socket.roomCode).emit("correct-guess", {
                    playerName: player?.name,
                    word: room.currentWord,
                });

                io.to(socket.roomCode).emit("players-update", room.players);
                endRound(room);
            }
        });

        // Drawing events
        socket.on("draw", (data) => {
            if (!socket.roomCode) return;
            socket.to(socket.roomCode).emit("draw", data);
        });

        socket.on("clear-canvas", () => {
            if (!socket.roomCode) return;
            socket.to(socket.roomCode).emit("clear-canvas");
        });

        // Disconnect
        socket.on("disconnect", () => {
            const roomCode = socket.roomCode;
            if (!roomCode) return;

            const room = rooms.get(roomCode);
            if (!room) return;

            room.players = room.players.filter((p) => p.id !== socket.id);

            if (room.players.length === 0) {
                clearInterval(room.timer);
                rooms.delete(roomCode);
            } else {
                if (room.hostId === socket.id) {
                    room.hostId = room.players[0].id;
                }
                if (room.currentDrawerId === socket.id && room.gameState !== "waiting") {
                    endRound(room);
                }
                io.to(roomCode).emit("players-update", room.players);
                io.to(roomCode).emit("game-state", getPublicState(room));
            }
        });
    });

    function getPublicState(room) {
        return {
            gameState: room.gameState,
            currentDrawerId: room.currentDrawerId,
            wordOptions: room.gameState === "choosing" ? room.wordOptions : [],
            round: room.round,
            maxRounds: room.maxRounds,
            timeLeft: room.timeLeft,
            hostId: room.hostId,
        };
    }

    function startNewRound(room) {
        clearInterval(room.timer);
        room.round++;

        if (room.round > room.maxRounds) {
            room.gameState = "waiting";
            room.currentDrawerId = null;
            room.currentWord = null;
            io.to([...rooms.keys()].find(code => rooms.get(code) === room)).emit("game-state", getPublicState(room));
            io.to([...rooms.keys()].find(code => rooms.get(code) === room)).emit("game-over", room.players);
            return;
        }

        // Choose next drawer (rotate)
        const currentIndex = room.players.findIndex((p) => p.id === room.currentDrawerId);
        const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % room.players.length;
        room.currentDrawerId = room.players[nextIndex].id;

        room.gameState = "choosing";
        room.wordOptions = getRandomWords(3);
        room.currentWord = null;
        room.timeLeft = 80;

        const roomCode = [...rooms.entries()].find(([_, r]) => r === room)?.[0];
        if (roomCode) {
            io.to(roomCode).emit("game-state", {
                ...getPublicState(room),
                wordOptions: room.wordOptions,
            });
            // Send word options only to the drawer
            io.to(room.currentDrawerId).emit("word-options", room.wordOptions);
        }
    }

    function endRound(room) {
        clearInterval(room.timer);
        room.gameState = "roundEnd";

        const roomCode = [...rooms.entries()].find(([_, r]) => r === room)?.[0];
        if (roomCode) {
            io.to(roomCode).emit("round-end", {
                word: room.currentWord,
                players: room.players,
            });
            io.to(roomCode).emit("game-state", getPublicState(room));

            // Start next round after 4 seconds
            setTimeout(() => {
                startNewRound(room);
            }, 4000);
        }
    }

    const PORT = process.env.PORT || 3000;
    httpServer.listen(PORT, () => {
        console.log(`> Ready on http://localhost:${PORT}`);
    });
});