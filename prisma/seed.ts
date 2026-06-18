// Seed: first admin (req §3). Idempotent and silent if env vars are absent.
//
// Uses Prisma + argon2 directly (no path aliases / no 'server-only') so it
// runs cleanly under `tsx prisma/seed.ts`.

import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();
// `Algorithm.Argon2id` is a const enum (= 2); literal used because of
// tsconfig `isolatedModules`.
const ARGON2ID = 2 as const;

async function main() {
  const email = process.env.FIRST_ADMIN_EMAIL;
  const display_name = process.env.FIRST_ADMIN_DISPLAY_NAME;
  const password = process.env.FIRST_ADMIN_PASSWORD;

  if (!email || !display_name || !password) {
    console.log("[seed] FIRST_ADMIN_EMAIL/DISPLAY_NAME/PASSWORD not set — skipping.");
    return;
  }
  if (password.length < 12) {
    console.error("[seed] FIRST_ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("[seed] First admin already exists; nothing to do.");
    return;
  }

  const password_hash = await hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  const nowIso = new Date().toISOString();
  await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      display_name,
      password_hash,
      role: "ADMIN",
      status: "ACTIVE",
      mfa_enabled: false,
      created_at: nowIso,
      updated_at: nowIso,
    },
  });
  console.log(`[seed] Created first admin: ${display_name}.`);
  console.log("[seed] Log in once, then enrol TOTP (admin sensitive actions require MFA).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
