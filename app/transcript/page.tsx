"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Film, Loader2, Upload, Users, Languages } from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  formatTimestamp,
  transcribeMedia,
  type TranscriptResult,
} from "@/lib/transcript/transcribe";

type Status = "idle" | "working" | "done" | "error";

export default function TranscriptPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [language, setLanguage] = useState("auto");
  const [detectSpeakers, setDetectSpeakers] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [editableText, setEditableText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canRun = !!file && status !== "working";

  function onPick(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("video/") && !f.type.startsWith("audio/")) {
      setError("Please choose a video or audio file.");
      setStatus("error");
      return;
    }
    setFile(f);
    setResult(null);
    setEditableText("");
    setError("");
    setStatus("idle");
    setProgress("");
  }

  async function runTranscribe() {
    if (!file) return;
    setStatus("working");
    setError("");
    setResult(null);
    setEditableText("");
    setProgress("Starting…");
    try {
      const out = await transcribeMedia({
        file,
        language,
        detectSpeakers,
        onProgress: setProgress,
      });
      setResult(out);
      const text = out.speakersEnabled
        ? out.segments
            .map((s) => `[${formatTimestamp(s.start)}] ${s.speaker}: ${s.text}`)
            .join("\n")
        : out.text;
      setEditableText(text);
      setStatus("done");
      setProgress("");
    } catch (e) {
      setStatus("error");
      setProgress("");
      setError(e instanceof Error ? e.message : "Transcription failed.");
    }
  }

  async function copyAll() {
    if (!editableText) return;
    try {
      await navigator.clipboard.writeText(editableText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy. Select the text and copy manually.");
    }
  }

  return (
    <main className="transcript-page">
      <div className="transcript-page__intro">
        <h1>Transcript</h1>
        <p>Upload a video, get clean text. Copy anything you need.</p>
      </div>

      <section className="transcript-card">
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          hidden
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          className="transcript-upload tap-scale"
          onClick={() => inputRef.current?.click()}
        >
          <span className="transcript-upload__icon">
            {file ? <Film size={22} /> : <Upload size={22} />}
          </span>
          <span className="transcript-upload__text">
            <strong>{file ? file.name : "Choose video"}</strong>
            <small>{file ? `${file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`} · tap to change` : "MP4, MOV, WebM, or audio"}</small>
          </span>
        </button>

        {previewUrl && (
          <video
            className="transcript-video"
            src={previewUrl}
            controls
            playsInline
            preload="metadata"
          />
        )}

        <div className="transcript-options">
          <label className="transcript-field">
            <span className="transcript-field__label">
              <Languages size={14} /> Language
            </span>
            <select
              className="lock-input"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={status === "working"}
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="transcript-toggle">
            <span>
              <Users size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Who is speaking
              <small>Labels turns when people pause</small>
            </span>
            <input
              type="checkbox"
              checked={detectSpeakers}
              onChange={(e) => setDetectSpeakers(e.target.checked)}
              disabled={status === "working"}
              style={{ width: 20, height: 20, accentColor: "var(--accent)" }}
            />
          </label>
        </div>

        <button
          type="button"
          className="transcript-run tap-scale"
          disabled={!canRun}
          onClick={() => void runTranscribe()}
        >
          {status === "working" ? (
            <>
              <Loader2 size={18} className="spin" />
              Working…
            </>
          ) : (
            "Transcribe"
          )}
        </button>

        {status === "working" && progress && (
          <p className="transcript-progress">{progress}</p>
        )}
        {error && <p className="transcript-error">{error}</p>}
      </section>

      {result && (
        <section className="transcript-card transcript-result">
          <div className="transcript-result__bar">
            <div>
              <h2>Result</h2>
              <p>
                {result.languageLabel}
                {result.speakersEnabled ? " · speakers labeled" : ""}
              </p>
            </div>
            <button type="button" className="transcript-copy tap-scale" onClick={() => void copyAll()}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copied" : "Copy all"}
            </button>
          </div>

          <div className="transcript-segments">
            {result.segments.map((seg) => (
              <article key={seg.id} className="transcript-seg">
                <header>
                  <time>{formatTimestamp(seg.start)}</time>
                  {seg.speaker && <span>{seg.speaker}</span>}
                </header>
                <p>{seg.text}</p>
              </article>
            ))}
          </div>

          <label className="transcript-field" style={{ marginTop: 14 }}>
            <span className="transcript-field__label">Editable text</span>
            <textarea
              className="lock-input transcript-textarea"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={6}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
        </section>
      )}
    </main>
  );
}
