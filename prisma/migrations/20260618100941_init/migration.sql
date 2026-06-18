-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "self_level" INTEGER,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "starts_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "closing_ends_at" TEXT NOT NULL,
    "match_format" TEXT NOT NULL,
    "finalized_at" TEXT
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournament_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "player_a_id" TEXT NOT NULL,
    "player_b_id" TEXT NOT NULL,
    "pair_low_id" TEXT NOT NULL,
    "pair_high_id" TEXT NOT NULL,
    "winner_id" TEXT,
    "outcome" TEXT,
    "sets" TEXT,
    "state" TEXT NOT NULL,
    "played_at" TEXT NOT NULL,
    "entered_by_id" TEXT NOT NULL,
    "entered_at" TEXT NOT NULL,
    "resolved_by_id" TEXT,
    "resolved_at" TEXT,
    "amended_by_id" TEXT,
    "amended_at" TEXT,
    CONSTRAINT "Match_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_entered_by_id_fkey" FOREIGN KEY ("entered_by_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_amended_by_id_fkey" FOREIGN KEY ("amended_by_id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT,
    "kind" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "created_at" TEXT NOT NULL,
    CONSTRAINT "AuditEvent_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_display_name_key" ON "User"("display_name");

-- CreateIndex
CREATE INDEX "Match_tournament_id_type_state_idx" ON "Match"("tournament_id", "type", "state");

-- CreateIndex
CREATE INDEX "Match_player_a_id_idx" ON "Match"("player_a_id");

-- CreateIndex
CREATE INDEX "Match_player_b_id_idx" ON "Match"("player_b_id");

-- CreateIndex
CREATE INDEX "Match_winner_id_idx" ON "Match"("winner_id");

-- CreateIndex
CREATE INDEX "Notification_user_id_read_idx" ON "Notification"("user_id", "read");

-- CreateIndex
CREATE INDEX "AuditEvent_actor_user_id_created_at_idx" ON "AuditEvent"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "Session_user_id_idx" ON "Session"("user_id");
