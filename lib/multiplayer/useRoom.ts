"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "./types";
import { getPlayerId, getPlayerName, setPlayerName } from "./playerId";

type UseRoomOptions = {
  app: "wave-lock" | "poll" | "board";
  roomId?: string | null;
  pollMs?: number;
};

export function useRoom({ app, roomId, pollMs = 900 }: UseRoomOptions) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const playerId = getPlayerId();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    const playerName = getPlayerName();
    try {
      const res = await fetch(
        `/api/rooms/${roomId}?playerId=${encodeURIComponent(playerId)}&playerName=${encodeURIComponent(playerName)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error || "Room not found";

        if (res.status === 404) {
          const rejoin = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app, roomId, playerId, playerName }),
          });
          if (rejoin.ok) {
            const data = (await rejoin.json()) as RoomSnapshot;
            if (mounted.current) {
              setRoom(data);
              setError("");
            }
            return;
          }
        }

        if (mounted.current) {
          setError(msg);
          if (res.status === 403 || res.status === 404) setRoom(null);
        }
        return;
      }
      const data = (await res.json()) as RoomSnapshot;
      if (mounted.current) {
        setRoom(data);
        setError("");
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : "Could not load room");
    }
  }, [roomId, playerId, app]);

  useEffect(() => {
    if (!roomId) return;
    void fetchRoom();
    const id = window.setInterval(() => void fetchRoom(), pollMs);
    return () => window.clearInterval(id);
  }, [roomId, fetchRoom, pollMs]);

  const createRoom = useCallback(
    async (name?: string) => {
      setLoading(true);
      setError("");
      const displayName = name?.trim() || getPlayerName();
      setPlayerName(displayName);
      try {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app, playerId, playerName: displayName }),
        });
        const data = (await res.json()) as RoomSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not create room");
        if (mounted.current) setRoom(data);
        return data.id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not create room";
        if (mounted.current) setError(msg);
        return null;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [app],
  );

  const joinRoom = useCallback(
    async (code: string, name?: string) => {
      setLoading(true);
      setError("");
      const displayName = name?.trim() || getPlayerName();
      setPlayerName(displayName);
      try {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app,
            roomId: code.trim().toUpperCase(),
            playerId,
            playerName: displayName,
          }),
        });
        const data = (await res.json()) as RoomSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not join room");
        if (mounted.current) {
          setRoom(data);
          setError("");
        }
        return data.id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Could not join room";
        if (mounted.current) setError(msg);
        return null;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [app, playerId],
  );

  const sendAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (!roomId) return null;
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, playerId, ...payload }),
        });
        const data = (await res.json()) as RoomSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error || "Action failed");
        if (mounted.current) {
          setRoom(data);
          setError("");
        }
        return data;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Action failed";
        if (mounted.current) setError(msg);
        return null;
      }
    },
    [roomId, playerId],
  );

  return {
    room,
    error,
    loading,
    playerId,
    playerName: getPlayerName(),
    createRoom,
    joinRoom,
    sendAction,
    refresh: fetchRoom,
    setPlayerName,
  };
}
