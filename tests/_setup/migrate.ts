import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

// vitest globalSetup — runs once before any test file. Creates a fresh
// test SQLite database with the full migration history applied, so DAL
// integration tests can exercise Prisma + constraints (e.g. the §6.2
// partial unique index).
export default function setup() {
  const dbPath = path.resolve(__dirname, "..", "..", "test-only.db");
  if (existsSync(dbPath)) rmSync(dbPath);
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, "..", ".."),
    env: { ...process.env, DATABASE_URL: "file:./test-only.db" },
    stdio: "ignore",
  });
}
