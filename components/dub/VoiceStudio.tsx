"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Mic,
  Pause,
  Play,
  Square,
  Undo2,
  Music2,
} from "lucide-react";
import { formatClock, revokeTake, type VoiceTake } from "@/lib/dub/audioTakes";

export type VoiceMode = "replace" | "add";

type Props = {
  songUrl: string;
  title: string;
  audioMode: "full" | "background";
};

export function VoiceStudio({ songUrl, title, audioMode }: Props) {
  const songRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartedAtRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceAudiosRef = useRef<HTMLAudioElement[]>([]);
  const rafRef = useRef<number | null>(null);

  const [takes, setTakes] = useState<VoiceTake[]>([]);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("add");
  const [recording, setRecording] = useState(false);
  const [playingSong, setPlayingSong] = useState(false);
  const [playingMix, setPlayingMix] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [micReady, setMicReady] = useState(false);

  useEffect(() => {
    const audio = new Audio(songUrl);
    audio.preload = "auto";
    songRef.current = audio;

    const onMeta = () => setDuration(audio.duration || 0);
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onEnded = () => {
      setPlayingSong(false);
      setPlayingMix(false);
      stopVoicePlayback();
    };
    const onPlay = () => setPlayingSong(true);
    const onPause = () => {
      if (!recording) setPlayingSong(false);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      songRef.current = null;
      stopVoicePlayback();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songUrl]);

  useEffect(() => {
    return () => {
      takes.forEach(revokeTake);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopVoicePlayback() {
    voiceAudiosRef.current.forEach((a) => {
      a.pause();
      a.src = "";
    });
    voiceAudiosRef.current = [];
    setPlayingMix(false);
  }

  async function ensureMic(): Promise<MediaStream> {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;
    setMicReady(true);
    return stream;
  }

  async function playSongAlone() {
    const song = songRef.current;
    if (!song) return;
    stopVoicePlayback();
    setError("");
    try {
      if (!song.paused && playingSong && !playingMix) {
        song.pause();
        setPlayingSong(false);
        return;
      }
      await song.play();
      setPlayingSong(true);
      setPlayingMix(false);
    } catch {
      setError("Could not play the track.");
    }
  }

  async function playMix() {
    const song = songRef.current;
    if (!song) return;
    setError("");
    stopVoicePlayback();

    if (!takes.length) {
      await playSongAlone();
      return;
    }

    try {
      if (!song.paused && playingMix) {
        song.pause();
        setPlayingSong(false);
        return;
      }

      const t0 = song.currentTime;
      const voices: HTMLAudioElement[] = [];
      for (const take of takes) {
        const a = new Audio(take.url);
        a.currentTime = Math.max(0, t0 - take.offset);
        voices.push(a);
      }
      voiceAudiosRef.current = voices;

      await song.play();
      await Promise.all(
        voices.map(async (a, i) => {
          const take = takes[i];
          if (t0 >= take.offset + take.duration) return;
          if (t0 < take.offset) {
            const delay = (take.offset - t0) * 1000;
            window.setTimeout(() => {
              if (!songRef.current || songRef.current.paused) return;
              void a.play().catch(() => undefined);
            }, delay);
          } else {
            await a.play().catch(() => undefined);
          }
        }),
      );
      setPlayingSong(true);
      setPlayingMix(true);
    } catch {
      setError("Could not play the mix.");
    }
  }

  function pauseAll() {
    songRef.current?.pause();
    stopVoicePlayback();
    setPlayingSong(false);
  }

  async function startRecording() {
    const song = songRef.current;
    if (!song || recording) return;
    setError("");

    try {
      const stream = await ensureMic();
      stopVoicePlayback();

      if (voiceMode === "replace") {
        setTakes((prev) => {
          prev.forEach(revokeTake);
          return [];
        });
      }

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const offset = recordStartedAtRef.current;
        const durationSec = Math.max(0.05, (songRef.current?.currentTime ?? offset) - offset);
        const take: VoiceTake = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          offset,
          duration: durationSec,
          blob,
          url: URL.createObjectURL(blob),
        };
        setTakes((prev) => [...prev, take]);
        setRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recordStartedAtRef.current = song.currentTime;
      recorder.start(200);
      setRecording(true);

      if (song.paused) {
        await song.play();
      }
      setPlayingSong(true);
      setPlayingMix(false);
    } catch {
      setError("Microphone permission is required to record.");
      setRecording(false);
    }
  }

  function stopRecording() {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") {
      setRecording(false);
      return;
    }
    rec.stop();
    mediaRecorderRef.current = null;
  }

  function undoLast() {
    setTakes((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const last = next.pop();
      if (last) revokeTake(last);
      return next;
    });
  }

  function seek(ratio: number) {
    const song = songRef.current;
    if (!song || !duration) return;
    const wasPlaying = !song.paused;
    const wasMix = playingMix;
    stopVoicePlayback();
    song.currentTime = Math.min(duration, Math.max(0, ratio * duration));
    setCurrentTime(song.currentTime);
    if (wasPlaying) {
      if (wasMix) void playMix();
      else void song.play();
    }
  }

  function downloadSong() {
    const a = document.createElement("a");
    a.href = songUrl;
    a.download = `${title || "track"}.mp3`;
    a.click();
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <section className="dub-studio">
      <div className="dub-studio__meta">
        <Music2 size={18} aria-hidden />
        <div>
          <strong>{title}</strong>
          <small>
            {audioMode === "background" ? "Background bed (vocals reduced)" : "Full audio from video"}
            {micReady ? " · mic ready" : ""}
          </small>
        </div>
      </div>

      <div className="dub-transport">
        <div className="dub-clock">
          <span>{formatClock(currentTime)}</span>
          <span>{formatClock(duration)}</span>
        </div>
        <input
          className="dub-scrub"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
        />
      </div>

      <div className="dub-mode" role="group" aria-label="Voice record mode">
        <button
          type="button"
          className={voiceMode === "add" ? "is-active" : ""}
          onClick={() => setVoiceMode("add")}
        >
          Add to voice
        </button>
        <button
          type="button"
          className={voiceMode === "replace" ? "is-active" : ""}
          onClick={() => setVoiceMode("replace")}
        >
          Replace voice
        </button>
      </div>

      <div className="dub-actions">
        <button type="button" className="dub-btn" onClick={() => void playSongAlone()} disabled={recording}>
          {playingSong && !playingMix && !recording ? <Pause size={18} /> : <Play size={18} />}
          Song only
        </button>
        <button type="button" className="dub-btn" onClick={() => void playMix()} disabled={recording}>
          {playingMix ? <Pause size={18} /> : <Play size={18} />}
          Play mix
        </button>
        {!recording ? (
          <button type="button" className="dub-btn dub-btn--record" onClick={() => void startRecording()}>
            <Mic size={18} />
            Record
          </button>
        ) : (
          <button type="button" className="dub-btn dub-btn--stop" onClick={stopRecording}>
            <Square size={16} />
            Stop
          </button>
        )}
        <button type="button" className="dub-btn" onClick={undoLast} disabled={!takes.length || recording}>
          <Undo2 size={18} />
          Undo last
        </button>
        <button type="button" className="dub-btn" onClick={pauseAll} disabled={!playingSong && !recording}>
          <Pause size={18} />
          Pause
        </button>
        <button type="button" className="dub-btn" onClick={downloadSong}>
          <Download size={18} />
          MP3
        </button>
      </div>

      {recording && (
        <p className="dub-recording-hint" role="status">
          <Loader2 size={14} className="dub-spin" />
          Recording over the track… press Stop when finished.
        </p>
      )}

      <div className="dub-takes">
        <h2>Voice takes ({takes.length})</h2>
        {!takes.length ? (
          <p className="dub-takes__empty">No recordings yet. Hit Record to layer your voice.</p>
        ) : (
          <ul>
            {takes.map((t, i) => (
              <li key={t.id}>
                <span>Take {i + 1}</span>
                <span>
                  @{formatClock(t.offset)} · {formatClock(t.duration)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="dub-error">{error}</p>}
    </section>
  );
}
