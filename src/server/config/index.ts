import "server-only";
import { z } from "zod";

// The ONLY reader of secret process.env values (security.md SEC-1).
// All other modules import the validated `config` object below.
const Env = z.object({
  DATABASE_URL: z.string().min(1),

  // 32-byte (256-bit) keys, hex or base64; minimum 32 chars enforced here.
  SESSION_SECRET: z.string().min(32),
  TOTP_ENCRYPTION_KEY: z.string().min(32),

  // Solo-local-only relaxation (req §18.11). Must never be true in shared deploys.
  ADMIN_MFA_RELAXED: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  // Seed inputs — only the seed script consumes these.
  FIRST_ADMIN_EMAIL: z.string().email().optional(),
  FIRST_ADMIN_DISPLAY_NAME: z.string().min(2).max(30).optional(),
  FIRST_ADMIN_PASSWORD: z.string().min(12).optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// eslint-disable-next-line no-restricted-syntax -- this file is the sanctioned env reader (SEC-1)
const parsed = Env.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const config = parsed.data;
export type Config = typeof config;

// Cookie + session policy (security.md §3).
export const policy = {
  cookie: {
    sessionName: "funcap_session",
    csrfName: "funcap_csrf",
    mfaChallengeName: "funcap_mfa_challenge",
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.NODE_ENV === "production",
  },
  session: {
    player: { idleMs: 30 * 60_000, absoluteMs: 12 * 60 * 60_000 },
    admin: { idleMs: 15 * 60_000, absoluteMs: 8 * 60 * 60_000 },
  },
  mfaChallengeTtlMs: 5 * 60_000,
  stepUpWindowMs: 5 * 60_000,
  argon2: { memoryCostKiB: 19_456, timeCost: 2, parallelism: 1 },
  rateLimit: {
    loginPerAccountPerMin: 5,
    registerPerIpPerHour: 5,
    mutationPerSessionPerMin: 60,
    loginLockout: { windowMs: 15 * 60_000, threshold: 5, lockMs: 15 * 60_000 },
  },
  maxJsonBodyBytes: 64 * 1024,
};
