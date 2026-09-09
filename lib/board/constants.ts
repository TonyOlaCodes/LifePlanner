export const WALL_W = 2800;
export const WALL_H = 2000;

export const STICKY_COLORS = [
  { id: "yellow", fill: "#FFF066", edge: "#F5DC00", shadow: "rgba(180, 150, 0, 0.35)" },
  { id: "pink", fill: "#FFB3C1", edge: "#FF8FAB", shadow: "rgba(200, 80, 110, 0.35)" },
  { id: "mint", fill: "#BDF7C8", edge: "#80ED99", shadow: "rgba(60, 160, 90, 0.35)" },
  { id: "sky", fill: "#A0C4FF", edge: "#6BAEFF", shadow: "rgba(60, 120, 220, 0.35)" },
  { id: "peach", fill: "#FFD6A5", edge: "#FFB347", shadow: "rgba(200, 130, 40, 0.35)" },
] as const;

export type DrawTool = "select" | "pen" | "marker" | "paint" | "eraser";

export const TOOL_WIDTH: Record<DrawTool, number> = {
  select: 0,
  pen: 2,
  marker: 10,
  paint: 22,
  eraser: 28,
};

export const PALETTE = [
  "#FFFFFF",
  "#000000",
  "#FB7185",
  "#FBBF24",
  "#6EE7B7",
  "#38BDF8",
  "#A78BFA",
  "#F97316",
];

export function stickyPreset(id: string) {
  return STICKY_COLORS.find((c) => c.id === id) || STICKY_COLORS[0];
}

export function randomStickyColor() {
  return STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
}
