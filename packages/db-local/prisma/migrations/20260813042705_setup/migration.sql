-- CreateEnum
CREATE TYPE "LocalSessionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "local_sessions" (
    "id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "external_user_id" UUID NOT NULL,
    "central_session_id" UUID NOT NULL,
    "application_id" TEXT NOT NULL,
    "status" "LocalSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,

    CONSTRAINT "local_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_cache" (
    "external_user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "groups" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_cache_pkey" PRIMARY KEY ("external_user_id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "application_id" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" TEXT NOT NULL,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("application_id","event_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "local_sessions_session_token_hash_key" ON "local_sessions"("session_token_hash");
