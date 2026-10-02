import { NextResponse } from "next/server";
import {
  downloadYouTubeAudio,
  processUploadedAudio,
  type AudioMode,
} from "@/lib/dub/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function audioResponse(audio: {
  buffer: Buffer;
  title: string;
  filename: string;
  mode: AudioMode;
}) {
  return new NextResponse(new Uint8Array(audio.buffer), {
    status: 200,
    headers: {
      ...NO_STORE,
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `attachment; filename="${audio.filename}"`,
      "X-Track-Title": encodeURIComponent(audio.title),
      "X-Audio-Mode": audio.mode,
    },
  });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const mode: AudioMode = form.get("mode") === "background" ? "background" : "full";
      const file = form.get("file");
      const url = String(form.get("url") || "").trim();

      if (file instanceof File && file.size > 0) {
        if (file.size > 80 * 1024 * 1024) {
          return NextResponse.json(
            { error: "File too large (max 80MB)." },
            { status: 400, headers: NO_STORE },
          );
        }
        const buf = Buffer.from(await file.arrayBuffer());
        const audio = await processUploadedAudio(buf, file.name || "upload.mp3", mode);
        return audioResponse(audio);
      }

      if (url) {
        const audio = await downloadYouTubeAudio(url, mode);
        return audioResponse(audio);
      }

      return NextResponse.json(
        { error: "Provide a YouTube url or an audio/video file." },
        { status: 400, headers: NO_STORE },
      );
    }

    let body: { url?: string; mode?: AudioMode };
    try {
      body = (await req.json()) as { url?: string; mode?: AudioMode };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
    }

    const url = body.url?.trim();
    const mode: AudioMode = body.mode === "background" ? "background" : "full";

    if (!url) {
      return NextResponse.json({ error: "Missing YouTube url" }, { status: 400, headers: NO_STORE });
    }

    const audio = await downloadYouTubeAudio(url, mode);
    return audioResponse(audio);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Download failed";
    const status = /valid YouTube|Paste a valid|too large|Provide a/i.test(message) ? 400 : 502;
    return NextResponse.json({ error: message }, { status, headers: NO_STORE });
  }
}
