/*
 * Files attached to a chat message: PDFs, images and text files, the same
 * kinds Journeys read. They go to the AI with that one message and aren't
 * stored; the message keeps a line naming them, which the chat shows as
 * chips and the AI sees in later turns.
 * Shared by the composer (browser) and the messages API (server).
 */

export const CHAT_FILE_TYPES: Record<string, "pdf" | "image" | "text"> = {
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "text/plain": "text",
  "text/markdown": "text",
};

/** For the file picker. */
export const CHAT_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,application/pdf,image/*,text/plain,text/markdown";

export const MAX_CHAT_FILES = 3;
export const MAX_CHAT_FILE_BYTES = 8 * 1024 * 1024;

export const CHAT_FILES_HINT = "PDF, image (PNG, JPG, WebP, GIF) or text file, up to 8 MB";

/** Browsers leave .md files untyped. */
export function chatFileType(file: { name: string; type: string }) {
  return file.type || (file.name.toLowerCase().endsWith(".md") ? "text/markdown" : "");
}

/** Why a file can't be attached, or null if it can. */
export function chatFileProblem(file: { name: string; type: string; size: number }) {
  if (!CHAT_FILE_TYPES[chatFileType(file)]) {
    return `"${file.name}" can't be attached. Use a ${CHAT_FILES_HINT}.`;
  }
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_CHAT_FILE_BYTES) return `"${file.name}" is over 8 MB.`;
  return null;
}

const ATTACHED_LINE = /\n*\[Attached: ([^\]\n]+)\]\s*$/;
const SEPARATOR = " | ";

/** The stored message: what was typed, plus a line naming the files. */
export function withAttachedLine(text: string, fileNames: string[]) {
  if (fileNames.length === 0) return text;
  // Names can't contain the characters that end the line or split it.
  const names = fileNames.map((n) => n.replace(/[\]\n|]/g, " ").trim().slice(0, 120));
  const line = `[Attached: ${names.join(SEPARATOR)}]`;
  return text ? `${text}\n\n${line}` : line;
}

/** Splits a stored message back into its text and attached file names. */
export function splitAttachedLine(content: string): { text: string; files: string[] } {
  const match = ATTACHED_LINE.exec(content);
  if (!match) return { text: content, files: [] };
  return {
    text: content.slice(0, match.index).trimEnd(),
    files: match[1].split(SEPARATOR).map((n) => n.trim()).filter(Boolean),
  };
}
