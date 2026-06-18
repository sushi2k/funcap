import type { NextRequest } from "next/server";
import { errorJson, json } from "@/server/security/route-helpers";
import { getTournamentById } from "@/server/dal/tournaments";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  // ID is opaque; let the DAL decide what's missing.
  if (typeof id !== "string" || id.length === 0) return errorJson(400, "Invalid id");
  const t = await getTournamentById(id);
  if (!t) return errorJson(404, "Tournament not found");
  return json({ tournament: t });
}
