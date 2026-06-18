// Seed: first admin (req §3) + optional sample tournament for dev.
// Idempotent and silent if the relevant env vars are absent.
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

async function seedFirstAdmin() {
  const email = process.env.FIRST_ADMIN_EMAIL;
  const display_name = process.env.FIRST_ADMIN_DISPLAY_NAME;
  const password = process.env.FIRST_ADMIN_PASSWORD;

  if (!email || !display_name || !password) {
    console.log("[seed] FIRST_ADMIN_EMAIL/DISPLAY_NAME/PASSWORD not set — skipping admin.");
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

async function seedSampleTournament() {
  if (process.env.FUNCAP_SEED_SAMPLE_TOURNAMENT !== "true") return;
  const existing = await prisma.tournament.count();
  if (existing > 0) {
    console.log("[seed] A tournament already exists; skipping sample.");
    return;
  }
  // Active window centred on `now` so the dev sees ACTIVE state immediately.
  const now = Date.now();
  const startsAt = new Date(now - 30 * 24 * 60 * 60_000); // 30 days ago
  const endsAt = new Date(startsAt);
  endsAt.setUTCMonth(endsAt.getUTCMonth() + 3);
  const closingEndsAt = new Date(endsAt.getTime() + 7 * 24 * 60 * 60_000);

  await prisma.tournament.create({
    data: {
      id: randomUUID(),
      name: "Dev sample tournament",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      closing_ends_at: closingEndsAt.toISOString(),
      match_format: "BEST_OF_3_FULL",
    },
  });
  console.log("[seed] Created sample tournament (ACTIVE window centred on now).");
}

async function main() {
  await seedFirstAdmin();
  await seedSampleTournament();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
