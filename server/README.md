# Derive AI Notebook - Backend Setup

This is the backend server for the Derive AI Notebook application. It provides a REST API to store and manage notes using MongoDB.

## Prerequisites

Before running the server, make sure you have:

- **Node.js** (v18 or higher)
- **MongoDB** installed and running locally, or a MongoDB connection string

## Installation

1. Install dependencies:

```bash
cd server
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and update the MongoDB connection string if needed:

```
PORT=3001
MONGODB_URI=mongodb://localhost:27017/derive-ai
NODE_ENV=development
```

## MongoDB Setup

### Option 1: Local MongoDB

If you have MongoDB installed locally, start it:

```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Or run it directly
mongod --dbpath /path/to/your/data/directory
```

### Option 2: MongoDB Atlas (Cloud)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string and update `MONGODB_URI` in `.env`

Example Atlas connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/derive-ai?retryWrites=true&w=majority
```

### Option 3: Docker

Run MongoDB in a Docker container:

```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## Running the Server

### Development Mode (with hot reload)

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

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

If you can't connect to MongoDB:

1. Check if MongoDB is running: `ps aux | grep mongod`
2. Verify the connection string in `.env`
3. Check MongoDB logs for errors
4. Ensure the port 27017 is not blocked

### Port Already in Use

If port 3001 is already in use:

1. Change the `PORT` in `.env`
2. Update the frontend `.env` file with the new port

### CORS Issues

If you're getting CORS errors:

1. The server is configured to allow all origins in development
2. For production, update the CORS settings in `src/index.ts`

## License

MIT
