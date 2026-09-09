import { ImageResponse } from "next/og";

const ALLOWED = new Set(["72", "96", "128", "144", "152", "180", "192", "384", "512"]);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size: raw } = await params;
  const size = ALLOWED.has(raw) ? Number(raw) : 192;
  const pad = Math.round(size * 0.14);
  const fontSize = Math.round(size * 0.34);
  const inner = size - pad * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #000000 0%, #0a0f0d 45%, #061510 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: inner,
            height: inner,
            borderRadius: Math.round(size * 0.18),
            background: "linear-gradient(135deg, #6EE7B7 0%, #34D399 100%)",
            fontSize,
            fontWeight: 800,
            color: "#000",
            letterSpacing: -2,
          }}
        >
          LI
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
