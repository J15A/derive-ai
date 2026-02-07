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
MONGODB_URI=your-mongodb-atlas-connection-string
NODE_ENV=development
```

3. Start the backend:

```bash
npm run dev
```

Server URL: `http://localhost:3001`

## Endpoints

- `GET /health`
- `GET /api/notes`
- `GET /api/notes/:id`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`
- `POST /api/notes/bulk`
