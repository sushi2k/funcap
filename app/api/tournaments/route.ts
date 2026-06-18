import { json } from "@/server/security/route-helpers";
import { listTournaments } from "@/server/dal/tournaments";

export async function GET() {
  const tournaments = await listTournaments();
  return json({ tournaments });
}
