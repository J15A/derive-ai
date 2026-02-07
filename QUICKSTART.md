# Quick Start Guide

This guide will help you get the Derive AI Notebook up and running with MongoDB.

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18+) - [Download here](https://nodejs.org/)
2. **MongoDB** - Choose one option:
   - **Local MongoDB** - [Download here](https://www.mongodb.com/try/download/community)
   - **MongoDB Atlas** - [Free cloud database](https://www.mongodb.com/cloud/atlas/register)
   - **Docker** - Run `docker run -d -p 27017:27017 --name mongodb mongo:latest`

## Installation Steps

### Step 1: Install Dependencies

Run this command from the project root to install all dependencies (frontend and backend):

```bash
npm run install:all
```

Or install them separately:

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd server
npm install
cd ..
```

### Step 2: Start MongoDB

Choose your method:

**Option A: Local MongoDB (if installed)**
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

**Option B: Docker**
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**Option C: MongoDB Atlas**
1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get your connection string
3. Update `server/.env` with your connection string

### Step 3: Configure Environment Variables

The `.env` files are already created for you with default values. If you need to change them:

**Backend** (`server/.env`):
```bash
PORT=3001
MONGODB_URI=mongodb://localhost:27017/derive-ai
NODE_ENV=development
```

**Frontend** (`.env`):
```bash
VITE_API_URL=http://localhost:3001/api
```

### Step 4: Start the Application

**Option A: Start Everything at Once (Recommended)**
```bash
npm run dev:all
```

This will start both the backend server and frontend dev server simultaneously.

**Option B: Start Separately**

In one terminal:
```bash
npm run dev:server
```

In another terminal:
```bash
npm run dev
```

### Step 5: Open the Application

Once both servers are running:

1. Backend will be at: `http://localhost:3001`
2. Frontend will be at: `http://localhost:5173` (or the port Vite chooses)

Open your browser and navigate to the frontend URL to start using the app!

## Verifying Everything Works

1. **Check Backend Health**:
   ```bash
   curl http://localhost:3001/health
   ```
   
   You should see: `{"status":"ok","timestamp":"..."}`

2. **Create a Note**: Open the app and create a new note. It should save automatically.

3. **Check MongoDB**: You can verify data is being saved:
   ```bash
   # Connect to MongoDB shell
   mongosh
   
   # Switch to the database
   use derive-ai
   
   # View notes
   db.notes.find()
   ```

## Common Issues

### Port Already in Use

If port 3001 or 5173 is already in use:

1. Change `PORT` in `server/.env`
2. Update `VITE_API_URL` in `.env` to match

### MongoDB Connection Failed

- Verify MongoDB is running: `ps aux | grep mongod` (macOS/Linux)
- Check the connection string in `server/.env`
- Look at server logs for specific error messages

### CORS Errors

- Make sure the backend is running
- Verify the API URL in `.env` matches your backend port

### Data Not Saving

- Check the browser console for errors
- Verify the backend server is running and healthy
- Ensure MongoDB is connected (check server logs)

## Next Steps

- Read the full [README.md](./README.md) for feature details
- Check [server/README.md](./server/README.md) for API documentation
- Start creating notes!

## Production Deployment

For production deployment:

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Build the backend:
   ```bash
   npm run build:server
   ```

3. Deploy the `dist` folder (frontend) and `server/dist` folder (backend) to your hosting service

4. Set production environment variables for MongoDB connection and API URLs

## Support

If you encounter any issues, please check:
- MongoDB is running and accessible
- All dependencies are installed
- Port numbers match in your configuration files
