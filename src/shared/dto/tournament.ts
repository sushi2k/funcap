import type { MatchFormat, TournamentState } from "@/domain/tournament/state";

// Public view of a tournament. Guest-readable (req §15), so no PII.
export type TournamentDTO = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  closing_ends_at: string;
  match_format: MatchFormat;
  finalized_at: string | null;
  state: TournamentState; // derived (req §5.2)
};
