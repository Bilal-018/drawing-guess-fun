"use client";

import { useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

interface Point {
  x: number;
  y: number;
}

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);

  const socket = getSocket();

  // Draw a line on the canvas
  const drawLine = (
    start: Point,
    end: Point,
    strokeColor: string,
    size: number,
    context?: CanvasRenderingContext2D
  ) => {
    const ctx = context || canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 500;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // Listen for drawings from other players
    const handleDraw = (data: {
      start: Point;
      end: Point;
      color: string;
      size: number;
    }) => {
      drawLine(data.start, data.end, data.color, data.size, ctx);
    };

    const handleClear = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("draw", handleDraw);
    socket.on("clear-canvas", handleClear);

    return () => {
      socket.off("draw", handleDraw);
      socket.off("clear-canvas", handleClear);
      window.removeEventListener("resize", resize);
    };
  }, [socket]);

  // Get position relative to canvas
  const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();

    if ("touches" in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getPoint(e);
    if (point) {
      (canvasRef.current as any).lastPoint = point;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const currentPoint = getPoint(e);
    const lastPoint = (canvasRef.current as any).lastPoint;

    if (!currentPoint || !lastPoint) return;

    // Draw locally
    drawLine(lastPoint, currentPoint, color, brushSize);

    // Send to other players
    socket.emit("draw", {
      start: lastPoint,
      end: currentPoint,
      color,
      size: brushSize,
    });

    (canvasRef.current as any).lastPoint = currentPoint;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      socket.emit("clear-canvas");
    }
  };

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Color:</span>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Size:</span>
          <input
            type="range"
            min="1"
            max="30"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-24"
          />
          <span className="text-sm w-6">{brushSize}</span>
        </div>

        <button
          onClick={clearCanvas}
          className="px-4 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 transition"
        >
          Clear
        </button>
      </div>

      {/* Canvas */}
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair bg-zinc-950"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
}