// Match view returned by route handlers (req §6.3). No DAL-internal fields
// beyond what the UI needs; no email/secret leakage.
import type { MatchOutcome, SetScore } from "@/domain/scoring";
import type { MatchState, MatchType } from "@/domain/match/transitions";

export type MatchDTO = {
  id: string;
  tournament_id: string;
  type: MatchType;
  state: MatchState;
  player_a_id: string;
  player_b_id: string;
  entered_by_id: string;
  winner_id: string | null;
  outcome: MatchOutcome | null;
  sets: SetScore[];
  played_at: string;
  entered_at: string;
  resolved_at: string | null;
};

export type SuggestionDTO = {
  id: string;
  display_name: string;
  self_level: number | null;
};

// "My matches" view — used by GET /api/matches for the player UI.
// Decorated with opponent display name and whether the caller is the
// entrant, so the client can render the right affordance (approve/reject
// vs withdraw) without re-fetching user data.
export type MyMatchDTO = MatchDTO & {
  opponent_id: string;
  opponent_display_name: string;
  entered_by_me: boolean;
  needs_my_approval: boolean;
};
