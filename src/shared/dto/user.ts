// Public-safe view of a User. `email`, `password_hash`, and `totp_secret`
// are intentionally absent (security.md DAL-4).
export type PublicUserDTO = {
  id: string;
  display_name: string;
  self_level: number | null;
};
