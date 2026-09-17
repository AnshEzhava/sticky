/**
 * Password hashing for local accounts.
 *
 * Everything happens in the browser - there is no server and no database.
 * PBKDF2-SHA256 via WebCrypto is used when available (secure contexts); a
 * deterministic iterated fallback keeps the app usable over plain HTTP.
 *
 * This protects against shoulder-surfing a shared browser profile. It is not a
 * security boundary: anyone with access to the browser profile has the data.
 */

import type { PasswordRecord } from "./types";

const PBKDF2_ITERATIONS = 150_000;
const FALLBACK_ITERATIONS = 20_000;
const KEY_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/** URL-safe random id, e.g. `stk_9f2k1c`. */
export function randomId(prefix: string): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(36).padStart(2, "0");
  return prefix + "_" + out.slice(0, 12);
}

function subtleCrypto(): SubtleCrypto | null {
  if (typeof crypto === "undefined") return null;
  return crypto.subtle ?? null;
}

function fallbackDigest(password: string, salt: Uint8Array, iterations: number): Uint8Array {
  const seed = new TextEncoder().encode(password);
  const out = new Uint8Array(KEY_BYTES);
  for (let i = 0; i < out.length; i += 1) {
    let h = 0x811c9dc5 ^ (salt[i % salt.length] ?? 0);
    for (let j = 0; j < seed.length; j += 1) {
      h ^= seed[j];
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    for (let k = 0; k < iterations; k += 1) {
      h ^= (h >>> 7) ^ (k & 0xff);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out[i] = h & 0xff;
  }
  return out;
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ algo: string; hash: string }> {
  const subtle = subtleCrypto();
  if (!subtle) {
    return {
      algo: "FNV1A-ITER",
      hash: toBase64(fallbackDigest(password, salt, iterations)),
    };
  }
  const key = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    KEY_BYTES * 8,
  );
  return { algo: "PBKDF2-SHA256", hash: toBase64(new Uint8Array(bits)) };
}

export async function hashPassword(password: string, saltBase64?: string): Promise<PasswordRecord> {
  const salt = saltBase64 ? fromBase64(saltBase64) : randomBytes(16);
  const iterations = subtleCrypto() ? PBKDF2_ITERATIONS : FALLBACK_ITERATIONS;
  const { algo, hash } = await derive(password, salt, iterations);
  return { algo, iterations, salt: toBase64(salt), hash };
}

export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<boolean> {
  try {
    const salt = fromBase64(record.salt);
    const { hash } = await derive(password, salt, record.iterations);
    return timingSafeEqual(hash, record.hash);
  } catch {
    return false;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
