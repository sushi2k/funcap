-- req §6.2 — one non-VOIDED OFFICIAL match per unordered player pair per
-- tournament. SQLite supports partial indexes; Prisma cannot express them
-- (hence this raw migration). Covers PENDING/DISPUTED/CONFIRMED so two
-- concurrent submissions for the same pairing collide at insert, not at
-- confirm.

CREATE UNIQUE INDEX "Match_one_per_pairing_uniq"
  ON "Match" ("tournament_id", "pair_low_id", "pair_high_id")
  WHERE "type" = 'OFFICIAL' AND "state" <> 'VOIDED';
