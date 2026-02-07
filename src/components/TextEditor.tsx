import { useMemo } from "react";
import { marked } from "marked";

interface TextEditorProps {
  text: string;
  preview: boolean;
  onTextChange: (value: string) => void;
  onTogglePreview: () => void;
}

export function TextEditor({ text, preview, onTextChange, onTogglePreview }: TextEditorProps): JSX.Element {
  const html = useMemo(() => marked.parse(text, { breaks: true }), [text]);

  return (
    <div className="text-editor">
      <div className="text-editor-top">
        <button type="button" className="tool-btn" onClick={onTogglePreview}>
          {preview ? "Edit Markdown" : "Preview"}
        </button>
      </div>
      {preview ? (
        <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <textarea
          className="markdown-input"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="# Write notes here"
        />
      )}
    </div>
  );
}
