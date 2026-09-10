import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft, Zap } from "lucide-react";

export function MiniAppShell({
  title,
  accent,
  accentSecondary,
  children,
}: {
  title: string;
  accent: string;
  accentSecondary?: string;
  children: ReactNode;
}) {
  const style = {
    "--accent": accent,
    "--accent-secondary": accentSecondary || accent,
  } as CSSProperties;

  return (
    <div className="mini-app-shell mini-app-shell--cosmic" style={style}>
      <div className="mini-app-shell__glow" aria-hidden />
      <header className="mini-app-shell__header">
        <Link href="/" className="mini-app-shell__back tap-scale" aria-label="Back to Nexus">
          <ArrowLeft size={18} />
          <span>Nexus</span>
        </Link>
        <span className="mini-app-shell__brand">
          <Zap size={14} />
          {title}
        </span>
      </header>
      {children}
    </div>
  );
}
