"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket";
import Canvas from "@/components/Canvas";

interface Player {
  id: string;
  name: string;
  score: number;
}

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params.code as string;
  const playerName = searchParams.get("name") || "Player";

  const [players, setPlayers] = useState<Player[]>([]);
  const [connected, setConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  // Game state
  const [gameState, setGameState] = useState("waiting");
  const [currentDrawerId, setCurrentDrawerId] = useState<string | null>(null);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(80);
  const [hostId, setHostId] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [maxRounds, setMaxRounds] = useState(3);
  const [lastCorrect, setLastCorrect] = useState<string | null>(null);
  const [revealedWord, setRevealedWord] = useState<string | null>(null);
  const [guess, setGuess] = useState("");

  const isDrawer = socketId !== null && socketId === currentDrawerId;
  const isHost = socketId !== null && socketId === hostId;

  useEffect(() => {
    const socket = getSocket();

    // Make sure we are connected
    if (!socket.connected) {
      socket.connect();
    }

    // Set socket id as soon as possible
    if (socket.id) {
      setSocketId(socket.id);
    }

    const onConnect = () => {
      setSocketId(socket.id ?? null);
    };

    const onPlayersUpdate = (updated: Player[]) => {
      setPlayers(updated);
      setConnected(true);
    };

    const onGameState = (state: any) => {
      setGameState(state.gameState || "waiting");
      setCurrentDrawerId(state.currentDrawerId || null);
      setTimeLeft(state.timeLeft ?? 80);
      setHostId(state.hostId || null);
      setRound(state.round || 0);
      setMaxRounds(state.maxRounds || 3);

      if (state.wordOptions && state.wordOptions.length > 0) {
        setWordOptions(state.wordOptions);
      }
    };

    const onWordOptions = (options: string[]) => {
      setWordOptions(options);
    };

    const onTimer = (time: number) => {
      setTimeLeft(time);
    };

    const onCorrectGuess = (data: any) => {
      setLastCorrect(`${data.playerName} guessed the word!`);
      setTimeout(() => setLastCorrect(null), 3000);
    };

    const onRoundEnd = (data: any) => {
      setRevealedWord(data.word);
      setTimeout(() => setRevealedWord(null), 4000);
    };

    socket.on("connect", onConnect);
    socket.on("players-update", onPlayersUpdate);
    socket.on("game-state", onGameState);
    socket.on("word-options", onWordOptions);
    socket.on("timer", onTimer);
    socket.on("correct-guess", onCorrectGuess);
    socket.on("round-end", onRoundEnd);

    // Join the room
    socket.emit("join-room", { roomCode, playerName }, (res: any) => {
      if (!res?.success) {
        alert(res?.message || "Room not found");
        window.location.href = "/";
      } else {
        socket.emit("get-players", roomCode);
      }
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("players-update", onPlayersUpdate);
      socket.off("game-state", onGameState);
      socket.off("word-options", onWordOptions);
      socket.off("timer", onTimer);
      socket.off("correct-guess", onCorrectGuess);
      socket.off("round-end", onRoundEnd);
    };
  }, [roomCode, playerName]);

  const startGame = () => {
    getSocket().emit("start-game");
  };

  const chooseWord = (word: string) => {
    getSocket().emit("choose-word", word);
    setWordOptions([]);
  };

  const sendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    getSocket().emit("guess", guess);
    setGuess("");
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Room: {roomCode}</h1>
            <p className="text-zinc-400 text-sm">
              Round {round}/{maxRounds} · {connected ? "● Connected" : "Connecting..."}
            </p>
          </div>

          {gameState === "drawing" && (
            <div className="text-3xl font-bold text-indigo-400">{timeLeft}s</div>
          )}
        </div>

        {/* Debug info - temporary */}
        <div className="mb-4 text-xs text-zinc-500">
          My ID: {socketId || "not set"} | Host ID: {hostId || "not set"} | I am host: {isHost ? "YES" : "NO"}
        </div>

        {/* Messages */}
        {lastCorrect && (
          <div className="mb-4 p-3 bg-green-900/50 border border-green-700 rounded-xl text-center">
            {lastCorrect}
          </div>
        )}
        {revealedWord && (
          <div className="mb-4 p-3 bg-indigo-900/50 border border-indigo-700 rounded-xl text-center">
            The word was: <strong>{revealedWord}</strong>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-3">Players ({players.length})</h2>
              <div className="space-y-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className={`flex justify-between items-center px-3 py-2 rounded-xl text-sm ${
                      p.id === currentDrawerId
                        ? "bg-indigo-900/50 border border-indigo-700"
                        : "bg-zinc-800"
                    }`}
                  >
                    <span>
                      {p.name}
                      {p.id === currentDrawerId && " ✏️"}
                      {p.id === hostId && " 👑"}
                    </span>
                    <span className="text-zinc-400">{p.score}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Start Game Button */}
            {isHost && gameState === "waiting" && players.length >= 2 && (
              <button
                onClick={startGame}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium transition"
              >
                Start Game
              </button>
            )}

            {gameState === "waiting" && players.length < 2 && (
              <p className="text-sm text-zinc-500 text-center">
                Need at least 2 players to start
              </p>
            )}

            {gameState === "waiting" && players.length >= 2 && !isHost && (
              <p className="text-sm text-zinc-500 text-center">
                Waiting for host to start the game...
              </p>
            )}
          </div>

          {/* Main Area */}
          <div className="lg:col-span-3 space-y-4">
            {/* Word Selection */}
            {gameState === "choosing" && isDrawer && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center">
                <h3 className="text-lg mb-4">Choose a word to draw:</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {wordOptions.map((word) => (
                    <button
                      key={word}
                      onClick={() => chooseWord(word)}
                      className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {gameState === "choosing" && !isDrawer && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center text-zinc-400">
                Waiting for drawer to choose a word...
              </div>
            )}

            {/* Canvas */}
            {(gameState === "drawing" || gameState === "roundEnd") && (
              <Canvas canDraw={isDrawer && gameState === "drawing"} />
            )}

            {/* Guess Input */}
            {gameState === "drawing" && !isDrawer && (
              <form onSubmit={sendGuess} className="flex gap-2">
                <input
                  type="text"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="Type your guess..."
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 focus:outline-none focus:border-indigo-500"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium"
                >
                  Guess
                </button>
              </form>
            )}

            {gameState === "waiting" && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                {players.length < 2
                  ? "Waiting for more players..."
                  : isHost
                  ? "You are the host. Click Start Game when ready."
                  : "Waiting for host to start the game..."}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}