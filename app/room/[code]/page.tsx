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

  useEffect(() => {
    const socket = getSocket();

    if (!socket.connected) {
      socket.connect();
    }

    const onPlayersUpdate = (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
      setConnected(true);
    };

    socket.on("players-update", onPlayersUpdate);

    socket.emit(
      "join-room",
      { roomCode, playerName },
      (res: any) => {
        if (!res.success) {
          alert(res.message || "Room not found");
          window.location.href = "/";
        } else {
          socket.emit("get-players", roomCode);
        }
      }
    );

    return () => {
      socket.off("players-update", onPlayersUpdate);
    };
  }, [roomCode, playerName]);

  return (
    <main className="min-h-screen bg-zinc-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Room: {roomCode}</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Share this code with friends
            </p>
          </div>
          <div className="text-sm">
            {connected ? (
              <span className="text-green-400">● Connected</span>
            ) : (
              <span className="text-yellow-400">Connecting...</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Players List */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sticky top-4">
              <h2 className="text-lg font-semibold mb-4">
                Players ({players.length})
              </h2>

              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-zinc-800 rounded-xl px-3 py-2.5"
                  >
                    <span className="font-medium text-sm">{player.name}</span>
                    <span className="text-zinc-400 text-sm">{player.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="lg:col-span-3">
            <Canvas />
          </div>
        </div>
      </div>
    </main>
  );
}