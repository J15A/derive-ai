import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const OWNER_SUB = process.env.MIGRATION_OWNER_SUB;
const DELETE_LEGACY = process.env.MIGRATION_DELETE_LEGACY === "true";

function getLegacyFilter() {
  return {
    $or: [
      { ownerSub: { $exists: false } },
      { ownerSub: null },
      { ownerSub: "" },
    ],
  };
}

async function run(): Promise<void> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  if (!OWNER_SUB && !DELETE_LEGACY) {
    throw new Error(
      "Set MIGRATION_OWNER_SUB to assign legacy notes, or set MIGRATION_DELETE_LEGACY=true to delete them.",
    );
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const notes = db.collection("notes");

    const legacyFilter = getLegacyFilter();
    const legacyCount = await notes.countDocuments(legacyFilter);
    console.log(`Legacy notes found: ${legacyCount}`);

    if (legacyCount === 0) {
      console.log("No migration needed.");
      return;
    }

    if (OWNER_SUB) {
      const assignResult = await notes.updateMany(legacyFilter, {
        $set: { ownerSub: OWNER_SUB },
      });
      console.log(`Assigned ownerSub to ${assignResult.modifiedCount} notes.`);
    }

    if (DELETE_LEGACY) {
      const deleteResult = await notes.deleteMany(legacyFilter);
      console.log(`Deleted ${deleteResult.deletedCount} legacy notes.`);
    }
  } finally {
    await client.close();
  }
}

run()
  .then(() => {
    console.log("Migration completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
