"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; z: number; size: number; hue: number };
type Comet = { x: number; y: number; vx: number; vy: number; life: number };

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current!;
    const ctx = el.getContext("2d")!;

    let w = 0;
    let h = 0;
    let frame = 0;
    let raf = 0;
    const stars: Star[] = [];
    const comets: Comet[] = [];
    let pointer = { x: 0.5, y: 0.5 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      stars.length = 0;
      for (let i = 0; i < 140; i++) {
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(),
          size: 0.4 + Math.random() * 1.8,
          hue: Math.random() * 60 + 140,
        });
      }
    }

    function maybeComet() {
      if (Math.random() > 0.012) return;
      comets.push({
        x: Math.random() * w * 0.6,
        y: Math.random() * h * 0.35,
        vx: 4 + Math.random() * 5,
        vy: 1.5 + Math.random() * 2,
        life: 1,
      });
    }

    function draw() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      const driftX = (pointer.x - 0.5) * 18;
      const driftY = (pointer.y - 0.5) * 12;

      for (const s of stars) {
        const twinkle = 0.55 + Math.sin(frame * 0.02 + s.x) * 0.45;
        const px = s.x + driftX * (1 - s.z);
        const py = s.y + driftY * (1 - s.z);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${s.hue}, 90%, 78%, ${twinkle * (0.25 + s.z * 0.75)})`;
        ctx.arc(px, py, s.size * (0.6 + s.z), 0, Math.PI * 2);
        ctx.fill();
      }

      maybeComet();
      for (let i = comets.length - 1; i >= 0; i--) {
        const c = comets[i];
        c.x += c.vx;
        c.y += c.vy;
        c.life -= 0.018;
        if (c.life <= 0) {
          comets.splice(i, 1);
          continue;
        }
        const grad = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 8, c.y - c.vy * 8);
        grad.addColorStop(0, `rgba(180, 255, 240, ${c.life * 0.9})`);
        grad.addColorStop(1, "rgba(180, 255, 240, 0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x - c.vx * 8, c.y - c.vy * 8);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    }

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    resize();
    seed();
    draw();
    window.addEventListener("resize", () => {
      resize();
      seed();
    });
    window.addEventListener("pointermove", onMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="nexus-starfield" aria-hidden />;
}
