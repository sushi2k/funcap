import "server-only";
import { prisma } from "./prisma";
import type { PublicUserDTO } from "@/shared/dto/user";

// DAL example: returns a DTO, never a raw Prisma row (security.md DAL-4).
// `email`, `password_hash`, and `totp_secret` never leave this layer.
export async function findPublicUserByDisplayName(
  display_name: string,
): Promise<PublicUserDTO | null> {
  const row = await prisma.user.findUnique({
    where: { display_name },
    select: {
      id: true,
      display_name: true,
      self_level: true,
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    display_name: row.display_name,
    self_level: row.self_level ?? null,
  };
}
