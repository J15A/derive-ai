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
YOUR_SITE_URL=http://localhost:3001
```

3. Start the backend:

```bash
npm run dev
```

Server URL: `http://localhost:3001`

## AI Models

This backend uses OpenRouter to access Gemini models:

- **Equation Solving** (`/api/solve`): Uses `google/gemini-2.0-flash-thinking-exp:free` - a strong reasoning model that can accurately solve complex math problems
- **Graph Recognition** (`/api/graph`): Uses `google/gemini-flash-1.5-8b` - a lightweight model for quick OCR/handwriting recognition

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
