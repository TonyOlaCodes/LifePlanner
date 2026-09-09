import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft } from "lucide-react";

export default function TranscriptLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="transcript-shell"
      style={
        {
          "--accent": "#A78BFA",
          "--accent-secondary": "#C4B5FD",
        } as CSSProperties
      }
    >
      <header className="transcript-shell__header">
        <Link href="/" className="transcript-shell__back tap-scale" aria-label="Back to apps">
          <ArrowLeft size={18} />
          <span>Apps</span>
        </Link>
        <span className="transcript-shell__brand">Transcript</span>
      </header>
      {children}
    </div>
  );
}
