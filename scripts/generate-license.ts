#!/usr/bin/env npx tsx
/**
 * Generate license tokens for Trade Marathon®.
 * Usage: npx tsx scripts/generate-license.ts --expiry=2026-03-12 --tier=yearly
 * Or:    npx tsx scripts/generate-license.ts --expiry=2026-02-12 --tier=monthly
 *
 * Secret must match src/lib/license/token.ts LICENSE_SECRET
 */

import * as crypto from "crypto";

const PREFIX = "TM-";
const LICENSE_SECRET = "TM_LICENSE_SIGN_2025";

function b64Encode(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function computeHmac(exp: string, tier: string): string {
  const payload = `${exp}:${tier}`;
  return crypto.createHmac("sha256", LICENSE_SECRET).update(payload).digest("hex");
}

function generateToken(expiryDate: Date, tier: "monthly" | "yearly"): string {
  const exp = Math.floor(expiryDate.getTime() / 1000);
  const expStr = String(exp);
  const expB64 = b64Encode(expStr);
  const tierB64 = b64Encode(tier);
  const hmac = computeHmac(expStr, tier);
  return `${PREFIX}${expB64}-${tierB64}-${hmac}`;
}

function parseArgs(): { expiry: Date; tier: "monthly" | "yearly" } {
  const args = process.argv.slice(2);
  let expiryStr = "";
  let tier: "monthly" | "yearly" = "monthly";

  for (const arg of args) {
    if (arg.startsWith("--expiry=")) {
      expiryStr = arg.slice("--expiry=".length);
    } else if (arg.startsWith("--tier=")) {
      const t = arg.slice("--tier=".length).toLowerCase();
      if (t === "yearly" || t === "year") tier = "yearly";
      else if (t === "monthly" || t === "month") tier = "monthly";
    }
  }

  if (!expiryStr) {
    console.error("Usage: npx tsx scripts/generate-license.ts --expiry=YYYY-MM-DD --tier=monthly|yearly");
    process.exit(1);
  }

  const expiry = new Date(expiryStr);
  if (isNaN(expiry.getTime())) {
    console.error("Invalid expiry date. Use YYYY-MM-DD format.");
    process.exit(1);
  }

  return { expiry, tier };
}

const { expiry, tier } = parseArgs();
const token = generateToken(expiry, tier);

console.log("\n=== Trade Marathon® License Token ===\n");
console.log("Token:", token);
console.log("\nExpires:", expiry.toISOString().split("T")[0]);
console.log("Tier:", tier);
console.log("\nSend this token to your customer. They paste it into the app to activate.\n");
