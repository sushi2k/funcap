import type { NextRequest } from "next/server";
import { errorJson, json } from "@/server/security/route-helpers";
import { getCurrentSession } from "@/server/auth/current-session";
import { SuggestionsQuery } from "@/shared/schemas/match";
import { listSuggestions } from "@/application/match";

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return errorJson(401, "Not authenticated");

  const url = new URL(req.url);
  const q = SuggestionsQuery.safeParse({ type: url.searchParams.get("type") ?? undefined });
  if (!q.success) return errorJson(400, "Invalid query");

  const suggestions = await listSuggestions({
    callerUserId: session.userId,
    type: q.data.type,
  });
  return json({ suggestions });
}
