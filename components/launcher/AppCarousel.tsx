"use client";

import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, type CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";

export type AppTile = {
  href: string;
  name: string;
  blurb: string;
  Icon: LucideIcon;
  gradient: string;
  glow: string;
  accent: string;
  border: string;
  iconBg: string;
};

const REPEAT = 40;

export function AppCarousel({ apps }: { apps: readonly AppTile[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const setWidthRef = useRef(0);
  const jumpingRef = useRef(false);

  const items = Array.from({ length: REPEAT }, (_, copy) =>
    apps.map((app, i) => ({ ...app, key: `${copy}-${i}` })),
  ).flat();

  const jumpToMiddle = useCallback(() => {
    const rail = railRef.current;
    if (!rail || !apps.length) return;
    const setWidth = rail.scrollWidth / REPEAT;
    if (!setWidth) return;
    setWidthRef.current = setWidth;
    jumpingRef.current = true;
    rail.scrollLeft = setWidth * (REPEAT / 2);
    requestAnimationFrame(() => {
      jumpingRef.current = false;
    });
  }, [apps.length]);

  useLayoutEffect(() => {
    jumpToMiddle();
  }, [jumpToMiddle, items.length]);

  const onScroll = useCallback(() => {
    if (jumpingRef.current) return;
    const rail = railRef.current;
    const setWidth = setWidthRef.current || (rail ? rail.scrollWidth / REPEAT : 0);
    if (!rail || !setWidth) return;
    setWidthRef.current = setWidth;

    const maxScroll = setWidth * (REPEAT - 1);
    if (rail.scrollLeft < setWidth * 0.6) {
      jumpingRef.current = true;
      rail.scrollLeft += setWidth * (REPEAT / 2);
      requestAnimationFrame(() => {
        jumpingRef.current = false;
      });
    } else if (rail.scrollLeft > maxScroll - setWidth * 0.6) {
      jumpingRef.current = true;
      rail.scrollLeft -= setWidth * (REPEAT / 2);
      requestAnimationFrame(() => {
        jumpingRef.current = false;
      });
    }
  }, []);

  return (
    <div ref={railRef} className="start-page__rail" role="list" onScroll={onScroll}>
      {items.map((app) => {
        const style = {
          background: app.gradient,
          boxShadow: `0 18px 40px ${app.glow}`,
          "--tile-accent": app.accent,
          "--tile-border": app.border,
          "--tile-glow": app.glow,
          "--tile-icon-bg": app.iconBg,
        } as CSSProperties;

        return (
          <Link
            key={app.key}
            href={app.href}
            role="listitem"
            className="start-tile tap-scale"
            style={style}
          >
            <div className="start-tile__icon">
              <app.Icon size={36} strokeWidth={1.75} />
            </div>
            <div className="start-tile__copy">
              <h2>{app.name}</h2>
              <p>{app.blurb}</p>
            </div>
            <span className="start-tile__open">Open →</span>
          </Link>
        );
      })}
    </div>
  );
}
