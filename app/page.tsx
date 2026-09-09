"use client";

import { AppCarousel } from "@/components/launcher/AppCarousel";
import { STUDIO_APPS } from "@/lib/apps/catalog";

export default function StartPage() {
  return (
    <main className="start-page">
      <div className="start-page__atmosphere" aria-hidden />
      <header className="start-page__header">
        <p className="start-page__brand">Studio</p>
        <h1 className="start-page__title">Your apps</h1>
        <p className="start-page__sub">Pick one to open. Swipe forever — it loops.</p>
      </header>

      <AppCarousel apps={STUDIO_APPS} />
    </main>
  );
}
