"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoardNote, BoardStroke } from "@/lib/multiplayer/types";
import { WALL_H, WALL_W, TOOL_WIDTH, stickyPreset, type DrawTool } from "@/lib/board/constants";

function drawStroke(ctx: CanvasRenderingContext2D, stroke: BoardStroke) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = stroke.tool === "marker" ? 0.42 : stroke.tool === "paint" ? 0.92 : 1;
  }
  ctx.stroke();
  ctx.restore();
}

function StickyNote({
  note,
  canDrag,
  onMove,
}: {
  note: BoardNote;
  canDrag: boolean;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const preset = stickyPreset(note.color);
  const dragRef = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);
  const [pos, setPos] = useState({ x: note.x, y: note.y });

  useEffect(() => {
    setPos({ x: note.x, y: note.y });
  }, [note.x, note.y]);

  function onPointerDown(e: React.PointerEvent) {
    if (!canDrag) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    setPos({
      x: Math.max(0, Math.min(WALL_W - 168, dragRef.current.px + dx)),
      y: Math.max(0, Math.min(WALL_H - 168, dragRef.current.py + dy)),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.ox;
    const dy = e.clientY - dragRef.current.oy;
    const x = Math.max(0, Math.min(WALL_W - 168, dragRef.current.px + dx));
    const y = Math.max(0, Math.min(WALL_H - 168, dragRef.current.py + dy));
    dragRef.current = null;
    setPos({ x, y });
    onMove(note.id, x, y);
  }

  return (
    <article
      className="sticky-note"
      style={{
        left: pos.x,
        top: pos.y,
        transform: `rotate(${note.rotation || 0}deg)`,
        backgroundColor: preset.fill,
        boxShadow: `2px 4px 12px ${preset.shadow}, 0 1px 0 ${preset.edge}`,
      }}
    >
      <div
        className="sticky-note__grip"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: canDrag ? "grab" : "default" }}
      >
        <span className="sticky-note__author">{note.authorName}</span>
        <span className="sticky-note__fold" style={{ borderColor: `transparent ${preset.edge} transparent transparent` }} />
      </div>
      <p className="sticky-note__text">{note.text}</p>
    </article>
  );
}

export function BoardWall({
  notes,
  strokes,
  tool,
  color,
  playerId,
  isHost,
  onAddStrokes,
  onMoveNote,
}: {
  notes: BoardNote[];
  strokes: BoardStroke[];
  tool: DrawTool;
  color: string;
  playerId: string;
  isHost: boolean;
  onAddStrokes: (strokes: Omit<BoardStroke, "authorId" | "createdAt">[]) => void;
  onMoveNote: (id: string, x: number, y: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const drawing = useRef<{ points: { x: number; y: number }[]; id: string } | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, WALL_W, WALL_H);
    for (const s of strokes) drawStroke(ctx, s);
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const prevNoteCount = useRef(notes.length);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollLeft = (WALL_W - scroller.clientWidth) / 2;
    scroller.scrollTop = (WALL_H - scroller.clientHeight) / 2;
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || notes.length <= prevNoteCount.current) {
      prevNoteCount.current = notes.length;
      return;
    }
    const newest = notes[0];
    if (newest) {
      scroller.scrollTo({
        left: Math.max(0, newest.x - scroller.clientWidth / 2 + 84),
        top: Math.max(0, newest.y - scroller.clientHeight / 2 + 70),
        behavior: "smooth",
      });
    }
    prevNoteCount.current = notes.length;
  }, [notes]);

  function wallPoint(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onCanvasDown(e: React.PointerEvent) {
    if (tool === "select") return;
    const pt = wallPoint(e);
    drawing.current = { points: [pt], id: crypto.randomUUID() };
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }

  function onCanvasMove(e: React.PointerEvent) {
    if (!drawing.current) return;
    const pt = wallPoint(e);
    const pts = drawing.current.points;
    const last = pts[pts.length - 1];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.5) return;
    pts.push(pt);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || pts.length < 2) return;
    const drawTool = tool === "eraser" ? "eraser" : tool;
    const stroke: BoardStroke = {
      id: drawing.current.id,
      authorId: playerId,
      tool: drawTool as BoardStroke["tool"],
      color: tool === "eraser" ? "#000" : color,
      width: TOOL_WIDTH[tool],
      points: pts.slice(-2),
      createdAt: Date.now(),
    };
    drawStroke(ctx, stroke);
  }

  function onCanvasUp(e: React.PointerEvent) {
    if (!drawing.current) return;
    const pts = drawing.current.points;
    if (pts.length >= 2) {
      onAddStrokes([
        {
          id: drawing.current.id,
          tool: (tool === "eraser" ? "eraser" : tool) as BoardStroke["tool"],
          color: tool === "eraser" ? "#000" : color,
          width: TOOL_WIDTH[tool],
          points: pts,
        },
      ]);
    }
    drawing.current = null;
    redraw();
  }

  return (
    <div ref={scrollerRef} className="board-scroller">
      <div className="board-canvas-wrap" style={{ width: WALL_W, height: WALL_H }}>
        <canvas
          ref={canvasRef}
          width={WALL_W}
          height={WALL_H}
          className={`board-canvas ${tool === "select" ? "board-canvas--pass" : ""}`}
          onPointerDown={onCanvasDown}
          onPointerMove={onCanvasMove}
          onPointerUp={onCanvasUp}
          onPointerLeave={onCanvasUp}
        />
        <div className={`board-notes-layer ${tool !== "select" ? "board-notes-layer--pass" : ""}`}>
          {notes.map((n) => (
            <StickyNote
              key={n.id}
              note={n}
              canDrag={tool === "select" && (n.authorId === playerId || isHost)}
              onMove={onMoveNote}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
