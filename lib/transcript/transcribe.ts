export type TranscriptSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
};

export type TranscriptResult = {
  text: string;
  language: string;
  languageLabel: string;
  segments: TranscriptSegment[];
  speakersEnabled: boolean;
};

export const LANGUAGE_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
] as const;

const LANGUAGE_NAMES: Record<string, string> = Object.fromEntries(
  LANGUAGE_OPTIONS.filter((o) => o.value !== "auto").map((o) => [o.value, o.label]),
);

export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function languageLabel(code: string): string {
  if (!code || code === "auto") return "Auto-detect";
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

/** Decode video/audio file to 16kHz mono Float32Array for Whisper. */
export async function decodeAudioToMono16k(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<Float32Array> {
  onProgress?.("Reading media…");
  const buffer = await file.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    onProgress?.("Decoding audio…");
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const mono = new Float32Array(length);
    for (let c = 0; c < channels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }
    const targetRate = 16000;
    if (decoded.sampleRate === targetRate) return mono;
    onProgress?.("Resampling…");
    const ratio = decoded.sampleRate / targetRate;
    const newLen = Math.max(1, Math.floor(mono.length / ratio));
    const resampled = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const src = i * ratio;
      const i0 = Math.floor(src);
      const i1 = Math.min(i0 + 1, mono.length - 1);
      const t = src - i0;
      resampled[i] = mono[i0] * (1 - t) + mono[i1] * t;
    }
    return resampled;
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

type WhisperChunk = { text: string; timestamp: [number, number | null] };

function assignSpeakers(segments: TranscriptSegment[], gapSeconds = 1.4): TranscriptSegment[] {
  if (!segments.length) return segments;
  let speakerIdx = 0;
  let lastEnd = segments[0].end;
  return segments.map((seg, i) => {
    if (i > 0 && seg.start - lastEnd >= gapSeconds) {
      speakerIdx = (speakerIdx + 1) % 4;
    }
    lastEnd = seg.end;
    return { ...seg, speaker: `Speaker ${speakerIdx + 1}` };
  });
}

let pipelinePromise: Promise<unknown> | null = null;

async function getTranscriber(onProgress?: (msg: string) => void) {
  if (!pipelinePromise) {
    onProgress?.("Loading speech model (first time may take a minute)…");
    pipelinePromise = (async () => {
      const { pipeline, env } = await import("@xenova/transformers");
      env.allowLocalModels = false;
      env.useBrowserCache = true;
      return pipeline("automatic-speech-recognition", "Xenova/whisper-tiny", {
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === "progress" && typeof p.progress === "number") {
            onProgress?.(`Downloading model… ${Math.round(p.progress)}%`);
          }
        },
      });
    })();
  }
  return pipelinePromise;
}

export async function transcribeMedia(options: {
  file: File;
  language: string;
  detectSpeakers: boolean;
  onProgress?: (msg: string) => void;
}): Promise<TranscriptResult> {
  const { file, language, detectSpeakers, onProgress } = options;
  const audio = await decodeAudioToMono16k(file, onProgress);
  if (audio.length < 1600) {
    throw new Error("Could not find enough audio in this file. Try a different video.");
  }

  // Cap ~10 minutes to keep browser work reasonable
  const maxSamples = 16000 * 60 * 10;
  const clipped = audio.length > maxSamples ? audio.subarray(0, maxSamples) : audio;

  const transcriber = (await getTranscriber(onProgress)) as (
    input: Float32Array,
    opts: Record<string, unknown>,
  ) => Promise<{ text: string; chunks?: WhisperChunk[] }>;

  onProgress?.("Transcribing…");
  const asrOpts: Record<string, unknown> = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 5,
  };
  if (language && language !== "auto") {
    asrOpts.language = language;
    asrOpts.task = "transcribe";
  }

  const output = await transcriber(clipped, asrOpts);
  const rawText = (output.text || "").trim();
  if (!rawText) {
    throw new Error("No speech detected. Check the video has clear audio.");
  }

  let segments: TranscriptSegment[] = (output.chunks || [])
    .map((chunk, i) => {
      const start = typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : i * 2;
      const end =
        typeof chunk.timestamp?.[1] === "number"
          ? chunk.timestamp[1]
          : start + Math.max(1, (chunk.text || "").split(/\s+/).length * 0.35);
      return {
        id: `seg-${i}`,
        start,
        end,
        text: (chunk.text || "").trim(),
      };
    })
    .filter((s) => s.text.length > 0);

  if (!segments.length) {
    segments = [{ id: "seg-0", start: 0, end: clipped.length / 16000, text: rawText }];
  }

  if (detectSpeakers) {
    segments = assignSpeakers(segments);
  }

  // Language: prefer user choice; otherwise infer from Whisper (tiny may not always return it)
  const detected =
    language !== "auto"
      ? language
      : guessLanguageFromText(rawText);

  return {
    text: detectSpeakers
      ? segments.map((s) => `${s.speaker}: ${s.text}`).join("\n\n")
      : segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim(),
    language: detected,
    languageLabel: languageLabel(detected),
    segments,
    speakersEnabled: detectSpeakers,
  };
}

/** Lightweight script-based language hint when Auto is selected. */
function guessLanguageFromText(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  if (/[\u0900-\u097f]/.test(text)) return "hi";
  // Latin-script: default English (Whisper tiny lacks reliable lang id in all builds)
  return "en";
}
