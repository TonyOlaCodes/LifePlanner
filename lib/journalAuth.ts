/** PBKDF2-based journal lock. Legacy installs stored plaintext in `journalPassword`; we migrate on successful unlock. */

const PREFIX = "lockin$v1$";
const ITERATIONS = 120000;

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isJournalAuthHashed(stored: string | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}

function copyToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}

export async function hashJournalPassword(plain: string): Promise<string> {
  const saltU8 = crypto.getRandomValues(new Uint8Array(16));
  const salt = copyToArrayBuffer(saltU8);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"]);
  const hashBuf = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const hash = new Uint8Array(hashBuf);
  return `${PREFIX}${ITERATIONS}$${bytesToB64(new Uint8Array(saltU8))}$${bytesToB64(hash)}`;
}

export async function verifyJournalPassword(plain: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  if (!isJournalAuthHashed(stored)) {
    return plain === stored;
  }
  const rest = stored.slice(PREFIX.length);
  const firstSep = rest.indexOf("$");
  const iterStr = rest.slice(0, firstSep);
  const afterIter = rest.slice(firstSep + 1);
  const secondSep = afterIter.indexOf("$");
  const saltB64 = afterIter.slice(0, secondSep);
  const hashB64 = afterIter.slice(secondSep + 1);
  const iterations = parseInt(iterStr, 10);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  const saltU8 = b64ToBytes(saltB64);
  const salt = copyToArrayBuffer(saltU8);
  const expected = b64ToBytes(hashB64);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"]);
  const hashBuf = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  const actual = new Uint8Array(hashBuf);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

export async function upgradeLegacyJournalPasswordIfNeeded(plain: string, stored: string | undefined): Promise<void> {
  if (!stored || isJournalAuthHashed(stored)) return;
  if (plain !== stored) return;
  const { db } = await import("./db");
  const hashed = await hashJournalPassword(plain);
  await db.settings.update(1, { journalPassword: hashed });
}
