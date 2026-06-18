import { z } from "zod";
import { DisplayName } from "./user";

export const Email = z.string().email().max(254);

// Server-side policy (length + breach check) lives in src/server/auth/password.
// The Zod gate is just a structural sanity check so the route returns 400 for
// obviously-wrong shapes before reaching the service.
export const PasswordInput = z.string().min(12).max(256);

export const MfaCode = z.string().regex(/^\d{6}$/);

export const RegisterInput = z.object({
  email: Email,
  display_name: DisplayName,
  password: PasswordInput,
});

export const LoginInput = z.object({
  email: Email,
  password: z.string().min(1).max(256),
});

export const MfaVerifyInput = z.object({
  code: MfaCode,
});

export const MfaActivateInput = z.object({
  code: MfaCode,
});

export const ChangePasswordInput = z.object({
  current_password: z.string().min(1).max(256),
  new_password: PasswordInput,
});

export type RegisterInputT = z.infer<typeof RegisterInput>;
export type LoginInputT = z.infer<typeof LoginInput>;
export type MfaVerifyInputT = z.infer<typeof MfaVerifyInput>;
export type MfaActivateInputT = z.infer<typeof MfaActivateInput>;
export type ChangePasswordInputT = z.infer<typeof ChangePasswordInput>;
