import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectToDatabase, closeDatabase } from "./mongodb.js";
import notesRouter from "./routes/notes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/derive-ai";

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase limit for large notes with many strokes
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/notes", notesRouter);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectToDatabase(MONGODB_URI);
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📝 API endpoint: http://localhost:${PORT}/api/notes`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down gracefully...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nShutting down gracefully...");
  await closeDatabase();
  process.exit(0);
});

startServer();
