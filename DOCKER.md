# Docker Setup for Derive AI Notebook

This Docker Compose setup provides MongoDB and an optional MongoDB Express UI for database management.

## Services

- **MongoDB**: Main database server (port 27017)
- **Mongo Express**: Web-based MongoDB admin interface (port 8081)

## Quick Start

1. **Install Docker Desktop** (if not already installed):
   - macOS/Windows: [Download Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: Install Docker Engine and Docker Compose

2. **Start MongoDB**:
   ```bash
   docker-compose up -d
   ```

3. **Verify MongoDB is running**:
   ```bash
   docker-compose ps
   ```

4. **Access Mongo Express** (optional):
   Open http://localhost:8081 in your browser to view and manage your database

5. **Start the application**:
   ```bash
   npm run dev:all
   ```

## Docker Commands

### Start services
```bash
docker-compose up -d
```

### Stop services
```bash
docker-compose down
```

### Stop and remove data
```bash
docker-compose down -v
```

### View logs
```bash
# All services
docker-compose logs -f

# MongoDB only
docker-compose logs -f mongodb

# Mongo Express only
docker-compose logs -f mongo-express
```

### Restart services
```bash
docker-compose restart
```

## Accessing MongoDB

### From your application
The MongoDB connection string is:
```
mongodb://localhost:27017/derive-ai
```

This is already configured in `server/.env`.

### From MongoDB Compass
1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect using: `mongodb://localhost:27017`
3. Browse the `derive-ai` database

### From Mongo Express
Open http://localhost:8081 in your browser

### From command line
```bash
# Enter MongoDB container
docker exec -it derive-ai-mongodb mongosh

# Then in the MongoDB shell
use derive-ai
db.notes.find()
```

## Data Persistence

Data is persisted in Docker volumes:
- `mongodb_data`: Database files
- `mongodb_config`: Configuration files

Data will persist even after stopping the containers. To completely remove data, use:
```bash
docker-compose down -v
```

## Troubleshooting

### Port already in use
If port 27017 or 8081 is already in use, modify the ports in `docker-compose.yml`:

```yaml
services:
  mongodb:
    ports:
      - "27018:27017"  # Change 27017 to 27018
```

Then update `server/.env`:
```
MONGODB_URI=mongodb://localhost:27018/derive-ai
```

### Container won't start
```bash
# Check logs
docker-compose logs mongodb

# Remove and recreate
docker-compose down
docker-compose up -d
```

### Reset everything
```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove images
docker rmi mongo:latest mongo-express:latest

# Start fresh
docker-compose up -d
```

## Production Considerations

For production use:

1. **Add authentication**:
   ```yaml
   mongodb:
     environment:
       MONGO_INITDB_ROOT_USERNAME: admin
       MONGO_INITDB_ROOT_PASSWORD: secure_password
   ```

2. **Remove Mongo Express** (or secure it):
   - Comment out or remove the `mongo-express` service
   - Or add authentication

3. **Use a managed service**:
   - Consider MongoDB Atlas for production
   - Provides automatic backups, scaling, and monitoring

## Monitoring

### Check container health
```bash
docker-compose ps
```

### View resource usage
```bash
docker stats derive-ai-mongodb
```

### Backup database
```bash
# Create backup
docker exec derive-ai-mongodb mongodump --out /data/backup

# Copy backup to host
docker cp derive-ai-mongodb:/data/backup ./mongodb-backup
```

### Restore database
```bash
# Copy backup to container
docker cp ./mongodb-backup derive-ai-mongodb:/data/backup

# Restore
docker exec derive-ai-mongodb mongorestore /data/backup
```
