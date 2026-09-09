"use client";

import type { ReactNode } from "react";
import { Eraser, Hand, Highlighter, Paintbrush, PenLine } from "lucide-react";
import { PALETTE, STICKY_COLORS, type DrawTool } from "@/lib/board/constants";

export function BoardToolbar({
  tool,
  onTool,
  color,
  onColor,
  stickyColor,
  onStickyColor,
}: {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  color: string;
  onColor: (c: string) => void;
  stickyColor: string;
  onStickyColor: (id: string) => void;
}) {
  const tools: { id: DrawTool; label: string; icon: ReactNode }[] = [
    { id: "select", label: "Move", icon: <Hand size={18} /> },
    { id: "pen", label: "Pen", icon: <PenLine size={18} /> },
    { id: "marker", label: "Marker", icon: <Highlighter size={18} /> },
    { id: "paint", label: "Paint", icon: <Paintbrush size={18} /> },
    { id: "eraser", label: "Eraser", icon: <Eraser size={18} /> },
  ];

  return (
    <div className="board-toolbar">
      <div className="board-toolbar__group">
        {tools.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`board-tool tap-scale ${tool === t.id ? "board-tool--active" : ""}`}
            onClick={() => onTool(t.id)}
            title={t.label}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>
      {tool !== "select" && tool !== "eraser" && (
        <div className="board-toolbar__group board-toolbar__palette">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`board-swatch ${color === c ? "board-swatch--active" : ""}`}
              style={{ background: c }}
              onClick={() => onColor(c)}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      )}
      <div className="board-toolbar__group board-toolbar__stickies">
        {STICKY_COLORS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`board-sticky-swatch ${stickyColor === s.id ? "board-sticky-swatch--active" : ""}`}
            style={{ background: s.fill, boxShadow: `inset 0 -2px 0 ${s.edge}` }}
            onClick={() => onStickyColor(s.id)}
            title={`Sticky ${s.id}`}
          />
        ))}
      </div>
    </div>
  );
}
