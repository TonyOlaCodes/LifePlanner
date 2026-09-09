import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

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
    <div className="mini-app-shell" style={style}>
      <header className="mini-app-shell__header">
        <Link href="/" className="mini-app-shell__back tap-scale" aria-label="Back to apps">
          <ArrowLeft size={18} />
          <span>Apps</span>
        </Link>
        <span className="mini-app-shell__brand">{title}</span>
      </header>
      {children}
    </div>
  );
}
