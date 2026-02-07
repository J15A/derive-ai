# Getting Started

## 1. Install Dependencies

```bash
npm run install:all
```

## 2. Configure Environment Variables

### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001/api
```

### Backend

Copy and edit backend env file:

```bash
cp backend/.env.example backend/.env
```

Set `backend/.env`:

```env
PORT=3001
MONGODB_URI=your-mongodb-atlas-connection-string
NODE_ENV=development
```

## 3. Start the App

### One command (recommended)

```bash
npm run dev
```

### Or run separately

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

## 4. Open the App

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:3001/health`

## Troubleshooting

- Backend fails to start:
  - verify `backend/.env` exists and `MONGODB_URI` is valid
  - verify Node.js v18+
  - ensure port `3001` is available
- Frontend fails to call API:
  - verify backend is running on `3001`
  - verify `frontend/.env` has correct `VITE_API_URL`
