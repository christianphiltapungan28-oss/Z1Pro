/*
 * "Z1p" is said "zip", so that's what speech recognition writes down, with
 * the odd variant ("zipp", "z1p"). Like Siri, the name has to open what you
 * say (after a "hey", "ok" or "um" at most), so "what's the zip code" in
 * passing conversation doesn't wake it, and whole words only, so "zipper"
 * doesn't either.
 */
const NAME = String.raw`(?:z1p|z\s?1\s?p|zipp?)\b[\s,.!?]*`;
const LEAD_IN = String.raw`^\s*(?:(?:hey|hi|ok|okay|um|uh|oh|so)[\s,]+){0,2}`;
const WAKE_WORD = new RegExp(LEAD_IN + NAME, "i");

/**
 * If `text` opens with the wake word, returns what was said after it
 * (possibly empty: "Zip" alone, with the question still to come).
 * Otherwise null.
 */
export function afterWakeWord(text: string): string | null {
  const match = WAKE_WORD.exec(text);
  if (!match) return null;
  return text.slice(match[0].length).trim();
}

/** Drops a leading "Zip", for follow-ups where saying it is optional. */
export function stripWakeWord(text: string): string {
  return afterWakeWord(text) ?? text.trim();
}

/** The part of the Web Speech API used here (TypeScript's DOM types lack it). */
export interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export type RecognitionCtor = new () => SpeechRecognition;

/** The browser's speech recognition, if it has one (Chrome, Edge, Safari). */
export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
