"use client";

import { useEffect, useState } from "react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { setPlayerName } from "@/lib/multiplayer/playerId";

const ACCENT = "#38BDF8";

export default function PollPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("What should we do tonight?");
  const [options, setOptions] = useState(["Pizza", "Movie", "Game night", "Surprise me"]);

  const { room, error, loading, playerId, playerName, createRoom, joinRoom, sendAction } = useRoom({
    app: "poll",
    roomId,
  });

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  const poll = room?.poll;
  const isHost = room?.hostId === playerId;
  const myVote = poll?.voted[playerId];
  const totalVotes = poll ? Object.values(poll.votes).reduce((a, b) => a + b, 0) : 0;

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

  function updateOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }

  return (
    <MiniAppShell title="Live Poll" accent={ACCENT} accentSecondary="#60A5FA">
      <main className="poll-page">
        <div className="poll-page__intro">
          <h1>Live Poll</h1>
          <p>Create a question, share the code, watch votes roll in live.</p>
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

        {room && poll && (
          <>
            <section className="room-card">
              <div className="room-code-row">
                <div>
                  <p className="room-code-label">Room code</p>
                  <p className="room-code-value">{room.id}</p>
                </div>
                <p className="poll-live-badge">{room.players.length} online</p>
              </div>
            </section>

            {isHost && (
              <section className="room-card">
                <label className="room-field">
                  <span>Question</span>
                  <input className="lock-input" value={question} onChange={(e) => setQuestion(e.target.value)} />
                </label>
                {options.map((opt, i) => (
                  <label key={i} className="room-field">
                    <span>Option {i + 1}</span>
                    <input className="lock-input" value={opt} onChange={(e) => updateOption(i, e.target.value)} />
                  </label>
                ))}
                <button
                  type="button"
                  className="room-btn room-btn--primary tap-scale"
                  onClick={() => void sendAction("set-poll", { question, options })}
                >
                  Publish poll
                </button>
              </section>
            )}

            <section className="room-card poll-live">
              <h2 className="poll-question">{poll.question}</h2>
              <p className="poll-meta">{totalVotes} vote{totalVotes === 1 ? "" : "s"}</p>
              <div className="poll-options">
                {poll.options.map((opt, i) => {
                  const count = poll.votes[i] || 0;
                  const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                  const selected = myVote === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`poll-option tap-scale ${selected ? "poll-option--selected" : ""}`}
                      onClick={() => void sendAction("vote", { optionIndex: i })}
                    >
                      <div className="poll-option__bar" style={{ width: `${pct}%` }} />
                      <span className="poll-option__label">{opt}</span>
                      <span className="poll-option__count">{count} · {pct}%</span>
                    </button>
                  );
                })}
              </div>
            </section>
            {error && <p className="room-error">{error}</p>}
          </>
        )}
      </main>
    </MiniAppShell>
  );
}
