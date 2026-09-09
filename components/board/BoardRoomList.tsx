"use client";

import { Clock, Trash2 } from "lucide-react";
import type { SavedBoardRoom } from "@/lib/board/roomHistory";

export function BoardRoomList({
  rooms,
  onOpen,
  onRemove,
}: {
  rooms: SavedBoardRoom[];
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!rooms.length) return null;

  return (
    <section className="room-card board-room-list">
      <h2 className="board-room-list__title">Your boards</h2>
      <ul className="board-room-list__items">
        {rooms.map((r) => (
          <li key={r.id}>
            <button type="button" className="board-room-item tap-scale" onClick={() => onOpen(r.id)}>
              <span className="board-room-item__code">{r.id}</span>
              <span className="board-room-item__meta">
                {r.role === "host" ? "Host" : "Joined"} · {r.label}
              </span>
              <span className="board-room-item__time">
                <Clock size={12} />
                {new Date(r.lastVisited).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </span>
            </button>
            <button
              type="button"
              className="board-room-item__remove tap-scale"
              aria-label="Remove from list"
              onClick={() => onRemove(r.id)}
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
