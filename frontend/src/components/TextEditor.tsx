import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, MoveDiagonal2, RotateCcw, Send, Square, X } from "lucide-react";
import { marked } from "marked";
import katex from "katex";
import type { ChatMessage } from "../types";

interface TextEditorProps {
  messages: ChatMessage[];
  onSendMessage: (value: string) => Promise<void>;
  onStopGenerating: () => void;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onClearChat: () => void;
  isSending: boolean;
  errorMessage: string | null;
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onHeaderResizePointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  showResizeHandle?: boolean;
}

marked.setOptions({
  gfm: true,
  breaks: true,
});

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownWithLatexToHtml(raw: string): string {
  const mathTokens: Array<{ token: string; html: string }> = [];
  let tokenIndex = 0;

  const withMathTokens = raw
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, expr: string) => {
      const token = `KATEXBLOCKTOKEN${tokenIndex++}END`;
      const html = `<div class="chat-math-block">${katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true })}</div>`;
      mathTokens.push({ token, html });
      return token;
    })
    .replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g, (_, expr: string) => {
      const token = `KATEXINLINETOKEN${tokenIndex++}END`;
      const html = katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false });
      mathTokens.push({ token, html });
      return token;
    });

  let html = marked.parse(escapeHtml(withMathTokens)) as string;

  for (const item of mathTokens) {
    html = html.split(item.token).join(item.html);
  }

  return html;
}

export function TextEditor({
  messages,
  onSendMessage,
  onStopGenerating,
  onClose,
  collapsed,
  onToggleCollapsed,
  onClearChat,
  isSending,
  errorMessage,
  onHeaderPointerDown,
  onHeaderResizePointerDown,
  isDragging = false,
  showResizeHandle = true,
}: TextEditorProps): JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isSending]);

  const handleSubmit = async () => {
    const clean = inputValue.trim();
    if (!clean || isSending) {
      return;
    }
    setInputValue("");
    await onSendMessage(clean);
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div
        className={`flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-2 py-1.5 ${onHeaderPointerDown ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        {showResizeHandle ? (
          <div
            className="cursor-nwse-resize select-none p-1 text-slate-500"
            onPointerDown={onHeaderResizePointerDown}
            title="Resize chat"
          >
            <MoveDiagonal2 size={15} />
          </div>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClearChat}
            title="Clear chat"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            onClick={onClose}
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-auto px-3 py-3">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                Ask a question about this note.
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div
                      className="markdown-body chat-markdown"
                      dangerouslySetInnerHTML={{ __html: markdownWithLatexToHtml(message.content) }}
                    />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isSending && messages.length > 0 && messages[messages.length - 1]?.content.trim().length === 0 ? (
              <div className="text-xs text-slate-500">Thinking...</div>
            ) : null}
          </div>

          {errorMessage ? (
            <div className="px-3 pb-2 text-xs text-red-600">{errorMessage}</div>
          ) : null}

          <div className="border-t border-slate-100 p-3">
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[40px] max-h-28 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-cyan-500 focus:ring-2"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Type a message..."
              />
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  if (isSending) {
                    onStopGenerating();
                    return;
                  }
                  void handleSubmit();
                }}
                disabled={!isSending && !inputValue.trim()}
                title={isSending ? "Stop generating" : "Send message"}
              >
                {isSending ? <Square size={16} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
