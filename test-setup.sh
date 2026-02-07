#!/bin/bash

# MongoDB Backend Setup Test Script

echo "🔍 Testing MongoDB Backend Setup..."
echo ""

# Check if MongoDB is running
echo "1. Checking if MongoDB is running..."
if command -v mongosh &> /dev/null; then
    if mongosh --eval "db.version()" --quiet &> /dev/null; then
        echo "✅ MongoDB is running"
        MONGO_VERSION=$(mongosh --eval "db.version()" --quiet)
        echo "   Version: $MONGO_VERSION"
    else
        echo "❌ MongoDB is not running"
        echo "   Start it with: brew services start mongodb-community"
        echo "   Or use Docker: docker run -d -p 27017:27017 --name mongodb mongo:latest"
    fi
else
    echo "⚠️  mongosh not found. Checking with mongo..."
    if command -v mongo &> /dev/null; then
        if mongo --eval "db.version()" --quiet &> /dev/null; then
            echo "✅ MongoDB is running"
            MONGO_VERSION=$(mongo --eval "db.version()" --quiet)
            echo "   Version: $MONGO_VERSION"
        else
            echo "❌ MongoDB is not running"
        fi
    else
        echo "⚠️  MongoDB CLI not found. Install MongoDB or use Docker."
    fi
fi

echo ""
echo "2. Checking if Node.js is installed..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js is installed: $NODE_VERSION"
else
    echo "❌ Node.js is not installed"
    exit 1
fi

echo ""
echo "3. Checking backend dependencies..."
if [ -d "server/node_modules" ]; then
    echo "✅ Backend dependencies installed"
else
    echo "❌ Backend dependencies not installed"
    echo "   Run: cd server && npm install"
fi

echo ""
echo "4. Checking frontend dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "❌ Frontend dependencies not installed"
    echo "   Run: npm install"
fi

echo ""
echo "5. Checking environment files..."
if [ -f "server/.env" ]; then
    echo "✅ Backend .env file exists"
else
    echo "⚠️  Backend .env file not found"
    echo "   Run: cp server/.env.example server/.env"
fi

if [ -f ".env" ]; then
    echo "✅ Frontend .env file exists"
else
    echo "⚠️  Frontend .env file not found"
    echo "   Run: cp .env.example .env"
fi

echo ""
echo "6. Testing backend server (if running)..."
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend server is running and responding"
    curl -s http://localhost:3001/health | jq . 2>/dev/null || curl -s http://localhost:3001/health
else
    echo "⚠️  Backend server is not running"
    echo "   Start it with: npm run dev:server"
fi

echo ""
echo "7. Testing frontend server (if running)..."
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "✅ Frontend server is running"
else
    echo "⚠️  Frontend server is not running"
    echo "   Start it with: npm run dev"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Summary:"
echo ""
echo "To start the application:"
echo "  npm run dev:all    # Start both frontend and backend"
echo ""
echo "Or separately:"
echo "  npm run dev:server # Start backend only"
echo "  npm run dev        # Start frontend only"
echo ""
echo "For more information, see QUICKSTART.md"
echo ""
