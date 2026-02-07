# Contributing to DeriveAI

Thank you for your interest in contributing to DeriveAI! This guide will help you get set up.

## Prerequisites

- Node.js 18+ and npm
- Git

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/jad-chahin/derive-ai.git
cd derive-ai
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 3. Set Up MongoDB

You have two options:

#### Option A: Use Your Own MongoDB Atlas (Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster (free M0 tier is fine)
3. Create a database user:
   - Go to **Database Access** → **Add New Database User**
   - Set username and password
   - Choose `Read and write to any database` permission
4. Whitelist your IP:
   - Go to **Network Access** → **Add IP Address**
   - Click **Add Current IP Address** or use `0.0.0.0/0` for anywhere
5. Get your connection string:
   - Go to **Clusters** → **Connect** → **Connect your application**
   - Copy the connection string
   - Replace `<username>` and `<password>` with your credentials

#### Option B: Use Local MongoDB

```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Connection string will be: mongodb://localhost:27017/derive-ai
```

### 4. Configure Environment Variables

Create a `.env` file in the `server` directory:

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and add your values:

```env
PORT=3001
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/derive-ai?retryWrites=true&w=majority&appName=DeriveAI
NODE_ENV=development
OPENROUTER_API_KEY=your-openrouter-api-key-here
YOUR_SITE_URL=http://localhost:3001
```

### 5. Get an OpenRouter API Key

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Go to **Keys** and create a new API key
3. Add it to your `.env` file

### 6. Run the Development Server

```bash
# From the root directory
npm run dev:all
```

This will start:
- Frontend: http://localhost:5173 (or next available port)
- Backend API: http://localhost:3001

## Project Structure

```
derive-ai/
├── src/                    # Frontend React app
│   ├── components/        # React components
│   ├── store/            # Zustand state management
│   ├── api/              # API client
│   └── utils/            # Utility functions
├── server/                # Backend Express server
│   └── src/
│       ├── routes/       # API routes
│       └── mongodb.ts    # Database connection
└── public/               # Static assets
```

## Development Workflow

1. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and test locally

3. Commit your changes:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

4. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

5. Open a Pull Request on GitHub

## Coding Standards

- Use TypeScript for type safety
- Follow the existing code style
- Add comments for complex logic
- Test your changes thoroughly

## Database Access for Team Members

If you're part of the core team and need access to the shared development database, contact the repository owner for credentials.

## Troubleshooting

### MongoDB Connection Issues

- **Error: "MongoServerSelectionError"**
  - Check your IP is whitelisted in MongoDB Atlas
  - Verify your username/password are correct
  - Ensure your connection string is properly formatted

### Port Already in Use

If port 3001 or 5173 is already in use:
```bash
# Find and kill the process
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

## Questions?

Feel free to open an issue or reach out to the maintainers!
