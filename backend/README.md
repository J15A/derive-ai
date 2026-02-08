# Derive AI Notebook Backend

Express + TypeScript API for notes persistence using MongoDB and AI-powered equation solving.

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
MONGODB_URI=your-mongodb-atlas-connection-string
OPENROUTER_API_KEY=your-openrouter-api-key
NODE_ENV=development

AUTH0_DOMAIN=your-auth0-domain
AUTH0_AUDIENCE=your-auth0-audience

GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-flash-latest

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_SOLVER_MODEL=openai/gpt-4o
OPENROUTER_RECOGNITION_MODEL=openai/gpt-4o
YOUR_SITE_URL=http://localhost:3001
```

3. Start the backend:

```bash
npm run dev
```

Server URL: `http://localhost:3001`

## AI Models

This backend uses OpenRouter to access various AI models:

- **Equation Solving** (`/api/solve`): Uses `openai/gpt-4o` (configurable via `OPENROUTER_SOLVER_MODEL`) - a powerful chat model for solving complex math problems
- **Handwriting Recognition** (`/api/recognize`, `/api/graph`, `/api/nextstep`): Uses `openai/gpt-4o` (configurable via `OPENROUTER_RECOGNITION_MODEL`) - a strong model for accurate OCR/handwriting recognition
- **Chat** (`/api/chat`): Uses Gemini API (configurable via `GEMINI_MODEL`) for interactive conversations

## Endpoints

- `GET /health` - Health check
- `GET /api/notes` - Get all notes
- `GET /api/notes/:id` - Get a specific note
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note
- `POST /api/notes/bulk` - Bulk save notes
- `POST /api/solve` - Recognize and solve handwritten math (uses strong Gemini model)
- `POST /api/graph` - Recognize handwritten math for graphing (uses lightweight Gemini model)
