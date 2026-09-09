"use client";

import { useEffect, useMemo, useState } from "react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { setPlayerName } from "@/lib/multiplayer/playerId";
import { waveLockExpectedTapMs } from "@/lib/multiplayer/waveLockUtils";

const ACCENT = "#FB7185";
const ROUND_MS = 3600;

export default function WaveLockPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const { room, error, loading, playerId, playerName, createRoom, joinRoom, sendAction } = useRoom({
    app: "wave-lock",
    roomId,
    pollMs: 450,
  });

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  const wl = room?.waveLock;
  const meIndex = room?.players.findIndex((p) => p.id === playerId) ?? -1;
  const playerCount = room?.players.length || 1;

  const pulse = useMemo(() => {
    if (!wl || wl.phase !== "playing" || !room) return 0;
    const elapsed = room.serverNow - wl.phaseStartedAt;
    return ((elapsed % ROUND_MS) / ROUND_MS) * 360;
  }, [wl, room]);

  const inMyWindow = useMemo(() => {
    if (!wl || wl.phase !== "playing" || meIndex < 0) return false;
    const elapsed = room ? room.serverNow - wl.phaseStartedAt : 0;
    const expected = waveLockExpectedTapMs(meIndex, playerCount, ROUND_MS);
    return Math.abs(elapsed - expected) < 420;
  }, [wl, room, meIndex, playerCount]);

  const alreadyTapped = wl?.presses[playerId] != null;

  async function handleCreate() {
    setPlayerName(name);
    const id = await createRoom(name);
    if (id) setRoomId(id);
  }

  async function handleJoin() {
    setPlayerName(name);
    const id = await joinRoom(joinCode, name);
    if (id) setRoomId(id);
  }

  return (
    <MiniAppShell title="Wave Lock" accent={ACCENT} accentSecondary="#F472B6">
      <main className="wave-lock-page">
        <div className="wave-lock-page__intro">
          <h1>Wave Lock</h1>
          <p>
            A neon pulse orbits the ring. Each player owns a slice. Hit <strong>LOCK</strong> when the pulse
            crosses your slice — sync as a team. Unlimited players.
          </p>
        </div>

        {(!room || !wl || wl.phase === "lobby") && (
          <RoomLobby
            room={room && (!wl || wl.phase === "lobby") ? room : null}
            playerId={playerId}
            playerName={name}
            onNameChange={setName}
            onCreate={() => void handleCreate()}
            onJoin={() => void handleJoin()}
            onReady={(ready) => void sendAction("ready", { ready })}
            onStart={() => void sendAction("start")}
            loading={loading}
            error={error}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            showStart
            startLabel="Start Wave Lock"
          />
        )}

        {room && wl && wl.phase !== "lobby" && (
          <section className="wave-lock-game">
            <div className="wave-lock-ring-wrap">
              <svg viewBox="0 0 200 200" className="wave-lock-ring">
                {room.players.map((p, i) => {
                  const start = (i / playerCount) * 360 - 90;
                  const end = ((i + 1) / playerCount) * 360 - 90;
                  const large = end - start > 180 ? 1 : 0;
                  const r = 78;
                  const cx = 100;
                  const cy = 100;
                  const toXY = (deg: number) => {
                    const rad = (deg * Math.PI) / 180;
                    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
                  };
                  const [x1, y1] = toXY(start);
                  const [x2, y2] = toXY(end);
                  const isMe = p.id === playerId;
                  const tapped = wl.presses[p.id] != null;
                  return (
                    <path
                      key={p.id}
                      d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
                      fill={p.color}
                      opacity={isMe ? 0.55 : 0.28}
                      stroke={tapped ? "#fff" : isMe ? ACCENT : "transparent"}
                      strokeWidth={tapped ? 2 : isMe ? 1.5 : 0}
                    />
                  );
                })}
                <circle cx="100" cy="100" r="28" fill="#0a0a0a" stroke="rgba(255,255,255,0.1)" />
                {wl.phase === "countdown" && (
                  <text x="100" y="108" textAnchor="middle" className="wave-lock-countdown">
                    {Math.max(0, wl.countdown - Math.floor((room.serverNow - wl.phaseStartedAt) / 1000)) || "GO"}
                  </text>
                )}
                {wl.phase === "playing" && (
                  <g transform={`rotate(${pulse} 100 100)`}>
                    <line x1="100" y1="100" x2="100" y2="24" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
                    <circle cx="100" cy="24" r="6" fill={ACCENT} />
                  </g>
                )}
              </svg>
              <p className="wave-lock-round">
                Round {Math.min(wl.round + 1, wl.maxRounds)} / {wl.maxRounds}
              </p>
            </div>

            {wl.phase === "playing" && (
              <button
                type="button"
                className={`wave-lock-btn tap-scale ${inMyWindow ? "wave-lock-btn--hot" : ""} ${alreadyTapped ? "wave-lock-btn--done" : ""}`}
                disabled={alreadyTapped}
                onClick={() => void sendAction("tap")}
              >
                {alreadyTapped ? "Locked ✓" : "LOCK"}
              </button>
            )}

            {wl.phase === "round-result" && (
              <div className="wave-lock-result glass">
                <h2>Sync score</h2>
                <p className="wave-lock-score">{wl.roundSyncMs ?? 0}</p>
                <p className="wave-lock-result-sub">Higher = tighter team timing (max 1000)</p>
              </div>
            )}

            {wl.phase === "finished" && (
              <div className="wave-lock-result glass">
                <h2>Mission complete</h2>
                <p className="wave-lock-score">{wl.totalScore}</p>
                <p className="wave-lock-result-sub">Total sync across {wl.maxRounds} rounds</p>
                <button
                  type="button"
                  className="room-btn room-btn--primary tap-scale"
                  style={{ marginTop: 14 }}
                  onClick={() => void sendAction("reset-lobby")}
                >
                  Back to lobby
                </button>
              </div>
            )}

            {wl.phase !== "finished" && (
              <ul className="wave-lock-status">
                {room.players.map((p) => (
                  <li key={p.id} style={{ color: p.color }}>
                    {p.name}: {wl.presses[p.id] != null ? "locked" : wl.phase === "playing" ? "…" : "ready"}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </MiniAppShell>
  );
}
