# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - MongoDB Backend - 2026-02-06

### 🎉 Major Update: MongoDB Backend Integration

This release adds a complete backend infrastructure with MongoDB for cloud storage.

### ✨ Added

#### Backend Server
- Complete Express.js + TypeScript backend server
- RESTful API with full CRUD operations for notes
- MongoDB integration with native driver
- Health check endpoint (`/health`)
- Bulk operations for efficient syncing
- Environment variable configuration
- Graceful shutdown handling
- CORS support for cross-origin requests
- Error handling middleware
- Automatic database indexing

#### API Endpoints
- `GET /api/notes` - Fetch all notes
- `GET /api/notes/:id` - Fetch specific note
- `POST /api/notes` - Create new note
- `PUT /api/notes/:id` - Update note
- `DELETE /api/notes/:id` - Delete note
- `POST /api/notes/bulk` - Bulk save/update notes
- `GET /health` - Server health check

#### Docker Support
- `docker-compose.yml` for easy MongoDB setup
- MongoDB container configuration
- Mongo Express UI for database management
- Persistent data volumes
- Easy container management

#### Scripts & Tools
- `start.sh` - Automated startup script with prerequisite checks
- `test-setup.sh` - Setup verification script
- `npm run dev:all` - Run frontend and backend together
- `npm run install:all` - Install all dependencies
- `npm run dev:server` - Run backend only
- `npm run build:server` - Build backend for production

#### Documentation
- `SETUP_COMPLETE.md` - Complete setup guide
- `QUICKSTART.md` - Quick start instructions
- `ARCHITECTURE.md` - System architecture and diagrams
- `MIGRATION_SUMMARY.md` - Migration details
- `DEPLOYMENT.md` - Production deployment guide
- `DOCKER.md` - Docker setup guide
- `DOCS.md` - Documentation index
- `server/README.md` - Backend-specific documentation

### 🔄 Changed

#### Frontend
- Replaced IndexedDB (Dexie) with REST API client
- Updated `src/db/database.ts` to use MongoDB backend
- Added environment variable support (`VITE_API_URL`)
- Updated package.json with new scripts
- Updated `.gitignore` to exclude `.env` files

#### Data Storage
- Notes now stored in MongoDB instead of IndexedDB
- Same data structure maintained for compatibility
- Automatic syncing to cloud storage
- 450ms debounced autosave (unchanged)

### 🗑️ Removed
- Dexie dependency (IndexedDB library)
- Local-only storage limitation

### 📦 Dependencies Added

#### Backend
- `express` - Web framework
- `mongodb` - MongoDB native driver
- `cors` - CORS middleware
- `dotenv` - Environment variable management
- `tsx` - TypeScript execution with hot reload
- `@types/express`, `@types/cors`, `@types/node` - TypeScript types

#### Frontend
- `concurrently` - Run multiple processes simultaneously

### 🔧 Technical Details

#### Database Schema
```typescript
{
  id: string
  title: string
  text: string
  strokes: InkStroke[]
  undoneStrokes: InkStroke[]
  viewport: { offsetX, offsetY, scale }
  createdAt: number
  updatedAt: number
}
```

#### Indexes
- `updatedAt` (descending) - For sorting notes by modification time
- `title`, `text` (text index) - For future search functionality

#### Configuration
- Backend port: 3001 (configurable)
- Frontend port: 5173 (Vite default)
- MongoDB port: 27017 (default)
- API endpoint: `/api/notes`

### 🚀 Performance
- Efficient bulk operations for syncing
- Database indexes for fast queries
- Connection pooling and reuse
- JSON payload limit: 50MB (for large notes with many strokes)

### 🔒 Security Notes

**⚠️ Current State (Development Only)**
- No authentication (all notes are public)
- Open CORS policy
- No rate limiting
- No input validation beyond basic checks

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for production security requirements**

### 🎯 Migration Path

For users with existing notes in IndexedDB:

**Option 1: Fresh Start**
- Notes in IndexedDB will remain in the browser
- New notes will be saved to MongoDB
- IndexedDB data is not automatically migrated

**Option 2: Manual Export/Import**
- Export notes using the existing export feature
- Import them into the new MongoDB-backed version

**Option 3: Automatic Migration (Not Yet Implemented)**
- Future enhancement to automatically migrate IndexedDB notes to MongoDB

### 🐛 Known Issues
- None at this time

### 📋 Breaking Changes
- Local-only storage is no longer used (IndexedDB → MongoDB)
- Requires MongoDB to be running
- Requires backend server to be running
- Environment variables must be configured

### ⬆️ Upgrade Instructions

1. **Install MongoDB** (or use Docker):
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies**:
   ```bash
   npm run install:all
   ```

3. **Configure environment**:
   - Copy `.env.example` to `.env` (frontend)
   - Copy `server/.env.example` to `server/.env` (backend)

4. **Start the application**:
   ```bash
   npm run dev:all
   # or use the automated script:
   ./start.sh
   ```

### 🎓 Learning Resources
- [QUICKSTART.md](./QUICKSTART.md) - Get started quickly
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Understand the system
- [DOCKER.md](./DOCKER.md) - Docker setup
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deploy to production

---

## [1.0.0] - Initial Release

### Features
- Multi-note notebook with sidebar
- Create, rename, delete, and search notes
- Ink and text editing tabs
- Pointer Events ink engine (stylus, touch, mouse)
- Pressure-sensitive smoothing (perfect-freehand)
- Pan tool, eraser, undo/redo, clear ink
- Toggleable grid overlay
- Offline autosave with IndexedDB
- Export ink as PNG
- Export/import note bundles (JSON)
- Keyboard shortcuts (Cmd/Ctrl+N, Cmd/Ctrl+Z)

### Technologies
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- Dexie (IndexedDB wrapper)
- perfect-freehand
- marked (Markdown rendering)

---

## Future Roadmap

### Version 2.1.0 (Planned)
- [ ] User authentication (JWT/OAuth)
- [ ] User-specific notes (multi-user support)
- [ ] Note sharing and permissions
- [ ] Automatic migration from IndexedDB
- [ ] Full-text search across notes
- [ ] Tags and categories
- [ ] Favorites/pinned notes

### Version 2.2.0 (Planned)
- [ ] Real-time collaboration (WebSockets)
- [ ] Offline mode with sync queue
- [ ] Service Worker for PWA
- [ ] File attachments (images, PDFs)
- [ ] Advanced search and filters
- [ ] Note templates

### Version 3.0.0 (Future)
- [ ] AI-powered features
  - Auto-summarization
  - Smart search
  - Handwriting recognition (OCR)
  - Auto-tagging
- [ ] Mobile apps (React Native)
- [ ] Desktop apps (Electron)
- [ ] Browser extensions
- [ ] API for third-party integrations

### Infrastructure Improvements (Ongoing)
- [ ] Redis caching layer
- [ ] Rate limiting
- [ ] API versioning
- [ ] Comprehensive testing suite
- [ ] CI/CD pipeline
- [ ] Automated backups
- [ ] Monitoring and alerting
- [ ] Performance optimizations

---

## How to Contribute

1. Check the roadmap above for planned features
2. Open an issue to discuss new ideas
3. Submit pull requests with improvements
4. Update documentation when adding features
5. Add tests for new functionality

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):
- **Major** (X.0.0): Breaking changes
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, backwards compatible

---

**Last Updated**: February 6, 2026
