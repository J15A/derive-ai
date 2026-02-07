# Derive AI Notebook

Pen-first note taking app built with React 18 + TypeScript + Vite.

## Features

- Multi-note notebook with sidebar
- Create, rename, delete, and search notes by title
- Note editor with `Ink` and `Text` tabs
- Pointer Events ink engine for stylus, touch, and mouse
- Pressure-sensitive smoothing via `perfect-freehand`
- Pan tool, eraser (real stroke deletion), undo/redo, clear ink
- Offline autosave in IndexedDB via `Dexie`
- Export ink as PNG
- Export/import full note bundle JSON (`title + markdown + vector strokes + PNG preview`)
- Keyboard shortcuts:
  - `Ctrl/Cmd + N` new note
  - `Ctrl/Cmd + Z` undo ink
  - `Ctrl/Cmd + Shift + Z` redo ink

## Setup

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Folder Structure

- `src/components`
  - `Sidebar.tsx`
  - `NoteEditor.tsx`
  - `InkCanvas.tsx`
  - `Toolbar.tsx`
  - `TextEditor.tsx`
- `src/store`
  - `noteStore.ts` (Zustand state + actions)
- `src/db`
  - `database.ts` (Dexie schema and queries)
- `src/utils`
  - `ink.ts` (stroke geometry, smoothing pipeline, export helpers)
- `src/types.ts`

## Ink Data Model

Each stroke is stored as vector data:

```ts
{
  id: string;
  tool: "pen";
  color: string;
  baseSize: number;
  points: Array<{ x: number; y: number; pressure: number; timestamp: number }>;
}
```

Each note stores:

- `title`, `text`
- `strokes` (active ink)
- `undoneStrokes` (redo stack)
- `viewport` (`offsetX`, `offsetY`) for pan
- `createdAt`, `updatedAt`

Undo/redo is implemented with `strokes` + `undoneStrokes` stacks.

## Pointer Event + Stroke Pipeline

1. `pointerdown`
   - `setPointerCapture(pointerId)` keeps stroke active if pointer leaves canvas
2. `pointermove`
   - collect `getCoalescedEvents()` when available
   - map screen coordinates to world coords (offset-aware for pan)
   - store point `{x, y, pressure, timestamp}`
3. `pointerup`
   - finalize stroke into note state
4. Render
   - convert points to smoothed polygon via `perfect-freehand`
   - redraw all strokes on changes with `requestAnimationFrame`

Canvas uses `devicePixelRatio` scaling for crisp rendering and re-renders on resize.

## Export / Import

### Export PNG

- Exports current note's ink to a PNG generated from vector strokes.

### Export Bundle JSON

Bundle format:

```json
{
  "version": 1,
  "exportedAt": "ISO date",
  "note": {
    "title": "...",
    "text": "...",
    "strokes": ["vector strokes"],
    "inkPngDataUrl": "data:image/png;base64,..."
  }
}
```

### Import Bundle JSON

- Parses JSON, validates shape (`version === 1`), and creates a new note with imported content.

## Brush Feel Tuning

Edit `src/utils/ink.ts` in `strokePolygon()`:

- `size`: base thickness
- `thinning`: pressure influence
- `smoothing`: curve smoothing strength
- `streamline`: input stabilization
- `simulatePressure`: synthetic pressure toggle (currently `false`)

## Real-time Collaboration (Future)

Use Yjs:

1. Represent note text + strokes in Yjs shared types (`Y.Text`, `Y.Array`).
2. Sync updates via `y-websocket` or WebRTC provider.
3. Keep local Dexie for offline cache/snapshots.
4. Merge pointer stroke append operations as CRDT array inserts.
5. Map undo/redo to `Y.UndoManager` per note.
