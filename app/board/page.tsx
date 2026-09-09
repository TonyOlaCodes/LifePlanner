"use client";

import { useCallback, useEffect, useState } from "react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { BoardRoomList } from "@/components/board/BoardRoomList";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { BoardWall } from "@/components/board/BoardWall";
import { RoomLobby } from "@/components/multiplayer/RoomLobby";
import { WALL_H, WALL_W, type DrawTool } from "@/lib/board/constants";
import { loadBoardRooms, rememberBoardRoom, removeBoardRoom } from "@/lib/board/roomHistory";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { setPlayerName } from "@/lib/multiplayer/playerId";
import type { BoardStroke } from "@/lib/multiplayer/types";
import { UserMinus } from "lucide-react";

const ACCENT = "#FBBF24";

export default function BoardPage() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [savedRooms, setSavedRooms] = useState(loadBoardRooms());
  const [tool, setTool] = useState<DrawTool>("select");
  const [drawColor, setDrawColor] = useState("#000000");
  const [stickyColor, setStickyColor] = useState("yellow");

  const { room, error, loading, playerId, playerName, createRoom, joinRoom, sendAction } = useRoom({
    app: "board",
    roomId,
    pollMs: 650,
  });

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  useEffect(() => {
    if (!room) return;
    rememberBoardRoom({
      id: room.id,
      label: room.players.length > 1 ? `${room.players.length} people` : "Solo",
      role: room.hostId === playerId ? "host" : "member",
      lastVisited: Date.now(),
    });
    setSavedRooms(loadBoardRooms());
  }, [room?.id, room?.players.length, room?.hostId, playerId]);

  const notes = room?.board?.notes || [];
  const strokes = room?.board?.strokes || [];
  const isHost = room?.hostId === playerId;

  const openRoom = useCallback(
    async (id: string) => {
      setPlayerName(name);
      const joined = await joinRoom(id, name);
      if (joined) {
        setRoomId(joined);
      } else {
        removeBoardRoom(id);
        setSavedRooms(loadBoardRooms());
      }
    },
    [joinRoom, name],
  );

  async function handleCreate() {
    setPlayerName(name);
    const id = await createRoom(name);
    if (id) {
      setRoomId(id);
      rememberBoardRoom({ id, label: "New board", role: "host", lastVisited: Date.now() });
      setSavedRooms(loadBoardRooms());
    }
  }

  async function handleJoin() {
    setPlayerName(name);
    const id = await joinRoom(joinCode, name);
    if (id) {
      setRoomId(id);
      rememberBoardRoom({ id, label: "Joined", role: "member", lastVisited: Date.now() });
      setSavedRooms(loadBoardRooms());
    }
  }

  function dropNoteCenter(text: string) {
    void sendAction("add-note", {
      noteText: text,
      noteColor: stickyColor,
      noteX: WALL_W / 2 - 84,
      noteY: WALL_H / 2 - 70,
    });
  }

  function handleAddStrokes(batch: Omit<BoardStroke, "authorId" | "createdAt">[]) {
    void sendAction("add-strokes", { strokes: batch });
  }

  function handleMoveNote(id: string, x: number, y: number) {
    void sendAction("move-note", { noteId: id, noteX: x, noteY: y });
  }

  return (
    <MiniAppShell title="Orbit Board" accent={ACCENT} accentSecondary="#FDE047">
      <main className={`board-page ${room ? "board-page--active" : ""}`}>
        {!room && (
          <>
            <div className="board-page__intro">
              <h1>Orbit Board</h1>
              <p>Big cork wall, real sticky notes, draw with pens and paint — together.</p>
            </div>
            <BoardRoomList
              rooms={savedRooms}
              onOpen={openRoom}
              onRemove={(id) => {
                removeBoardRoom(id);
                setSavedRooms(loadBoardRooms());
              }}
            />
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
          </>
        )}

        {room && (
          <>
            <div className="board-topbar">
              <div className="board-topbar__code">
                <span className="room-code-label">Room</span>
                <strong>{room.id}</strong>
              </div>
              <div className="board-topbar__players">
                {room.players.map((p) => (
                  <span key={p.id} className="board-player-chip" style={{ borderColor: p.color }}>
                    <span className="board-player-dot" style={{ background: p.color }} />
                    {p.name}
                    {isHost && p.id !== playerId && (
                      <button
                        type="button"
                        className="board-kick tap-scale"
                        title={`Kick ${p.name}`}
                        onClick={() => void sendAction("kick-player", { targetPlayerId: p.id })}
                      >
                        <UserMinus size={12} />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              <button type="button" className="board-leave tap-scale" onClick={() => setRoomId(null)}>
                Rooms
              </button>
            </div>

            <BoardToolbar
              tool={tool}
              onTool={setTool}
              color={drawColor}
              onColor={setDrawColor}
              stickyColor={stickyColor}
              onStickyColor={setStickyColor}
            />

            <div className="board-compose-bar">
              <input
                className="lock-input board-note-input"
                placeholder="New sticky note…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && note.trim()) {
                    dropNoteCenter(note);
                    setNote("");
                  }
                }}
              />
              <button
                type="button"
                className="room-btn room-btn--primary tap-scale board-drop-btn"
                disabled={!note.trim()}
                onClick={() => {
                  dropNoteCenter(note);
                  setNote("");
                }}
              >
                Drop note
              </button>
              {isHost && (
                <>
                  <button type="button" className="room-btn tap-scale" onClick={() => void sendAction("clear-drawings")}>
                    Clear art
                  </button>
                  <button type="button" className="room-btn tap-scale" onClick={() => void sendAction("clear-board")}>
                    Clear all
                  </button>
                </>
              )}
            </div>

            <BoardWall
              notes={notes}
              strokes={strokes}
              tool={tool}
              color={drawColor}
              playerId={playerId}
              isHost={isHost}
              onAddStrokes={handleAddStrokes}
              onMoveNote={handleMoveNote}
            />

            {error && <p className="room-error board-page-error">{error}</p>}
          </>
        )}
      </main>
    </MiniAppShell>
  );
}
