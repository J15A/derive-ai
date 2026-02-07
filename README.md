# Derive AI Notebook

Pen-first note taking app built with React 18 + TypeScript + Vite + Tailwind CSS with MongoDB Atlas backend.

**🚀 Quick Start**: See [GETTING_STARTED.md](./GETTING_STARTED.md) for setup instructions.

## Features

- Multi-note notebook with sidebar
- Create, rename, delete, and search notes by title
- Note editor with `Ink` and `Text` tabs
- Pointer Events ink engine for stylus, touch, and mouse
- Pressure-sensitive smoothing via `perfect-freehand`
- Pan tool, eraser (real stroke deletion), undo/redo, clear ink
- Toggleable grid overlay (aligned to pan/zoom world space)
- Modernized minimal UI with Tailwind CSS
- React 18 responsiveness patterns (`useTransition`, `useDeferredValue`, `memo`)
- Cloud storage with MongoDB backend
- Automatic sync across devices
- Export ink as PNG
- Export/import full note bundle JSON (`title + markdown + vector strokes + PNG preview`)
- Keyboard shortcuts:
  - `Ctrl/Cmd + N` new note
  - `Ctrl/Cmd + Z` undo ink
  - `Ctrl/Cmd + Shift + Z` redo ink

## Setup

### Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (free tier available at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas))

### Backend Setup

1. **Install backend dependencies**:

```bash
cd server
npm install
```

2. **Configure MongoDB connection**:

Copy the example environment file and add your MongoDB Atlas connection string to `server/.env`:

```bash
cp server/.env.example server/.env
```

Update the `MONGODB_URI` in `server/.env`:

```env
PORT=3001
MONGODB_URI=your-mongodb-atlas-connection-string
NODE_ENV=development
```

3. **Start the backend server**:

```bash
npm run dev
```

The server will start on `http://localhost:3001`.

### Frontend Setup

1. **Install frontend dependencies** (from project root):

```bash
npm install
```

2. **Configure API endpoint**:

Create a `.env` file in the project root:
```env
VITE_API_URL=http://localhost:3001/api
```

3. **Start the frontend**:

```bash
npm run dev
```

### Quick Start - Run Everything

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
npm run dev
```

Or use the combined command:
```bash
npm run dev:all
```

### Build for Production

```bash
npm run build
npm run preview
```

## Folder Structure

### Frontend
- `src/components`
  - `Sidebar.tsx`
  - `NoteEditor.tsx`
  - `InkCanvas.tsx`
  - `Toolbar.tsx`
  - `TextEditor.tsx`
- `src/store`
  - `noteStore.ts` (Zustand state + actions)
- `src/api`
  - `client.ts` (REST API client for backend communication)
- `src/utils`
  - `ink.ts` (stroke geometry, smoothing pipeline, export helpers)
- `src/types.ts`

### Backend
- `server/src`
  - `index.ts` (Express server setup)
  - `mongodb.ts` (MongoDB connection manager)
  - `routes/notes.ts` (REST API endpoints)
  - `types.ts` (Shared TypeScript types)

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
- `viewport` (`offsetX`, `offsetY`, `scale`) for pan + zoom
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

## API Endpoints

- `GET /api/notes` - Fetch all notes
- `GET /api/notes/:id` - Fetch specific note
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/bulk` - Bulk save/update notes
- `POST /api/solve` - Solve handwritten equations using AI
- `POST /api/graph` - Convert equations to graphable LaTeX
- `GET /health` - Health check

## Documentation

- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Guide for new contributors
- **[MONGODB_ACCESS.md](./MONGODB_ACCESS.md)** - Managing MongoDB Atlas access for your team
- **[OPENROUTER_GUIDE.md](./OPENROUTER_GUIDE.md)** - Using OpenRouter API for AI features
- **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Quick setup guide
- **[LATEX_GUIDE.md](./LATEX_GUIDE.md)** - LaTeX annotation syntax

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on:
- Setting up your development environment
- MongoDB configuration options
- OpenRouter API setup
- Code standards and workflow

## Real-time Collaboration (Future)

Use Yjs:

1. Represent note text + strokes in Yjs shared types (`Y.Text`, `Y.Array`).
2. Sync updates via `y-websocket` or WebRTC provider.
3. Keep local Dexie for offline cache/snapshots.
4. Merge pointer stroke append operations as CRDT array inserts.
5. Map undo/redo to `Y.UndoManager` per note.
