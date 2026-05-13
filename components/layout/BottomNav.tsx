"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, CalendarDays, BarChart2, BookOpen, Settings, Target } from "lucide-react";

const TABS = [
  { href: "/",          icon: Home,         label: "Home" },
  { href: "/habits",    icon: Flame,        label: "Habits" },
  { href: "/planner",   icon: CalendarDays, label: "Tasks" },
  { href: "/focus",     icon: Target,       label: "Focus" },
  { href: "/journal",   icon: BookOpen,     label: "Journal" },
  { href: "/settings",  icon: Settings,     label: "Settings" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-around", paddingTop: 10, paddingBottom: 10 }}>
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                padding: "4px 10px",
                borderRadius: 12,
                textDecoration: "none",
                transition: "all 0.2s ease",
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  background: active ? "var(--accent)" : "transparent",
                  transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: active ? "scale(1.05)" : "scale(1)",
                }}
              >
                <Icon
                  size={18}
                  style={{
                    color: active ? "#000" : "rgba(255,255,255,0.4)",
                    strokeWidth: active ? 2.5 : 2,
                    transition: "color 0.2s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 400,
                  color: active ? "var(--accent)" : "rgba(255,255,255,0.35)",
                  letterSpacing: 0.2,
                  transition: "color 0.2s ease",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
