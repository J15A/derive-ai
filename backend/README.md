# Derive AI Notebook Backend

Express + TypeScript API for notes persistence using MongoDB.

## Setup

1. Install dependencies:

```bash
cd backend
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
```

Set `.env`:

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
```

3. Start the backend:

```bash
npm run dev
```

Server URL: `http://localhost:3001`

## Env Variables

- `PORT`: backend port (default `3001`)
- `MONGODB_URI`: MongoDB connection string
- `NODE_ENV`: environment mode
- `AUTH0_DOMAIN`: Auth0 tenant domain (required)
- `AUTH0_AUDIENCE`: Auth0 API audience (required)
- `GEMINI_API_KEY`: required for `/api/chat`
- `GEMINI_MODEL`: optional Gemini model override (default `gemini-flash-latest`)
- `OPENROUTER_API_KEY`: required for `/api/solve` and `/api/graph`
- `YOUR_SITE_URL`: optional referer/title metadata for OpenRouter calls
- `MIGRATION_OWNER_SUB`: used by migration script only
- `MIGRATION_DELETE_LEGACY`: used by migration script only

## Endpoints

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
