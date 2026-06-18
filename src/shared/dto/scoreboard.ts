// Public scoreboard view (req §10). Public/guest-readable: contains only
// display_name and derived statistics. Contains no email or any other PII
// (DAL-4, security.md §2.1).

export type SeasonStandingDTO = {
  rank: number;
  user_id: string;
  display_name: string;
  played: number;
  wins: number;
  losses: number;
  sets_for: number;
  sets_against: number;
  games_for: number;
  games_against: number;
};

export type SeasonScoreboardDTO = {
  tournament_id: string | null;
  tournament_name: string | null;
  rows: SeasonStandingDTO[];
};

export type CareerRankedDTO = {
  rank: number;
  user_id: string;
  display_name: string;
  played: number;
  wins: number;
  losses: number;
  win_pct: number;
};

export type CareerUnrankedDTO = Omit<CareerRankedDTO, "rank">;

export type CareerScoreboardDTO = {
  threshold: number;
  ranked: CareerRankedDTO[];
  unranked: CareerUnrankedDTO[];
};
