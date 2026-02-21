"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { apiUrl } from "@/lib/api/client";
import { recordAIUsageMinimal } from "@/lib/api/ai-usage";
import { transcribeLocal, isLocalWhisperAvailable } from "@/lib/transcribeLocal";

export interface UseVoiceRecognitionOptions {
  /** Language for recognition (default: en-US) - used by Web Speech API */
  lang?: string;
  /** Show interim results while speaking (default: true) - Web Speech only */
  interimResults?: boolean;
  /** Called when transcript is updated (interim or final) */
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  /** Force Whisper mode (record → transcribe). Uses local model (free) or OpenAI API if set. Falls back to Web Speech if unavailable. */
  preferWhisper?: boolean;
}

/** Check if the browser supports speech recognition (Web Speech API) */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

/** Check if MediaRecorder is supported (for Whisper flow) */
export function isMediaRecorderSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && window.MediaRecorder);
}

/** Hook for voice recording and transcription - Whisper flow (record → transcribe) or Web Speech API */
export function useVoiceRecognition(options: UseVoiceRecognitionOptions = {}) {
  const {
    lang = "en-US",
    interimResults = true,
    onTranscript,
    preferWhisper = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [whisperAvailable, setWhisperAvailable] = useState<boolean | null>(null);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Check support on mount
  useEffect(() => {
    setIsSupported(isSpeechRecognitionSupported() || isMediaRecorderSupported());
  }, []);

  // Check if Whisper is available: local (free, no API) or OpenAI API
  useEffect(() => {
    if (!preferWhisper) {
      setWhisperAvailable(false);
      return;
    }
    if (isLocalWhisperAvailable()) {
      setWhisperAvailable(true);
      return;
    }
    const clientKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key")?.trim() : null;
    const headers: Record<string, string> = {};
    if (clientKey) headers["x-openai-api-key"] = clientKey;

    fetch(apiUrl("/api/transcribe"), { headers })
      .then((r) => r.json())
      .then((data) => setWhisperAvailable(data.whisperAvailable === true))
      .catch(() => setWhisperAvailable(false));

    const onKeyChange = () => {
      if (isLocalWhisperAvailable()) {
        setWhisperAvailable(true);
        return;
      }
      const key = localStorage.getItem("openai_api_key")?.trim();
      fetch(apiUrl("/api/transcribe"), { headers: key ? { "x-openai-api-key": key } : {} })
        .then((r) => r.json())
        .then((data) => setWhisperAvailable(data.whisperAvailable === true))
        .catch(() => setWhisperAvailable(false));
    };
    window.addEventListener("openai-api-key-changed", onKeyChange);
    return () => window.removeEventListener("openai-api-key-changed", onKeyChange);
  }, [preferWhisper]);

  const useWhisper = whisperAvailable === true;

  const startWebSpeech = useCallback((initialText = "") => {
    const SpeechRecognitionAPI =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    setError(null);
    setTranscript(initialText);

    const recognition = new SpeechRecognitionAPI() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      abort: () => void;
      onresult: ((event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
      onerror: ((event: { error: string; message?: string }) => void) | null;
      onend: (() => void) | null;
    };
    recognition.continuous = true;
    recognition.interimResults = interimResults;
    recognition.lang = lang;

    recognition.onresult = (event: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptPart = result[0]?.transcript ?? "";
        if (result.isFinal) finalTranscript += transcriptPart + " ";
        else interimTranscript += transcriptPart;
      }
      setTranscript((prev) => {
        const base = prev.trim();
        const newFinal = finalTranscript.trim();
        const combined = newFinal ? (base ? `${base} ${newFinal}` : newFinal).trim() : base;
        const full = combined + (interimTranscript ? ` ${interimTranscript}` : "");
        onTranscript?.(full, !interimTranscript);
        return full;
      });
    };

    recognition.onerror = (event: { error: string; message?: string }) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      setError(event.message || `Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = { stop: () => recognition.stop(), abort: () => recognition.abort() };
    recognition.start();
    setIsListening(true);
  }, [lang, interimResults, onTranscript]);

  const startWhisper = useCallback(async (initialText: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access not available");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunksRef.current.length === 0) {
          setIsListening(false);
          setError("No audio recorded");
          return;
        }
        setIsTranscribing(true);
        setError(null);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        try {
          let text = "";
          if (isLocalWhisperAvailable()) {
            text = await transcribeLocal(blob);
          }
          if (!text) {
            const clientKey = typeof window !== "undefined" ? localStorage.getItem("openai_api_key")?.trim() : null;
            const headers: Record<string, string> = {};
            if (clientKey) headers["x-openai-api-key"] = clientKey;
            const formData = new FormData();
            formData.append("file", blob, "recording.webm");
            const res = await fetch(apiUrl("/api/transcribe"), {
              method: "POST",
              headers: Object.keys(headers).length ? headers : undefined,
              body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Transcription failed");
            text = (data.text || "").trim();
            try {
              recordAIUsageMinimal("openai", "whisper_transcribe", data?.model);
            } catch {
              // ignore
            }
          }
          const full = initialText ? `${initialText.trim()} ${text}`.trim() : text;
          setTranscript(full);
          onTranscript?.(full, true);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Transcription failed");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
      setError(null);
      setTranscript(initialText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access denied");
    }
  }, [onTranscript]);

  const startListening = useCallback((initialText = "") => {
    if (!isSupported) {
      setError("Voice input not supported. Try Chrome or Edge.");
      return;
    }
    if (preferWhisper && whisperAvailable === false) {
      setError("Voice transcription unavailable. Enable microphone or add OpenAI API key in Settings > Security.");
      return;
    }
    if (useWhisper) {
      startWhisper(initialText);
    } else {
      startWebSpeech(initialText);
    }
  }, [isSupported, preferWhisper, whisperAvailable, useWhisper, startWhisper, startWebSpeech]);

  const stopListening = useCallback(() => {
    if (useWhisper && mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [useWhisper]);

  const toggleListening = useCallback((initialText = "") => {
    if (isListening) {
      stopListening();
    } else {
      startListening(initialText);
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    isListening,
    isTranscribing,
    transcript,
    error,
    isSupported,
    useWhisper: !!useWhisper,
    startListening,
    stopListening,
    toggleListening,
    setTranscript,
  };
}
