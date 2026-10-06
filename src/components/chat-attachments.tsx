"use client";

import { useRef, useState } from "react";
import { CloseIcon, PlusIcon } from "@/components/icons";
import { CHAT_FILE_ACCEPT, chatFileProblem, MAX_CHAT_FILES } from "@/lib/chat-attachments";

/** A message about to be sent: what was typed and any attached files. */
export type Outgoing = { content: string; files: File[] };

/** The files picked for the next message, checked as they're added. */
export function useChatAttachments() {
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  function add(picked: FileList | File[]) {
    const next = [...files];
    let issue: string | null = null;
    for (const file of Array.from(picked)) {
      const why = chatFileProblem(file);
      if (why) issue = why;
      else if (next.length >= MAX_CHAT_FILES)
        issue = `You can attach up to ${MAX_CHAT_FILES} files to a message.`;
      else next.push(file);
    }
    setFiles(next);
    setProblem(issue);
  }

  function remove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setProblem(null);
  }

  function clear() {
    setFiles([]);
    setProblem(null);
  }

  /** Puts files back, e.g. after a failed send. */
  function restore(previous: File[]) {
    setFiles(previous);
  }

  return { files, problem, add, remove, clear, restore };
}

/** The request for sending a message: JSON, or multipart when files are attached. */
export function messageRequest({ content, files }: Outgoing): RequestInit {
  if (files.length === 0) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    };
  }
  const form = new FormData();
  form.append("content", content);
  for (const file of files) form.append("files", file, file.name);
  return { method: "POST", body: form };
}

/** The "+" button that opens the file picker. */
export function AttachButton({
  onPick,
  disabled,
  className = "",
}: {
  onPick: (files: FileList) => void;
  disabled?: boolean;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={disabled}
        aria-label="Attach a file, document or image"
        title="Attach a file, document or image"
        className={`flex shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground disabled:opacity-40 ${className}`}
      >
        <PlusIcon className="h-4.5 w-4.5" />
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept={CHAT_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onPick(e.target.files);
          // Picking the same file again after removing it still fires.
          e.target.value = "";
        }}
      />
    </>
  );
}

function kindOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "Image";
  if (ext === "pdf") return "PDF";
  return "Text";
}

function FileGlyph({ name }: { name: string }) {
  return (
    <span className="flex h-6 shrink-0 items-center rounded-md bg-accent/10 px-1.5 text-[10px] font-bold uppercase text-accent">
      {kindOf(name)}
    </span>
  );
}

/** Picked files above the composer, each removable. */
export function AttachmentChips({
  files,
  onRemove,
  className = "",
}: {
  files: File[];
  onRemove: (index: number) => void;
  className?: string;
}) {
  if (files.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Attached files">
      {files.map((file, i) => (
        <li
          key={`${file.name}-${file.size}-${i}`}
          className="flex max-w-[240px] items-center gap-2 rounded-xl border border-divider bg-background py-1.5 pr-1.5 pl-2 text-sm text-foreground"
        >
          <FileGlyph name={file.name} />
          <span className="min-w-0 truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={`Remove ${file.name}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 hover:text-foreground"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The files a sent message had attached, inside its bubble. */
export function SentAttachments({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Attached files">
      {names.map((name, i) => (
        <li
          key={`${name}-${i}`}
          className="flex max-w-full items-center gap-1.5 rounded-lg bg-white/20 px-2 py-1 text-xs font-medium"
        >
          <span className="text-[10px] font-bold uppercase opacity-80">{kindOf(name)}</span>
          <span className="min-w-0 truncate">{name}</span>
        </li>
      ))}
    </ul>
  );
}
