# Derive AI Notebook

Pen-first notebook with:
- `frontend/`: React + TypeScript + Vite
- `backend/`: Express + TypeScript + MongoDB

## Prerequisites

- Node.js `18+`
- npm
- MongoDB (local or Atlas)
- Auth0 app + API (required for login and notes)
- Gemini API key (required for chat)
- OpenRouter API key (required for solve/graph features)

## Setup

1. Install dependencies

```bash
npm run install:all
```

2. Configure frontend env

Create `frontend/.env` from `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:3001/api
VITE_AUTH0_DOMAIN=your-auth0-domain
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
VITE_AUTH0_AUDIENCE=your-auth0-audience
```

3. Configure backend env

Create `backend/.env` from `backend/.env.example`:

```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/derive-ai
NODE_ENV=development

AUTH0_DOMAIN=your-auth0-domain
AUTH0_AUDIENCE=your-auth0-audience

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-flash-latest

OPENROUTER_API_KEY=your-openrouter-api-key
YOUR_SITE_URL=http://localhost:3001

MIGRATION_OWNER_SUB=
MIGRATION_DELETE_LEGACY=false
```

4. Run the app

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

## Root Scripts

- `npm run dev` / `npm run dev:all`: run frontend + backend
- `npm run dev:frontend`: run frontend only
- `npm run dev:backend`: run backend only
- `npm run build`: build backend then frontend
- `npm run preview`: preview frontend build
- `npm run install:all`: install root/frontend/backend deps

## Feature-to-Env Mapping

- Auth/login + notes API: `VITE_AUTH0_*`, `AUTH0_*`
- Chat widget: `GEMINI_API_KEY` (`GEMINI_MODEL` optional)
- Solve selected math: `OPENROUTER_API_KEY`
- Add selected math to graph: `OPENROUTER_API_KEY`

## API Routes

- `GET /health`
- `GET /api/notes`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST /api/notes/bulk`
- `POST /api/chat`
- `POST /api/solve`
- `POST /api/graph`

## Additional Docs

- `GETTING_STARTED.md`
- `LATEX_GUIDE.md`
- `backend/README.md`
