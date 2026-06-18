import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorJson, json } from "@/server/security/route-helpers";
import { getCareerScoreboard, getSeasonScoreboard } from "@/application/scoreboard";

// Public endpoint — req §10 / §15. Guest-readable; no session or CSRF since
// it is a safe GET. Returns DTOs only — no email, no PII (DAL-4).
const Query = z.object({ view: z.enum(["season", "career"]).default("season") });

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const parsed = Query.safeParse({ view: url.searchParams.get("view") ?? undefined });
  if (!parsed.success) return errorJson(400, "Invalid view");
  if (parsed.data.view === "season") {
    const scoreboard = await getSeasonScoreboard();
    return json({ view: "season", scoreboard });
  }
  const scoreboard = await getCareerScoreboard();
  return json({ view: "career", scoreboard });
}
