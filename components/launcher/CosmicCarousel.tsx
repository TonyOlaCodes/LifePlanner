"use client";

import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { AppTile } from "@/components/launcher/AppCarousel";

const REPEAT = 40;

function PortalTile({
  app,
  active,
  style,
}: {
  app: AppTile & { key: string };
  active: boolean;
  style: CSSProperties;
}) {
  const Icon = app.Icon;

  return (
    <motion.div
      className={`nexus-portal ${active ? "nexus-portal--active" : ""}`}
      style={style}
      animate={{
        scale: active ? 1 : 0.88,
        rotateY: active ? 0 : 8,
        z: active ? 40 : 0,
      }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
    >
      <Link href={app.href} className="nexus-portal__link tap-scale" draggable={false}>
        <span className="nexus-portal__shine" aria-hidden />
        <span className="nexus-portal__grid" aria-hidden />
        {app.badge && <span className="nexus-portal__badge">{app.badge}</span>}
        <div className="nexus-portal__icon">
          <Icon size={38} strokeWidth={1.6} />
        </div>
        <div className="nexus-portal__copy">
          <span className="nexus-portal__vibe">{app.vibe}</span>
          <h2>{app.name}</h2>
          <p>{app.blurb}</p>
        </div>
        <span className="nexus-portal__cta">
          Enter <span className="nexus-portal__cta-arrow">→</span>
        </span>
      </Link>
    </motion.div>
  );
}

export function CosmicCarousel({ apps }: { apps: readonly AppTile[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const setWidthRef = useRef(0);
  const jumpingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const tiltX = useMotionValue(0);
  const tiltY = useMotionValue(0);
  const springX = useSpring(tiltX, { stiffness: 120, damping: 18 });
  const springY = useSpring(tiltY, { stiffness: 120, damping: 18 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [6, -6]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-8, 8]);

  const items = Array.from({ length: REPEAT }, (_, copy) =>
    apps.map((app, i) => ({ ...app, key: `${copy}-${i}`, index: i })),
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

  const updateActive = useCallback(() => {
    const rail = railRef.current;
    if (!rail || !apps.length) return;
    const tiles = rail.querySelectorAll<HTMLElement>("[data-portal-index]");
    const center = rail.scrollLeft + rail.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    tiles.forEach((el) => {
      const mid = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = Number(el.dataset.portalIndex) || 0;
      }
    });
    setActiveIndex(best);
  }, [apps.length]);

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
    updateActive();
  }, [updateActive]);

  useLayoutEffect(() => {
    updateActive();
  }, [updateActive]);

  return (
    <motion.section
      className="nexus-carousel-wrap"
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        tiltX.set((e.clientX - rect.left) / rect.width - 0.5);
        tiltY.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        tiltX.set(0);
        tiltY.set(0);
      }}
    >
      <div className="nexus-carousel-hint">Swipe the cosmos</div>
      <div ref={railRef} className="nexus-carousel" role="list" onScroll={onScroll}>
        {items.map((app) => {
          const style = {
            background: app.gradient,
            boxShadow: `0 24px 60px ${app.glow}, inset 0 1px 0 rgba(255,255,255,0.12)`,
            "--tile-accent": app.accent,
            "--tile-border": app.border,
            "--tile-glow": app.glow,
            "--tile-icon-bg": app.iconBg,
          } as CSSProperties;

          return (
            <div key={app.key} data-portal-index={app.index} className="nexus-carousel__cell">
              <PortalTile app={app} active={app.index === activeIndex} style={style} />
            </div>
          );
        })}
      </div>
      <div className="nexus-dots" aria-hidden>
        {apps.map((app, i) => (
          <span
            key={app.href}
            className={`nexus-dots__dot ${i === activeIndex ? "nexus-dots__dot--on" : ""}`}
            style={{ "--dot-color": app.accent } as CSSProperties}
          />
        ))}
      </div>
    </motion.section>
  );
}
