#!/bin/bash

# Derive AI Notebook - Startup Script
# This script helps you start the entire application stack

set -e

echo "🚀 Derive AI Notebook - Startup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Function to check if a port is in use
port_in_use() {
    lsof -i :"$1" &> /dev/null
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi
echo "✅ Node.js: $(node --version)"

if ! command_exists docker; then
    echo "⚠️  Docker is not installed. Install Docker to use docker-compose."
    echo "   Or install MongoDB manually and update server/.env"
else
    echo "✅ Docker: $(docker --version | head -n1)"
fi

echo ""

# Check if MongoDB is running
echo "🔍 Checking MongoDB status..."
MONGO_RUNNING=false

if port_in_use 27017; then
    echo "✅ MongoDB is already running on port 27017"
    MONGO_RUNNING=true
else
    echo "⚠️  MongoDB is not running on port 27017"
    
    if command_exists docker && [ -f "docker-compose.yml" ]; then
        echo ""
        echo "Would you like to start MongoDB with Docker? (y/n)"
        read -r -p "> " response
        
        if [[ "$response" =~ ^[Yy]$ ]]; then
            echo ""
            echo "🐳 Starting MongoDB with Docker Compose..."
            docker-compose up -d
            
            # Wait for MongoDB to be ready
            echo "⏳ Waiting for MongoDB to be ready..."
            sleep 3
            
            if port_in_use 27017; then
                echo "✅ MongoDB started successfully!"
                MONGO_RUNNING=true
            else
                echo "❌ Failed to start MongoDB. Please check docker-compose logs."
                exit 1
            fi
        fi
    else
        echo ""
        echo "⚠️  To continue, you need to start MongoDB:"
        echo "   - With Docker: docker-compose up -d"
        echo "   - With Homebrew: brew services start mongodb-community"
        echo "   - Manual: mongod --dbpath /path/to/data"
        echo ""
        read -r -p "Press Enter when MongoDB is running, or Ctrl+C to exit..."
    fi
fi

if [ "$MONGO_RUNNING" = false ] && ! port_in_use 27017; then
    echo "❌ MongoDB is still not accessible. Exiting."
    exit 1
fi

echo ""

# Check if dependencies are installed
echo "📦 Checking dependencies..."

if [ ! -d "node_modules" ]; then
    echo "⚠️  Frontend dependencies not installed"
    echo "   Installing now..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "⚠️  Backend dependencies not installed"
    echo "   Installing now..."
    cd server && npm install && cd ..
fi

echo "✅ All dependencies installed"
echo ""

# Check environment files
echo "🔧 Checking environment configuration..."

if [ ! -f "server/.env" ]; then
    echo "⚠️  Backend .env not found, creating from template..."
    cp server/.env.example server/.env
    echo "✅ Created server/.env"
fi

if [ ! -f ".env" ]; then
    echo "⚠️  Frontend .env not found, creating from template..."
    cp .env.example .env
    echo "✅ Created .env"
fi

echo "✅ Environment files ready"
echo ""

# Start the application
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 Everything is ready! Starting the application..."
echo ""
echo "Backend will start on: http://localhost:3001"
echo "Frontend will start on: http://localhost:5173 (or next available port)"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

sleep 2

# Start both frontend and backend
npm run dev:all
