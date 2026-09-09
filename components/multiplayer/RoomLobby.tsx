"use client";

import { Check, Copy, Loader2, Users } from "lucide-react";
import type { Player, RoomSnapshot } from "@/lib/multiplayer/types";
import { useState } from "react";

export function RoomLobby({
  room,
  playerId,
  playerName,
  onNameChange,
  onCreate,
  onJoin,
  onReady,
  onStart,
  loading,
  error,
  joinCode,
  onJoinCodeChange,
  showStart,
  startLabel = "Start",
}: {
  room: RoomSnapshot | null;
  playerId: string;
  playerName: string;
  onNameChange: (name: string) => void;
  onCreate: () => void;
  onJoin: () => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  loading: boolean;
  error: string;
  joinCode: string;
  onJoinCodeChange: (code: string) => void;
  showStart: boolean;
  startLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const me = room?.players.find((p) => p.id === playerId);
  const allReady = !!room && room.players.length >= 2 && room.players.every((p) => p.ready);

  async function copyCode() {
    if (!room?.id) return;
    try {
      await navigator.clipboard.writeText(room.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  if (!room) {
    return (
      <section className="room-card">
        <label className="room-field">
          <span>Your name</span>
          <input className="lock-input" value={playerName} onChange={(e) => onNameChange(e.target.value)} />
        </label>
        <button type="button" className="room-btn room-btn--primary tap-scale" disabled={loading} onClick={onCreate}>
          {loading ? <Loader2 size={18} className="spin" /> : "Create room"}
        </button>
        <div className="room-divider">or join</div>
        <label className="room-field">
          <span>Room code</span>
          <input
            className="lock-input room-code-input"
            value={joinCode}
            onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
            placeholder="ABCDE"
            maxLength={5}
          />
        </label>
        <button type="button" className="room-btn tap-scale" disabled={loading || joinCode.length < 4} onClick={onJoin}>
          Join
        </button>
        {error && <p className="room-error">{error}</p>}
      </section>
    );
  }

  return (
    <section className="room-card">
      <div className="room-code-row">
        <div>
          <p className="room-code-label">Room code</p>
          <p className="room-code-value">{room.id}</p>
        </div>
        <button type="button" className="room-copy tap-scale" onClick={() => void copyCode()}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="room-players">
        <p className="room-players__title">
          <Users size={14} /> Players ({room.players.length})
        </p>
        <ul className="room-players__list">
          {room.players.map((p: Player) => (
            <li key={p.id} style={{ borderColor: p.color }}>
              <span className="room-player-dot" style={{ background: p.color }} />
              <span className="room-player-name">{p.name}{p.id === room.hostId ? " · host" : ""}</span>
              {p.ready ? <span className="room-player-ready">Ready</span> : <span className="room-player-wait">…</span>}
            </li>
          ))}
        </ul>
      </div>

      <label className="room-toggle">
        <span>I&apos;m ready</span>
        <input
          type="checkbox"
          checked={!!me?.ready}
          onChange={(e) => onReady(e.target.checked)}
          style={{ width: 22, height: 22, accentColor: "var(--accent)" }}
        />
      </label>

      {showStart && (
        <button
          type="button"
          className="room-btn room-btn--primary tap-scale"
          disabled={!allReady}
          onClick={onStart}
        >
          {startLabel}
        </button>
      )}

      {!allReady && room.players.length >= 2 && (
        <p className="room-hint">Waiting for everyone to tap Ready…</p>
      )}
      {room.players.length < 2 && (
        <p className="room-hint">Share the code — need at least 2 players.</p>
      )}
      {error && <p className="room-error">{error}</p>}
    </section>
  );
}
