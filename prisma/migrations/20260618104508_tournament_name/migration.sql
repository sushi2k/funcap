/*
  Warnings:

  - Added the required column `name` to the `Tournament` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "starts_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "closing_ends_at" TEXT NOT NULL,
    "match_format" TEXT NOT NULL,
    "finalized_at" TEXT
);
INSERT INTO "new_Tournament" ("closing_ends_at", "ends_at", "finalized_at", "id", "match_format", "starts_at") SELECT "closing_ends_at", "ends_at", "finalized_at", "id", "match_format", "starts_at" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
