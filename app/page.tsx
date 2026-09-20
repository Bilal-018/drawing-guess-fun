"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export default function Home() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const socket = getSocket();

  const handleCreate = () => {
    if (!name.trim()) return alert("Please enter your name");

    setIsLoading(true);
    socket.connect();

    socket.emit("create-room", name.trim(), (response: any) => {
      setIsLoading(false);
      if (response.success) {
        router.push(`/room/${response.roomCode}?name=${encodeURIComponent(name)}`);
      }
    });
  };

  const handleJoin = () => {
    if (!name.trim() || !joinCode.trim()) {
      return alert("Please enter name and room code");
    }

    setIsLoading(true);
    socket.connect();

    socket.emit(
      "join-room",
      { roomCode: joinCode.toUpperCase(), playerName: name.trim() },
      (response: any) => {
        setIsLoading(false);
        if (response.success) {
          router.push(`/room/${joinCode.toUpperCase()}?name=${encodeURIComponent(name)}`);
        } else {
          alert(response.message || "Failed to join room");
        }
      }
    );
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-center mb-2">Drawing Game</h1>
        <p className="text-zinc-400 text-center mb-8">Create or join a room</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-indigo-500"
            maxLength={16}
          />

          <button
            onClick={handleCreate}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium transition disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Room"}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-zinc-900 text-zinc-500">or</span>
            </div>
          </div>

          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:border-indigo-500 uppercase"
            maxLength={6}
          />

          <button
            onClick={handleJoin}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 font-medium transition disabled:opacity-50"
          >
            Join Room
          </button>
        </div>
      </div>
    </main>
  );
}