import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartBlock } from "@/components/chart-block";

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1">{children}</p>,
          h1: ({ children }) => (
            <h1 className="mt-3 mb-1 font-display text-lg font-semibold text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-3 mb-1 font-display text-base font-semibold text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2 mb-1 font-display text-sm font-semibold text-foreground">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-1 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#ff6791] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-[#ff6791]/50 pl-3 text-foreground/80">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-2 border-card-border" />,
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-card-border">
              <table className="w-full border-collapse text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-foreground/5">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-card-border px-2.5 py-1.5 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-card-border px-2.5 py-1.5 align-top">
              {children}
            </td>
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-(\w+)/.exec(className ?? "");
            const language = match?.[1];
            const raw = String(children).replace(/\n$/, "");

            if (language === "chart") {
              return <ChartBlock raw={raw} />;
            }

            if (language) {
              return (
                <pre className="my-1 overflow-x-auto rounded-lg border border-card-border bg-card p-3 text-xs">
                  <code>{raw}</code>
                </pre>
              );
            }

            return (
              <code className="rounded bg-foreground/10 px-1 py-0.5 text-[0.85em]">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
