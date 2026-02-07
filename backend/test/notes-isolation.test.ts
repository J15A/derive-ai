import express from "express";
import request from "supertest";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import notesRouter from "../src/routes/notes.js";
import { connectToDatabase, closeDatabase, getNotesCollection } from "../src/mongodb.js";

const USER_A = "auth0|user-a";
const USER_B = "auth0|user-b";

function makeNote(id: string, title: string) {
  const now = Date.now();
  return {
    id,
    title,
    text: "",
    strokes: [],
    undoneStrokes: [],
    viewport: { offsetX: 0, offsetY: 0, scale: 1 },
    createdAt: now,
    updatedAt: now,
  };
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const sub = req.header("x-test-sub");
    if (!sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.auth = {
      sub,
      payload: { sub },
    };
    next();
  });
  app.use("/api/notes", notesRouter);
  return app;
}

describe("notes user isolation", () => {
  let mongod: MongoMemoryServer;
  const app = createTestApp();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    await connectToDatabase(mongod.getUri());
  });

  afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
  });

  beforeEach(async () => {
    await getNotesCollection().deleteMany({});
  });

  it("returns only current user's notes on list", async () => {
    await request(app).post("/api/notes").set("x-test-sub", USER_A).send(makeNote("a1", "A Note")).expect(201);
    await request(app).post("/api/notes").set("x-test-sub", USER_B).send(makeNote("b1", "B Note")).expect(201);

    const aList = await request(app).get("/api/notes").set("x-test-sub", USER_A).expect(200);
    const bList = await request(app).get("/api/notes").set("x-test-sub", USER_B).expect(200);

    expect(aList.body).toHaveLength(1);
    expect(aList.body[0].id).toBe("a1");
    expect(aList.body[0].ownerSub).toBe(USER_A);

    expect(bList.body).toHaveLength(1);
    expect(bList.body[0].id).toBe("b1");
    expect(bList.body[0].ownerSub).toBe(USER_B);
  });

  it("blocks cross-user read/update/delete by id", async () => {
    await request(app).post("/api/notes").set("x-test-sub", USER_A).send(makeNote("shared-id", "Private")).expect(201);

    await request(app).get("/api/notes/shared-id").set("x-test-sub", USER_B).expect(404);
    await request(app)
      .put("/api/notes/shared-id")
      .set("x-test-sub", USER_B)
      .send({ title: "Hacked" })
      .expect(404);
    await request(app).delete("/api/notes/shared-id").set("x-test-sub", USER_B).expect(404);
  });

  it("scopes bulk upsert per user even with same note id", async () => {
    const aNote = makeNote("same-id", "A Title");
    const bNote = makeNote("same-id", "B Title");

    await request(app).post("/api/notes/bulk").set("x-test-sub", USER_A).send([aNote]).expect(200);
    await request(app).post("/api/notes/bulk").set("x-test-sub", USER_B).send([bNote]).expect(200);

    const aList = await request(app).get("/api/notes").set("x-test-sub", USER_A).expect(200);
    const bList = await request(app).get("/api/notes").set("x-test-sub", USER_B).expect(200);

    expect(aList.body).toHaveLength(1);
    expect(aList.body[0].id).toBe("same-id");
    expect(aList.body[0].title).toBe("A Title");
    expect(aList.body[0].ownerSub).toBe(USER_A);

    expect(bList.body).toHaveLength(1);
    expect(bList.body[0].id).toBe("same-id");
    expect(bList.body[0].title).toBe("B Title");
    expect(bList.body[0].ownerSub).toBe(USER_B);
  });
});
