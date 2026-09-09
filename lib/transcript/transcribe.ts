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

const MAX_DURATION_SEC = 60 * 15;
const TARGET_RATE = 16000;

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

function normalizeAudio(audio: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
  if (peak < 1e-6) return audio;
  const scale = 0.95 / peak;
  const out = new Float32Array(audio.length);
  for (let i = 0; i < audio.length; i++) out[i] = audio[i] * scale;
  return out;
}

function hasAudibleSignal(audio: Float32Array): boolean {
  if (audio.length < TARGET_RATE * 0.4) return false;
  let peak = 0;
  for (let i = 0; i < audio.length; i++) peak = Math.max(peak, Math.abs(audio[i]));
  return peak > 0.008;
}

function trimSilence(audio: Float32Array, threshold = 0.01): Float32Array {
  let end = audio.length;
  const tail = Math.min(audio.length, TARGET_RATE * 2);
  const tailStart = audio.length - tail;
  while (end > tailStart && Math.abs(audio[end - 1]) < threshold) end--;
  if (end < audio.length * 0.7) return audio;
  return end === audio.length ? audio : audio.subarray(0, end);
}

function resampleMono(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const newLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = src - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

function bufferToMono16k(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < length; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  return resampleMono(mono, buffer.sampleRate, TARGET_RATE);
}

function pickRecorderMime(): string | undefined {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

async function decodeRecordedBlob(blob: Blob): Promise<Float32Array> {
  const audioCtx = new AudioContext();
  try {
    const buffer = await blob.arrayBuffer();
    const decoded = await audioCtx.decodeAudioData(buffer.slice(0));
    return bufferToMono16k(decoded);
  } finally {
    await audioCtx.close().catch(() => undefined);
  }
}

/** Capture lossless PCM while the video plays (best quality for transcription). */
async function capturePcmFromVideo(
  video: HTMLVideoElement,
  durationSec: number,
): Promise<Float32Array> {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(video);
  const silent = audioCtx.createGain();
  silent.gain.value = 0;
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (ev) => {
    chunks.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(silent);
  silent.connect(audioCtx.destination);

  video.currentTime = 0;
  const playPromise = video.play();
  if (playPromise) await playPromise.catch(() => undefined);

  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    video.onended = finish;
    window.setTimeout(finish, durationSec * 1000 + 500);
  });

  video.pause();
  processor.disconnect();
  source.disconnect();
  silent.disconnect();

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  const mono = resampleMono(merged, audioCtx.sampleRate, TARGET_RATE);
  await audioCtx.close().catch(() => undefined);
  return mono;
}

async function recordMediaStream(
  stream: MediaStream,
  video: HTMLVideoElement,
  maxMs: number,
): Promise<Blob> {
  const mime = pickRecorderMime();
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  const blobReady = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
    recorder.onerror = () => reject(new Error("Could not capture audio from this video."));
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start(250);

  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    video.onended = finish;
    window.setTimeout(finish, maxMs);
  });

  video.pause();
  if (recorder.state === "recording") {
    recorder.requestData();
    recorder.stop();
  }
  return blobReady;
}

async function loadVideoElement(url: string): Promise<{ video: HTMLVideoElement; duration: number }> {
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Could not read this video file."));
  });

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("This video has no audio track.");
  }

  return { video, duration: Math.min(video.duration, MAX_DURATION_SEC) };
}

function disposeVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

