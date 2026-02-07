import { useDeferredValue, useMemo } from "react";
import { marked } from "marked";

interface TextEditorProps {
  text: string;
  preview: boolean;
  onTextChange: (value: string) => void;
  onTogglePreview: () => void;
}

export function TextEditor({ text, preview, onTextChange, onTogglePreview }: TextEditorProps): JSX.Element {
  const deferredText = useDeferredValue(text);
  const html = useMemo(() => marked.parse(deferredText, { breaks: true }), [deferredText]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-100 p-3">
        <button type="button" className="btn" onClick={onTogglePreview}>
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {preview ? (
        <div className="markdown-body overflow-auto p-6" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <textarea
          className="h-full min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-6 text-sm leading-6 text-slate-800 outline-none"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="# Write notes here"
        />
      )}
    </div>
  );
}
