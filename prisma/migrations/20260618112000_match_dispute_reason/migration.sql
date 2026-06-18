-- req §6.3 — counterparty's reason text when they reject a PENDING match.
ALTER TABLE "Match" ADD COLUMN "dispute_reason" TEXT;
