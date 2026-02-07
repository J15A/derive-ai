# Derive AI Notebook - Backend

Node.js + Express + MongoDB backend for the Derive AI Notebook application.

## Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB Atlas** account (cloud database) or local MongoDB

## Quick Start

1. **Install dependencies**:

```bash
cd server
npm install
```

2. **The MongoDB connection is already configured** with MongoDB Atlas in `.env`. To use your own database, update the connection string:

```env
PORT=3001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/derive-ai
NODE_ENV=development
```

3. **Start the server**:

```bash
npm run dev
```

The server runs on `http://localhost:3001`.

## API Endpoints

### Health Check
- `GET /health` - Check if the server is running

### Notes
- `GET /api/notes` - Get all notes
- `GET /api/notes/:id` - Get a specific note
- `POST /api/notes` - Create a new note
- `PUT /api/notes/:id` - Update a note
- `DELETE /api/notes/:id` - Delete a note
- `POST /api/notes/bulk` - Bulk save/update notes

## Testing the API

You can test the API using curl:

```bash
# Health check
curl http://localhost:3001/health

# Get all notes
curl http://localhost:3001/api/notes

# Create a note
curl -X POST http://localhost:3001/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "title": "Test Note",
    "text": "This is a test note",
    "strokes": [],
    "undoneStrokes": [],
    "viewport": {"offsetX": 0, "offsetY": 0, "scale": 1},
    "createdAt": 1640000000000,
    "updatedAt": 1640000000000
  }'
```

## Project Structure

```
server/
├── src/
│   ├── index.ts          # Entry point
│   ├── db.ts             # Database connection
│   ├── types.ts          # TypeScript types
│   └── routes/
│       └── notes.ts      # Notes API routes
├── package.json
├── tsconfig.json
├── .env                  # Environment variables
└── .env.example          # Environment variables template
```

## Troubleshooting

### MongoDB Connection Issues

If you can't connect to MongoDB Atlas:

1. Verify the connection string in `.env`
2. Check that your IP is whitelisted in MongoDB Atlas Network Access
3. Verify your database user credentials
4. Check MongoDB Atlas dashboard for cluster status

### Port Already in Use

If port 3001 is already in use:

1. Change the `PORT` in `.env`
2. Update the frontend `.env` file with the new port

### CORS Issues

The server is configured to allow all origins in development.
For production, update the CORS settings in `src/index.ts`.

## License

MIT