/** Pull audio from a video file (MP4/MOV/WebM). */
async function decodeVideoToMono16k(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<Float32Array> {
  onProgress?.("Extracting audio from video…");
  const url = URL.createObjectURL(file);

  try {
    // Primary: lossless PCM capture via Web Audio
    const primary = await loadVideoElement(url);
    try {
      const pcm = await capturePcmFromVideo(primary.video, primary.duration);
      if (hasAudibleSignal(pcm)) return pcm;
    } finally {
      disposeVideo(primary.video);
    }

    // Fallback: captureStream + MediaRecorder (fresh video element)
    const fallback = await loadVideoElement(url);
    try {
      type VideoWithCapture = HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const vid = fallback.video as VideoWithCapture;
      const captureFn = vid.captureStream?.bind(vid) ?? vid.mozCaptureStream?.bind(vid);
      if (!captureFn) throw new Error("No capture API");

      fallback.video.currentTime = 0;
      const playPromise = fallback.video.play();
      if (playPromise) await playPromise.catch(() => undefined);

      const stream = captureFn();
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) throw new Error("No audio track");

      const blob = await recordMediaStream(
        new MediaStream(audioTracks),
        fallback.video,
        Math.ceil(fallback.duration * 1000) + 600,
      );
      const mono = await decodeRecordedBlob(blob);
      if (hasAudibleSignal(mono)) return mono;
    } finally {
      disposeVideo(fallback.video);
    }

    throw new Error("Could not extract audio from this video.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Decode audio-only files (WAV, MP3, OGG, etc.). */
async function decodeAudioFileToMono16k(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<Float32Array> {
  onProgress?.("Decoding audio…");
  const buffer = await file.arrayBuffer();
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(buffer.slice(0));
    const maxSamples = Math.floor(MAX_DURATION_SEC * decoded.sampleRate);
    if (decoded.length > maxSamples) {
      const trimmed = ctx.createBuffer(
        decoded.numberOfChannels,
        maxSamples,
        decoded.sampleRate,
      );
      for (let c = 0; c < decoded.numberOfChannels; c++) {
        trimmed.copyToChannel(decoded.getChannelData(c).subarray(0, maxSamples), c);
      }
      return bufferToMono16k(trimmed);
    }
    return bufferToMono16k(decoded);
  } finally {
    await ctx.close().catch(() => undefined);
  }
}

/** Decode any supported media file to 16 kHz mono for Whisper. */
export async function decodeAudioToMono16k(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<Float32Array> {
  onProgress?.("Reading media…");
  const isVideo =
    file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(file.name);

  if (isVideo) {
    return normalizeAudio(await decodeVideoToMono16k(file, onProgress));
  }

  try {
    return normalizeAudio(await decodeAudioFileToMono16k(file, onProgress));
  } catch {
    throw new Error("Unsupported file type. Use MP4, MOV, WebM, WAV, or MP3.");
  }
}

type WhisperChunk = { text: string; timestamp: [number, number | null] };

function assignSpeakers(segments: TranscriptSegment[], gapSeconds = 1.2): TranscriptSegment[] {
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
      return pipeline("automatic-speech-recognition", "Xenova/whisper-base", {
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

function cleanSegmentText(text: string): string {
  return text
    .replace(/\b(\w+)(?: \1\b)+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isHallucinatedSegment(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 4) return false;
  const counts = new Map<string, number>();
  for (const w of words) {
    const k = w.toLowerCase();
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const max = Math.max(...counts.values());
  return max / words.length >= 0.55;
}

function buildSegments(
  chunks: WhisperChunk[] | undefined,
  rawText: string,
  durationSec: number,
): TranscriptSegment[] {
  const fromChunks = (chunks || [])
    .map((chunk, i) => {
      const start = typeof chunk.timestamp?.[0] === "number" ? chunk.timestamp[0] : i * 2;
      const end =
        typeof chunk.timestamp?.[1] === "number" && chunk.timestamp[1] !== null
          ? chunk.timestamp[1]
          : start + Math.max(0.8, cleanSegmentText(chunk.text || "").split(/\s+/).length * 0.35);
      return {
        id: `seg-${i}`,
        start,
        end,
        text: cleanSegmentText(chunk.text || ""),
      };
    })
    .filter((s) => s.text.length > 0 && !isHallucinatedSegment(s.text));

  if (fromChunks.length) return fromChunks;

  const text = cleanSegmentText(rawText);
  if (!text) return [];
  return [{ id: "seg-0", start: 0, end: durationSec, text }];
}

/** Lightweight script-based language hint when Auto is selected. */
function guessLanguageFromText(text: string): string {
  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  if (/[\u0900-\u097f]/.test(text)) return "hi";
  return "en";
}

export async function transcribeMedia(options: {
  file: File;
  language: string;
  detectSpeakers: boolean;
  onProgress?: (msg: string) => void;
}): Promise<TranscriptResult> {
  const { file, language, detectSpeakers, onProgress } = options;
  const rawAudio = await decodeAudioToMono16k(file, onProgress);
  const audio = trimSilence(rawAudio);
  if (audio.length < TARGET_RATE * 0.5) {
    throw new Error("Could not find enough audio in this file. Try a different video.");
  }

  const transcriber = (await getTranscriber(onProgress)) as (
    input: Float32Array,
    opts: Record<string, unknown>,
  ) => Promise<{ text: string; chunks?: WhisperChunk[] }>;

  onProgress?.("Transcribing…");
  const asrOpts: Record<string, unknown> = {
    return_timestamps: true,
    chunk_length_s: 30,
    stride_length_s: 3,
    task: "transcribe",
  };
  if (language && language !== "auto") {
    asrOpts.language = language;
  }

  const output = await transcriber(audio, asrOpts);
  const rawText = cleanSegmentText(output.text || "");
  if (!rawText) {
    throw new Error("No speech detected. Check the video has clear audio.");
  }

  const durationSec = audio.length / TARGET_RATE;
  let segments = buildSegments(output.chunks, rawText, durationSec);

  if (detectSpeakers) {
    segments = assignSpeakers(segments);
  }

  const detected = language !== "auto" ? language : guessLanguageFromText(rawText);

  const fullText = detectSpeakers
    ? segments.map((s) => `${s.speaker}: ${s.text}`).join("\n\n")
    : segments.map((s) => s.text).join(" ");

  return {
    text: cleanSegmentText(fullText),
    language: detected,
    languageLabel: languageLabel(detected),
    segments,
    speakersEnabled: detectSpeakers,
  };
}
