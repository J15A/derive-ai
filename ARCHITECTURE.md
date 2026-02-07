# System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User's Browser                           │
│                      http://localhost:5173                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP Requests
                             │ (REST API)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                             │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Components                                                 │ │
│  │  • Sidebar       • NoteEditor                             │ │
│  │  • InkCanvas     • TextEditor                             │ │
│  │  • Toolbar                                                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ State Management (Zustand)                                │ │
│  │  • noteStore.ts  - Global state                           │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ API Client                                                 │ │
│  │  • database.ts   - Fetch API wrapper                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Port: 5173 (Vite Dev Server)                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/JSON
                             │ GET /api/notes
                             │ POST /api/notes
                             │ PUT /api/notes/:id
                             │ DELETE /api/notes/:id
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Express Backend Server                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Routes (REST API)                                          │ │
│  │  • GET    /api/notes       - Fetch all notes              │ │
│  │  • GET    /api/notes/:id   - Fetch one note               │ │
│  │  • POST   /api/notes       - Create note                  │ │
│  │  • PUT    /api/notes/:id   - Update note                  │ │
│  │  • DELETE /api/notes/:id   - Delete note                  │ │
│  │  • POST   /api/notes/bulk  - Bulk save                    │ │
│  │  • GET    /health          - Health check                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Middleware                                                 │ │
│  │  • CORS           - Cross-origin requests                 │ │
│  │  • Body Parser    - JSON parsing (50MB limit)             │ │
│  │  • Error Handler  - Error responses                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Database Layer                                             │ │
│  │  • db.ts          - MongoDB connection                    │ │
│  │  • Index creation - Performance optimization              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Port: 3001                                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ MongoDB Protocol
                             │ (BSON over TCP)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MongoDB Database                            │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Database: derive-ai                                        │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │ Collection: notes                                    │ │ │
│  │  │                                                       │ │ │
│  │  │ Document Schema:                                     │ │ │
│  │  │  {                                                   │ │ │
│  │  │    id: string                                        │ │ │
│  │  │    title: string                                     │ │ │
│  │  │    text: string                                      │ │ │
│  │  │    strokes: InkStroke[]                              │ │ │
│  │  │    undoneStrokes: InkStroke[]                        │ │ │
│  │  │    viewport: { offsetX, offsetY, scale }             │ │ │
│  │  │    createdAt: number                                 │ │ │
│  │  │    updatedAt: number                                 │ │ │
│  │  │  }                                                   │ │ │
│  │  │                                                       │ │ │
│  │  │ Indexes:                                             │ │ │
│  │  │  • updatedAt (desc) - For sorting                   │ │ │
│  │  │  • title, text (text index) - For search            │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Port: 27017                                                     │
│  Storage: Docker Volume (mongodb_data)                           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Creating a Note

```
User clicks "New Note"
    │
    ▼
React calls useNoteStore.createNote()
    │
    ▼
Store updates local state (optimistic update)
    │
    ▼
App.tsx useEffect triggers saveNotesToDb()
    │
    ▼
database.ts sends POST /api/notes with note data
    │
    ▼
Express routes/notes.ts receives request
    │
    ▼
Validates note data
    │
    ▼
MongoDB insertOne() saves to database
    │
    ▼
Returns saved note to frontend
    │
    ▼
UI updates (note appears in sidebar)
```

### Updating a Note

```
User draws on canvas or edits text
    │
    ▼
InkCanvas/TextEditor updates Zustand store
    │
    ▼
Store updates note in state array
    │
    ▼
App.tsx debounces save (450ms delay)
    │
    ▼
database.ts sends POST /api/notes/bulk with all notes
    │
    ▼
Express routes/notes.ts processes bulk update
    │
    ▼
MongoDB bulkWrite() upserts all notes
    │
    ▼
Changes persisted to database
```

### Loading Notes on App Start

