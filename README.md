# Derive AI Notebook

Pen-first note taking app with a React + Vite frontend and an Express + MongoDB backend.

## Project Structure

```
derive-ai/
|-- frontend/   # React + TypeScript + Vite app
|-- backend/    # Express + TypeScript API
|-- README.md
|-- GETTING_STARTED.md
`-- package.json  # root scripts for running both apps
```

## Quick Start

1. Install dependencies:

```bash
npm run install:all
```

2. Configure environment files:

- Frontend: create `frontend/.env` and set:

```env
VITE_API_URL=http://localhost:3001/api
```

- Backend: copy `backend/.env.example` to `backend/.env` and set MongoDB:

```env
PORT=3001
MONGODB_URI=your-mongodb-atlas-connection-string
NODE_ENV=development
```

3. Run both services:

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:3001`

## Root Scripts

- `npm run dev` / `npm run dev:all`: run backend + frontend together
- `npm run dev:backend`: run backend only
- `npm run dev:frontend`: run frontend only
- `npm run build`: build backend then frontend
- `npm run preview`: preview frontend production build

## API Endpoints

- `GET /health`
- `GET /api/notes`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST /api/notes/bulk`

## Additional Docs

- `GETTING_STARTED.md`
- `LATEX_GUIDE.md`
- `backend/README.md`
