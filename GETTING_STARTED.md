# Getting Started

## Quick Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Configure Environment Variables

**Frontend** - Create `.env` in the project root:
```env
VITE_API_URL=http://localhost:3001/api
```

**Backend** - The `server/.env` file is already configured with MongoDB Atlas.

### 3. Start the Application

**Option 1: Run both servers with one command**
```bash
npm run dev:all
```

**Option 2: Run separately**
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
npm run dev
```

### 4. Open the App

Open your browser to **http://localhost:5173**

## What's Included

### Backend (Node.js + Express + MongoDB Atlas)
- REST API for notes CRUD operations
- MongoDB Atlas cloud database (already configured)
- Automatic data persistence
- Health check endpoint

### Frontend (React + TypeScript + Vite)
- Pen-first note editor with pressure sensitivity
- Text editor with markdown support
- Multi-note management
- Highlighter and selector tools
- Automatic cloud sync

## API Endpoints

- `GET /api/notes` - Get all notes
- `POST /api/notes` - Create note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/bulk` - Bulk save/update
- `GET /health` - Health check

## Troubleshooting

**Backend won't start?**
- Check that `server/.env` has valid MongoDB connection string
- Verify Node.js version is 18+

**Frontend can't connect?**
- Verify backend is running on port 3001
- Check `.env` has correct `VITE_API_URL`

**MongoDB connection errors?**
- Verify MongoDB Atlas cluster is active
- Check your IP is whitelisted in MongoDB Atlas
- Confirm database credentials are correct

## Need Help?

See the full documentation:
- [README.md](./README.md) - Complete project overview
- [server/README.md](./server/README.md) - Backend documentation
