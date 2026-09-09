export type RoomApp = "wave-lock" | "poll" | "board";

export type Player = {
  id: string;
  name: string;
  ready: boolean;
  lastSeen: number;
  color: string;
};

export type WaveLockPhase = "lobby" | "countdown" | "playing" | "round-result" | "finished";

export type WaveLockState = {
  phase: WaveLockPhase;
  round: number;
  maxRounds: number;
  phaseStartedAt: number;
  /** ms offset from phase start when each player tapped */
  presses: Record<string, number | null>;
  roundSyncMs: number | null;
  roundScores: number[];
  totalScore: number;
  countdown: number;
};

export type PollState = {
  question: string;
  options: string[];
  votes: Record<string, number>;
  voted: Record<string, number>;
};

export type BoardStroke = {
  id: string;
  authorId: string;
  tool: "pen" | "marker" | "paint" | "eraser";
  color: string;
  width: number;
  points: { x: number; y: number }[];
  createdAt: number;
};

export type BoardNote = {
  id: string;
  authorId: string;
  authorName: string;
  /** sticky preset id e.g. yellow, pink */
  color: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
};

export type BoardState = {
  wallWidth: number;
  wallHeight: number;
  notes: BoardNote[];
  strokes: BoardStroke[];
};

export type Room = {
  id: string;
  app: RoomApp;
  hostId: string;
  players: Player[];
  /** Players removed by the host cannot rejoin. */
  bannedIds?: string[];
  createdAt: number;
  updatedAt: number;
  waveLock?: WaveLockState;
  poll?: PollState;
  board?: BoardState;
};

export type RoomSnapshot = Room & { serverNow: number };
