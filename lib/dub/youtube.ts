import { spawn } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type AudioMode = "full" | "background";

const YT_DLP_URL =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";

const YOUTUBE_RE =
  /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[\w\-?&=%.]+$/i;

export function isYouTubeUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    if (!["http:", "https:"].includes(u.protocol)) return false;
    return YOUTUBE_RE.test(u.href);
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureYtDlp(): Promise<string> {
  const candidates = [
    process.env.YT_DLP_PATH,
    join(process.cwd(), "bin", "yt-dlp"),
    "/tmp/yt-dlp",
    "yt-dlp",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (c === "yt-dlp") {
      try {
        await runCommand("yt-dlp", ["--version"], 15_000);
        return "yt-dlp";
      } catch {
        continue;
      }
    }
    if (await fileExists(c)) return c;
  }

  const dest = "/tmp/yt-dlp";
  const res = await fetch(YT_DLP_URL);
  if (!res.ok) {
    throw new Error("Could not download yt-dlp. Install it on the server and retry.");
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  await chmod(dest, 0o755);
  return dest;
}

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr.trim() || stdout.trim() || `${cmd} failed (${code})`));
    });
  });
}

async function reduceVocals(inputPath: string, outputPath: string): Promise<void> {
  // Classic center-channel cancel: reduces lead vocals for a usable bed track.
  await runCommand(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-af",
      "pan=stereo|c0=c0-c1|c1=c1-c0,volume=1.6",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "2",
      outputPath,
    ],
    120_000,
  );
}

function nodeRuntimeArg(): string {
  const fromEnv = process.env.YT_DLP_NODE_PATH?.trim();
  if (fromEnv) return `node:${fromEnv}`;
  return `node:${process.execPath}`;
}

function cookiesArgs(): string[] {
  const file = process.env.YT_COOKIES_FILE?.trim() || process.env.YTDLP_COOKIES?.trim();
  if (file) return ["--cookies", file];
  return [];
}

function friendlyYtError(raw: string): string {
  if (/sign in to confirm/i.test(raw) || /not a bot/i.test(raw)) {
    return "YouTube blocked this server (bot check). Set YT_COOKIES_FILE to a Netscape cookies.txt export, or upload an audio file below.";
  }
  if (/private video|video unavailable|copyright/i.test(raw)) {
    return "That video is unavailable or private.";
  }
  const line = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .find((l) => /^ERROR:/i.test(l));
  return line?.replace(/^ERROR:\s*/i, "") || "Could not download audio from YouTube.";
}

export type DownloadedAudio = {
  buffer: Buffer;
  title: string;
  filename: string;
  mode: AudioMode;
};

async function toMp3Buffer(
  inputPath: string,
  mode: AudioMode,
  title: string,
): Promise<DownloadedAudio> {
  const work = await mkdtemp(join(tmpdir(), "dub-conv-"));
  try {
    let mp3Path = join(work, "track.mp3");
    if (inputPath.toLowerCase().endsWith(".mp3") && mode === "full") {
      mp3Path = inputPath;
    } else {
      await runCommand(
        "ffmpeg",
        ["-y", "-i", inputPath, "-codec:a", "libmp3lame", "-q:a", "2", mp3Path],
        120_000,
      );
    }

    let finalPath = mp3Path;
    if (mode === "background") {
      const bgPath = join(work, "background.mp3");
      await reduceVocals(mp3Path, bgPath);
      finalPath = bgPath;
    }

    const buffer = await readFile(finalPath);
    const safe = title
      .replace(/[^\w\s\-().]+/g, "")
      .trim()
      .slice(0, 80)
      .replace(/\s+/g, "-")
      .toLowerCase();
    const filename = `${safe || "track"}${mode === "background" ? "-background" : ""}.mp3`;
    return { buffer, title, filename, mode };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function downloadYouTubeAudio(
  url: string,
  mode: AudioMode = "full",
): Promise<DownloadedAudio> {
  if (!isYouTubeUrl(url)) {
    throw new Error("Paste a valid YouTube link.");
  }

  const ytDlp = await ensureYtDlp();
  const work = await mkdtemp(join(tmpdir(), "dub-"));
  const outTpl = join(work, "track.%(ext)s");

  try {
    let title = "track";
    try {
      const meta = await runCommand(
        ytDlp,
        [
          "--no-playlist",
          "--js-runtimes",
          nodeRuntimeArg(),
          "--remote-components",
          "ejs:github",
          ...cookiesArgs(),
          "--print",
          "%(title)s",
          "--skip-download",
          url.trim(),
        ],
        90_000,
      );
      title = meta.stdout.trim().split("\n").filter(Boolean).pop() || title;
    } catch {
      /* title optional */
    }

    try {
      await runCommand(
        ytDlp,
        [
          "--no-playlist",
          "--js-runtimes",
          nodeRuntimeArg(),
          "--remote-components",
          "ejs:github",
          ...cookiesArgs(),
          "--extract-audio",
          "--audio-format",
          "mp3",
          "--audio-quality",
          "0",
          "--newline",
          "-o",
          outTpl,
          url.trim(),
        ],
        180_000,
      );
    } catch (e) {
      throw new Error(friendlyYtError(e instanceof Error ? e.message : String(e)));
    }

    let mp3Path = join(work, "track.mp3");
    if (!(await fileExists(mp3Path))) {
      const files = await readdir(work);
      const found = files.find((f) => /\.(mp3|m4a|webm|opus|wav)$/i.test(f));
      if (!found) throw new Error("Download finished but no audio file was produced.");
      if (!found.endsWith(".mp3")) {
        const converted = join(work, "converted.mp3");
        await runCommand(
          "ffmpeg",
          ["-y", "-i", join(work, found), "-codec:a", "libmp3lame", "-q:a", "2", converted],
          120_000,
        );
        mp3Path = converted;
      } else {
        mp3Path = join(work, found);
      }
    }

    if (mode === "background") {
      const bgPath = join(work, "background.mp3");
      await reduceVocals(mp3Path, bgPath);
      const buffer = await readFile(bgPath);
      const safe = title
        .replace(/[^\w\s\-().]+/g, "")
        .trim()
        .slice(0, 80)
        .replace(/\s+/g, "-")
        .toLowerCase();
      return {
        buffer,
        title,
        filename: `${safe || "track"}-background.mp3`,
        mode,
      };
    }

    const buffer = await readFile(mp3Path);
    const safe = title
      .replace(/[^\w\s\-().]+/g, "")
      .trim()
      .slice(0, 80)
      .replace(/\s+/g, "-")
      .toLowerCase();
    return { buffer, title, filename: `${safe || "track"}.mp3`, mode };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function processUploadedAudio(
  file: Buffer,
  originalName: string,
  mode: AudioMode = "full",
): Promise<DownloadedAudio> {
  const work = await mkdtemp(join(tmpdir(), "dub-up-"));
  try {
    const ext = originalName.includes(".")
      ? originalName.slice(originalName.lastIndexOf("."))
      : ".bin";
    const inputPath = join(work, `input${ext}`);
    await writeFile(inputPath, file);
    const base = originalName.replace(/\.[^.]+$/, "") || "upload";
    return await toMp3Buffer(inputPath, mode, base);
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function ensureCacheDir(): Promise<string> {
  const dir = join(tmpdir(), "dub-cache");
  await mkdir(dir, { recursive: true });
  return dir;
}
