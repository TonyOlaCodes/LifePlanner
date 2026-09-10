"use client";

import { CosmicCarousel } from "@/components/launcher/CosmicCarousel";
import { NexusHero } from "@/components/launcher/NexusHero";
import { Starfield } from "@/components/launcher/Starfield";
import { STUDIO_APPS } from "@/lib/apps/catalog";

export default function StartPage() {
  return (
    <main className="nexus-page">
      <Starfield />
      <div className="nexus-aurora" aria-hidden />
      <div className="nexus-scanlines" aria-hidden />
      <NexusHero />
      <CosmicCarousel apps={STUDIO_APPS} />
      <footer className="nexus-footer">
        <span>NEXUS</span>
        <span className="nexus-footer__pulse" />
        <span>Always on</span>
      </footer>
    </main>
  );
}
