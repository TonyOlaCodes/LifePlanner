"use client";

import { useEffect, useState } from "react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { setPlayerName } from "@/lib/multiplayer/playerId";

const ACCENT = "#FBBF24";

export default function BoardPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const { room, error, loading, playerId, playerName, createRoom, joinRoom, sendAction } = useRoom({
    app: "board",
    roomId,
  });

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  const notes = room?.board?.notes || [];
  const isHost = room?.hostId === playerId;

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
    <MiniAppShell title="Orbit Board" accent={ACCENT} accentSecondary="#FDE047">
      <main className="board-page">
        <div className="board-page__intro">
          <h1>Orbit Board</h1>
          <p>Drop sticky notes on a shared wall — perfect for brainstorms and retro boards.</p>
        </div>

        {!room && (
          <RoomLobby
            room={null}
            playerId={playerId}
            playerName={name}
            onNameChange={setName}
            onCreate={() => void handleCreate()}
            onJoin={() => void handleJoin()}
            onReady={() => undefined}
            onStart={() => undefined}
            loading={loading}
            error={error}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            showStart={false}
          />
        )}

        {room && (
          <>
            <section className="room-card board-compose">
              <div className="room-code-row">
                <div>
                  <p className="room-code-label">Room code</p>
                  <p className="room-code-value">{room.id}</p>
                </div>
                <p className="poll-live-badge">{room.players.length} online</p>
              </div>
              <textarea
                className="lock-input board-textarea"
                rows={3}
                placeholder="Type a sticky note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="board-compose__actions">
                <button
                  type="button"
                  className="room-btn room-btn--primary tap-scale"
                  disabled={!note.trim()}
                  onClick={() => {
                    void sendAction("add-note", { noteText: note });
                    setNote("");
                  }}
                >
                  Drop note
                </button>
                {isHost && (
                  <button type="button" className="room-btn tap-scale" onClick={() => void sendAction("clear-notes")}>
                    Clear wall
                  </button>
                )}
              </div>
            </section>

            <section className="board-wall">
              {notes.length === 0 ? (
                <p className="board-empty">No notes yet — be the first.</p>
              ) : (
                notes.map((n) => (
                  <article
                    key={n.id}
                    className="board-note"
                    style={{
                      left: `${n.x}%`,
                      top: `${n.y}%`,
                      background: `linear-gradient(145deg, ${n.color}33, ${n.color}18)`,
                      borderColor: `${n.color}66`,
                    }}
                  >
                    <p className="board-note__author">{n.authorName}</p>
                    <p className="board-note__text">{n.text}</p>
                  </article>
                ))
              )}
            </section>
            {error && <p className="room-error">{error}</p>}
          </>
        )}
      </main>
    </MiniAppShell>
  );
}
