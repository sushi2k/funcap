// /me view. `email` is returned to the owner only (req §18.8 — never to
// guest/public endpoints, but the owner reads it from their own profile).
// `password_hash` and `totp_secret` never appear here.
export type MeDTO = {
  id: string;
  email: string;
  display_name: string;
  role: "PLAYER" | "ADMIN";
  status: "ACTIVE" | "LEFT";
  self_level: number | null;
  mfa_enabled: boolean;
  must_change_password: boolean;
};
