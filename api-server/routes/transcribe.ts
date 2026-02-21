import type { Request, Response } from "express";
import FormData from "form-data";

const ENV_OPENAI_KEY = process.env.OPENAI_API_KEY;

function getApiKey(req: Request): string | null {
  const headerKey = req.headers["x-openai-api-key"] as string | undefined;
  if (headerKey?.trim()) return headerKey.trim();
  if (ENV_OPENAI_KEY?.trim()) return ENV_OPENAI_KEY;
  return null;
}

export async function getHandler(req: Request, res: Response) {
  const key = getApiKey(req);
  res.json({ whisperAvailable: !!key && key.length > 0 });
}

export async function postHandler(req: Request, res: Response) {
  const apiKey = getApiKey(req);
  if (!apiKey) {
    return res.status(503).json({
      error: "Whisper not configured. Add OPENAI_API_KEY in Settings > Security or to .env",
    });
  }
  try {
    const file = (req as any).file;
    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No audio file provided" });
    }
    const type = file.mimetype?.toLowerCase() || "";
    const allowed = ["webm", "mp4", "mpeg", "mpga", "m4a", "wav", "mp3"];
    if (!allowed.some((fmt) => type.includes(fmt))) {
      return res.status(400).json({
        error: `Unsupported audio format: ${type || "unknown"}. Use webm, mp4, or wav.`,
      });
    }
    const form = new FormData();
    form.append("file", file.buffer, { filename: file.originalname || "recording.webm" });
    form.append("model", "whisper-1");
    form.append("response_format", "text");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...form.getHeaders(),
      },
      body: form as any,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err || `Whisper API error: ${response.status}` });
    }
    const text = await response.text();
    res.json({ text: (text || "").trim() });
  } catch (e) {
    console.error("[transcribe]", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Transcription failed" });
  }
}
