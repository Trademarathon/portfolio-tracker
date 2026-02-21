import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

type SocialTokenRecord = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  username?: string;
};

type SocialStore = {
  x?: SocialTokenRecord;
};

const STORE_DIR = path.join(os.homedir(), ".trade-marathon");
const STORE_PATH = path.join(STORE_DIR, "social.enc");
const KEY_SOURCE = process.env.SOCIAL_STORE_SECRET || process.env.X_CLIENT_SECRET || "tm-social-dev-key";

function deriveKey(): Buffer {
  return crypto.createHash("sha256").update(KEY_SOURCE).digest();
}

function encrypt(payload: string): string {
  const iv = crypto.randomBytes(12);
  const key = deriveKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(blob: string): string {
  const raw = Buffer.from(blob, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const key = deriveKey();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}

function readStore(): SocialStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const enc = fs.readFileSync(STORE_PATH, "utf8");
    const json = decrypt(enc);
    return JSON.parse(json || "{}") as SocialStore;
  } catch {
    return {};
  }
}

function writeStore(store: SocialStore) {
  if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
  const payload = JSON.stringify(store);
  const enc = encrypt(payload);
  fs.writeFileSync(STORE_PATH, enc, "utf8");
}

export function getSocialTokens(provider: "x"): SocialTokenRecord | null {
  const store = readStore();
  return store[provider] || null;
}

export function setSocialTokens(provider: "x", tokens: SocialTokenRecord) {
  const store = readStore();
  store[provider] = tokens;
  writeStore(store);
}

export function clearSocialTokens(provider: "x") {
  const store = readStore();
  delete store[provider];
  writeStore(store);
}
