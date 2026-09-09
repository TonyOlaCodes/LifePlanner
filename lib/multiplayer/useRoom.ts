"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomSnapshot } from "./types";
import { getPlayerId, getPlayerName, setPlayerName } from "./playerId";

type UseRoomOptions = {
  app: "wave-lock" | "poll" | "board";
  roomId?: string | null;
  pollMs?: number;
};

const FETCH_OPTS: RequestInit = { cache: "no-store" };

export function useRoom({ app, roomId, pollMs = 900 }: UseRoomOptions) {
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  const joinedAtRef = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    const playerId = getPlayerId();
    const playerName = getPlayerName();
    try {
      const res = await fetch(
        `/api/rooms/${roomId}?playerId=${encodeURIComponent(playerId)}&playerName=${encodeURIComponent(playerName)}`,
        FETCH_OPTS,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = body.error || "Room not found";

        if (res.status === 404) {
          const rejoin = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app, roomId, playerId, playerName }),
            ...FETCH_OPTS,
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

        const graceMs = Date.now() - joinedAtRef.current;
        if (mounted.current) {
          setError(msg);
          if ((res.status === 403 || res.status === 404) && graceMs > 4000) {
            setRoom(null);
          }
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
  }, [roomId, app]);

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
      const playerId = getPlayerId();
      const displayName = name?.trim() || getPlayerName();
      setPlayerName(displayName);
      try {
        const res = await fetch("/api/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app, playerId, playerName: displayName }),
          ...FETCH_OPTS,
        });
        const data = (await res.json()) as RoomSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not create room");
        joinedAtRef.current = Date.now();
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
      const playerId = getPlayerId();
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
          ...FETCH_OPTS,
        });
        const data = (await res.json()) as RoomSnapshot & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not join room");
        joinedAtRef.current = Date.now();
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
    [app],
  );

  const sendAction = useCallback(
    async (action: string, payload: Record<string, unknown> = {}) => {
      if (!roomId) return null;
      const playerId = getPlayerId();
      try {
        const res = await fetch(`/api/rooms/${roomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, playerId, ...payload }),
          ...FETCH_OPTS,
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
    [roomId],
  );

  return {
    room,
    error,
    loading,
    playerId: getPlayerId(),
    playerName: getPlayerName(),
    createRoom,
    joinRoom,
    sendAction,
    refresh: fetchRoom,
    setPlayerName,
  };
}
