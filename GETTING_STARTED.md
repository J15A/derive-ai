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

**Backend** - Copy the example and configure `server/.env`:
```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your MongoDB Atlas connection string:
```env
PORT=3001
MONGODB_URI=your-mongodb-atlas-connection-string
NODE_ENV=development
```

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
- MongoDB Atlas cloud database
- Automatic data persistence
- Health check endpoint
- Environment-based configuration

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
- Check that you've created `server/.env` from `server/.env.example`
- Verify MongoDB Atlas connection string is valid
- Confirm Node.js version is 18+
- Check that port 3001 is not in use

**Frontend can't connect?**
- Verify backend is running on port 3001
- Check `.env` has correct `VITE_API_URL`

**MongoDB connection errors?**
- Verify MongoDB Atlas cluster is active at [cloud.mongodb.com](https://cloud.mongodb.com)
- Check your IP is whitelisted in MongoDB Atlas Network Access settings
- Confirm database credentials are correct in `server/.env`
- Ensure connection string format is correct

## Need Help?

See the full documentation:
- [README.md](./README.md) - Complete project overview
- [server/README.md](./server/README.md) - Backend documentation
