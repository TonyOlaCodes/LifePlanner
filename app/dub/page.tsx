"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Link2, Upload, Waves } from "lucide-react";
import { MiniAppShell } from "@/components/mini-app/MiniAppShell";
import { VoiceStudio } from "@/components/dub/VoiceStudio";

const ACCENT = "#FB923C";
const ACCENT_2 = "#FDBA74";

type AudioMode = "full" | "background";
type Phase = "idle" | "loading" | "ready" | "error";

export default function DubPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<AudioMode>("full");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [loadedMode, setLoadedMode] = useState<AudioMode>("full");

  useEffect(() => {
    return () => {
      if (songUrl) URL.revokeObjectURL(songUrl);
    };
  }, [songUrl]);

  async function pullAudio() {
    const trimmed = url.trim();
    if (!trimmed && !file) {
      setError("Paste a YouTube link or upload an audio/video file.");
      setPhase("error");
      return;
    }

    setPhase("loading");
    setError("");

    try {
      const form = new FormData();
      form.set("mode", mode);
      if (trimmed) form.set("url", trimmed);
      if (file) form.set("file", file);

      const res = await fetch("/api/youtube-audio", {
        method: "POST",
        body: form,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Download failed (${res.status})`);
      }

      const blob = await res.blob();
      const nextUrl = URL.createObjectURL(blob);
      const headerTitle = res.headers.get("X-Track-Title");
      const decoded = headerTitle ? decodeURIComponent(headerTitle) : file?.name || "Track";

      setSongUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });
      setTitle(decoded);
      setLoadedMode(mode);
      setPhase("ready");
    } catch (e) {
      setPhase("error");
      setError(e instanceof Error ? e.message : "Download failed.");
    }
  }

  return (
    <MiniAppShell title="Dub" accent={ACCENT} accentSecondary={ACCENT_2}>
      <main className="dub-page">
        <div className="dub-page__atmosphere" aria-hidden />

        <div className="dub-page__intro">
          <p className="dub-page__brand">Dub</p>
          <h1>YouTube to voice-over</h1>
          <p>Pull the track, record over it, undo takes, play song or mix.</p>
        </div>

        <section className="dub-card">
          <label className="dub-field">
            <span>
              <Link2 size={14} aria-hidden /> YouTube link
            </span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (e.target.value.trim()) setFile(null);
              }}
              disabled={phase === "loading"}
            />
          </label>

          <div className="dub-or">or</div>

          <input
            ref={fileRef}
            type="file"
            accept="audio/*,video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              if (f) setUrl("");
            }}
          />
          <button
            type="button"
            className="dub-upload"
            onClick={() => fileRef.current?.click()}
            disabled={phase === "loading"}
          >
            <Upload size={16} />
            <span>
              <strong>{file ? file.name : "Upload audio / video"}</strong>
              <small>Fallback if YouTube is blocked on the server</small>
            </span>
          </button>

          <div className="dub-source-mode" role="group" aria-label="Audio source mode">
            <button
              type="button"
              className={mode === "full" ? "is-active" : ""}
              onClick={() => setMode("full")}
              disabled={phase === "loading"}
            >
              Full audio
            </button>
            <button
              type="button"
              className={mode === "background" ? "is-active" : ""}
              onClick={() => setMode("background")}
              disabled={phase === "loading"}
            >
              <Waves size={14} aria-hidden />
              Background song
            </button>
          </div>

          <p className="dub-hint">
            {mode === "background"
              ? "Background mode reduces center vocals so your voice sits on the bed from the video."
              : "Full audio keeps the original mix from the video."}
          </p>

          <button
            type="button"
            className="dub-primary"
            onClick={() => void pullAudio()}
            disabled={phase === "loading"}
          >
            {phase === "loading" ? (
              <>
                <Loader2 size={18} className="dub-spin" />
                Preparing MP3…
              </>
            ) : (
              "Get MP3"
            )}
          </button>

          {phase === "error" && error && <p className="dub-error">{error}</p>}
        </section>

        {phase === "ready" && songUrl && (
          <VoiceStudio songUrl={songUrl} title={title} audioMode={loadedMode} />
        )}
      </main>
    </MiniAppShell>
  );
}
