import { z } from "zod";

// req §7.1 — set object. Numeric ranges are sanity-only at this layer;
// the authoritative validity rules live in src/domain/scoring.
const NonNegSmallInt = z.number().int().min(0).max(50);

export const SetScoreInput = z.object({
  a: NonNegSmallInt,
  b: NonNegSmallInt,
  tb_a: NonNegSmallInt.optional(),
  tb_b: NonNegSmallInt.optional(),
}).strict();

export const Outcome = z.enum(["COMPLETED", "RETIRED", "WALKOVER"]);
export const MatchTypeInput = z.enum(["OFFICIAL", "FRIENDLY"]);

const Iso = z
  .string()
  .min(20)
  .max(35)
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be a valid ISO-8601 timestamp");

// Mass-assignment guard (security.md DAL-2 / req §18.5): clients name only
// what they're allowed to set. Server derives winner_id, pair_*_id, state,
// tournament_id, entered_by_id, entered_at, etc.
export const EnterMatchInput = z
  .object({
    opponent_id: z.string().uuid(),
    type: MatchTypeInput,
    outcome: Outcome,
    sets: z.array(SetScoreInput).max(3),
    played_at: Iso,
    retired_by_id: z.string().uuid().optional(),
    walkover_winner_id: z.string().uuid().optional(),
  })
  .strict();

export const EditMatchInput = z
  .object({
    outcome: Outcome,
    sets: z.array(SetScoreInput).max(3),
    retired_by_id: z.string().uuid().optional(),
    walkover_winner_id: z.string().uuid().optional(),
  })
  .strict();

export const RejectMatchInput = z
  .object({
    reason: z.string().min(1).max(500),
  })
  .strict();

// /matchmaking/suggestions
export const SuggestionsQuery = z
  .object({
    type: MatchTypeInput.default("OFFICIAL"),
  })
  .strict();

export type EnterMatchInputT = z.infer<typeof EnterMatchInput>;
export type EditMatchInputT = z.infer<typeof EditMatchInput>;
export type RejectMatchInputT = z.infer<typeof RejectMatchInput>;
export type SetScoreInputT = z.infer<typeof SetScoreInput>;
