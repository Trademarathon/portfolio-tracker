/**
 * Local Whisper transcription using Transformers.js - no API or server required.
 * Runs entirely in the browser. First use downloads ~39MB model (cached).
 */

const WHISPER_MODEL = "Xenova/whisper-tiny";

 
let transcriberPromise: Promise<any> | null = null;

function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline } = await import("@xenova/transformers");
      return pipeline("automatic-speech-recognition", WHISPER_MODEL, {
        progress_callback: (p: { status?: string }) => {
          if (p?.status) console.log("[Whisper]", p.status);
        },
      });
    })();
  }
  return transcriberPromise;
}

/** Transcribe audio blob using local Whisper model. Returns transcribed text or empty string. */
export async function transcribeLocal(blob: Blob): Promise<string> {
  if (typeof window === "undefined") throw new Error("transcribeLocal only available in browser");

  const transcriber = await getTranscriber();
  const url = URL.createObjectURL(blob);

  try {
    const output = await transcriber(url);

    if (typeof output === "string") return output.trim();
    if (output?.text) return String(output.text).trim();
    if (Array.isArray(output?.chunk) && output.chunk.length > 0) {
      return output.chunk.map((c: { text?: string }) => c?.text ?? "").join(" ").trim();
    }
    if (output && typeof output === "object" && "text" in output) {
      return String((output as { text: unknown }).text || "").trim();
    }
    return "";
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Check if local Whisper is available (browser + WASM support) */
export function isLocalWhisperAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator.mediaDevices && window.MediaRecorder && typeof WebAssembly !== "undefined");
}
