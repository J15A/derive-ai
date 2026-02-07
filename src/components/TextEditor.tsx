interface TextEditorProps {
  text: string;
  onTextChange: (value: string) => void;
  onClose: () => void;
}

export function TextEditor({ text, onTextChange, onClose }: TextEditorProps): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-end border-b border-slate-100 p-2">
        <button type="button" className="btn h-8 px-2" onClick={onClose}>
          Exit
        </button>
      </div>
      <textarea
        className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent p-6 text-sm leading-6 text-slate-800 outline-none"
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="# Write notes here"
      />
    </div>
  );
}
