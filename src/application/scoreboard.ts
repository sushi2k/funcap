import "server-only";
import { deriveSeasonStandings } from "@/domain/standings";
import { deriveCareerBoard, DEFAULT_CAREER_THRESHOLD } from "@/domain/career";
import {
  listConfirmedOfficialInTournament,
  listAllConfirmedOfficial,
  getDisplayNamesFor,
} from "@/server/dal/scoreboard";
import { listTournaments } from "@/server/dal/tournaments";
import type {
  CareerRankedDTO,
  CareerScoreboardDTO,
  CareerUnrankedDTO,
  SeasonScoreboardDTO,
  SeasonStandingDTO,
} from "@/shared/dto/scoreboard";

// Picks the current season tournament — req §10: "this season" is the
// tournament currently ACTIVE or CLOSING. After finalize, the season board
// for that tournament freezes; until the next ACTIVE starts, there is no
// current season. Caller renders an empty placeholder in that case.
export async function getSeasonScoreboard(now: number = Date.now()): Promise<SeasonScoreboardDTO> {
  const all = await listTournaments(now);
  const current = all.find((t) => t.state === "ACTIVE" || t.state === "CLOSING");
  if (!current) return { tournament_id: null, tournament_name: null, rows: [] };

  const matches = await listConfirmedOfficialInTournament(current.id);
  const userIds = new Set<string>();
  for (const m of matches) {
    userIds.add(m.player_a_id);
    userIds.add(m.player_b_id);
  }
  const names = await getDisplayNamesFor(Array.from(userIds));
  const standings = deriveSeasonStandings(matches, names);
  const rows: SeasonStandingDTO[] = standings.map((s, i) => ({
    rank: i + 1,
    user_id: s.user_id,
    display_name: s.display_name,
    played: s.played,
    wins: s.wins,
    losses: s.losses,
    sets_for: s.sets_for,
    sets_against: s.sets_against,
    games_for: s.games_for,
    games_against: s.games_against,
  }));
  return { tournament_id: current.id, tournament_name: current.name, rows };
}

export async function getCareerScoreboard(
  threshold: number = DEFAULT_CAREER_THRESHOLD,
): Promise<CareerScoreboardDTO> {
  const matches = await listAllConfirmedOfficial();
  const userIds = new Set<string>();
  for (const m of matches) {
    userIds.add(m.player_a_id);
    userIds.add(m.player_b_id);
  }
  const names = await getDisplayNamesFor(Array.from(userIds));
  const board = deriveCareerBoard(matches, names, threshold);

  const ranked: CareerRankedDTO[] = board.ranked.map((r, i) => ({
    rank: i + 1,
    user_id: r.user_id,
    display_name: r.display_name,
    played: r.played,
    wins: r.wins,
    losses: r.losses,
    win_pct: r.win_pct,
  }));
  const unranked: CareerUnrankedDTO[] = board.unranked.map((r) => ({
    user_id: r.user_id,
    display_name: r.display_name,
    played: r.played,
    wins: r.wins,
    losses: r.losses,
    win_pct: r.win_pct,
  }));
  return { threshold: board.threshold, ranked, unranked };
}
