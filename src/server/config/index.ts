import "server-only";
import { z } from "zod";

// The ONLY reader of secret process.env values (security.md SEC-1).
// All other modules import the validated `config` object below.
const Env = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32).optional(),
  TOTP_ENCRYPTION_KEY: z.string().min(32).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// eslint-disable-next-line no-restricted-syntax -- this file is the sanctioned env reader (SEC-1)
const parsed = Env.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const config = parsed.data;
export type Config = typeof config;