```
App mounts
    │
    ▼
App.tsx useEffect calls loadNotesFromDb()
    │
    ▼
database.ts sends GET /api/notes
    │
    ▼
Express routes/notes.ts queries MongoDB
    │
    ▼
MongoDB find() returns all notes sorted by updatedAt
    │
    ▼
Frontend receives notes array
    │
    ▼
useNoteStore.setNotes() updates state
    │
    ▼
UI renders notes in sidebar
    │
    ▼
Most recent note auto-selected
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **perfect-freehand** - Ink smoothing
- **marked** - Markdown rendering

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **MongoDB Native Driver** - Database client
- **tsx** - TypeScript execution with hot reload
- **cors** - CORS handling
- **dotenv** - Environment variables

### Database
- **MongoDB 7+** - Document database
- **Docker** - Containerization (optional)
- **Mongo Express** - Database UI (optional)

## Deployment Architecture

### Development
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────▶│   Backend    │────▶│   MongoDB    │
│  localhost:  │     │  localhost:  │     │  localhost:  │
│     5173     │     │     3001     │     │    27017     │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Production (Example)
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Vercel/    │────▶│   Railway/   │────▶│   MongoDB    │
│   Netlify    │     │   Render/    │     │    Atlas     │
│  (Frontend)  │     │  Fly.io      │     │   (Cloud)    │
└──────────────┘     └──────────────┘     └──────────────┘
```

## Security Considerations

### Current Implementation (Development)
- ✅ CORS enabled for all origins
- ✅ JSON body size limited to 50MB
- ✅ Environment variables for config
- ⚠️ No authentication (all notes public)
- ⚠️ No rate limiting
- ⚠️ No input validation/sanitization

### Production Recommendations
- 🔒 Add JWT or session-based authentication
- 🔒 Implement user-specific note isolation
- 🔒 Add rate limiting middleware
- 🔒 Input validation and sanitization
- 🔒 HTTPS only
- 🔒 Restricted CORS policy
- 🔒 MongoDB authentication
- 🔒 Request logging
- 🔒 Error tracking (Sentry, etc.)

## Performance Optimizations

### Current
- ✅ Debounced saves (450ms)
- ✅ Bulk operations for syncing
- ✅ MongoDB indexes on frequently queried fields
- ✅ React optimistic updates
- ✅ React.memo for components

### Future Enhancements
- 🚀 Redis caching layer
- 🚀 WebSocket for real-time updates
- 🚀 Service Worker for offline mode
- 🚀 CDN for static assets
- 🚀 Database query optimization
- 🚀 Image compression for exported PNGs
- 🚀 Lazy loading for note list

## Scalability

### Current Limitations
- Single server instance
- All notes loaded at once
- No pagination
- No caching

### Scaling Strategy
1. **Phase 1** (up to 10K users)
   - Add Redis for session storage
   - Implement pagination
   - Add CDN

2. **Phase 2** (up to 100K users)
   - Horizontal scaling (load balancer)
   - MongoDB replica set
   - Separate read/write endpoints

3. **Phase 3** (100K+ users)
   - Microservices architecture
   - MongoDB sharding
   - Message queue (RabbitMQ/Kafka)
   - Real-time with WebSocket clusters

## Monitoring & Observability

### Recommended Tools
- **Application Performance**: New Relic, DataDog
- **Error Tracking**: Sentry, Rollbar
- **Logging**: Winston + CloudWatch/Loggly
- **Database Monitoring**: MongoDB Atlas built-in
- **Uptime Monitoring**: Pingdom, UptimeRobot
- **Analytics**: Google Analytics, Mixpanel

## Backup & Recovery

### MongoDB Backup Strategy
1. **Automated Backups** (MongoDB Atlas)
   - Point-in-time recovery
   - Automated daily snapshots

2. **Manual Backups**
   ```bash
   mongodump --out /backup/$(date +%Y%m%d)
   ```

3. **Recovery**
   ```bash
   mongorestore /backup/20260207
   ```

## Cost Estimation (Production)

### Small Scale (1K active users)
- Frontend (Vercel): $0/month
- Backend (Railway): $5/month
- MongoDB Atlas: $0/month (free tier)
- **Total**: ~$5/month

### Medium Scale (10K active users)
- Frontend (Vercel): $20/month
- Backend (Railway): $20/month
- MongoDB Atlas: $25/month (M10 cluster)
- CDN/Monitoring: $10/month
- **Total**: ~$75/month

### Large Scale (100K+ active users)
- Frontend (Vercel): $150/month
- Backend (Multiple instances): $200/month
- MongoDB Atlas: $300/month (M30+ cluster)
- Redis Cache: $50/month
- CDN/Monitoring: $100/month
- **Total**: ~$800/month
