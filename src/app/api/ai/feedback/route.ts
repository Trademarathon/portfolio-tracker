import { NextResponse } from "next/server";
import { mkdir, appendFile } from "fs/promises";
import path from "path";

type AISignalFeedback = {
  signalId: string;
  feature?: string;
  verdict?: string;
  severity?: string;
  feedback: "helpful" | "wrong" | "unsafe";
  source?: string;
  timestamp?: number;
};

const FEEDBACK_VALUES = new Set<AISignalFeedback["feedback"]>(["helpful", "wrong", "unsafe"]);

function sanitize(value: unknown, max = 80): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function parsePayload(raw: unknown): AISignalFeedback | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const signalId = sanitize(body.signalId, 128);
  const feedback = sanitize(body.feedback, 16) as AISignalFeedback["feedback"];
  if (!signalId || !FEEDBACK_VALUES.has(feedback)) return null;
  return {
    signalId,
    feature: sanitize(body.feature, 64),
    verdict: sanitize(body.verdict, 24),
    severity: sanitize(body.severity, 24),
    feedback,
    source: sanitize(body.source, 64),
    timestamp: Number.isFinite(Number(body.timestamp))
      ? Number(body.timestamp)
      : Date.now(),
  };
}

export async function POST(req: Request) {
  try {
    const payload = parsePayload(await req.json().catch(() => null));
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Invalid feedback payload" }, { status: 400 });
    }

    const storageDir = path.join(process.cwd(), "data");
    const storageFile = path.join(storageDir, "ai-feedback.ndjson");
    await mkdir(storageDir, { recursive: true });
    await appendFile(storageFile, `${JSON.stringify(payload)}\n`, "utf8");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to store feedback",
      },
      { status: 500 }
    );
  }
}
