-- Phase 5 Foundation migration SQL (development)
-- This migration adds SFUSession, Recording, Stream, Organization, Team tables.

CREATE TABLE IF NOT EXISTS "SFUSession" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomName" text NOT NULL,
  "createdBy" uuid NOT NULL,
  "startedAt" timestamptz DEFAULT now(),
  "endedAt" timestamptz,
  metadata jsonb
);

CREATE TABLE IF NOT EXISTS "Recording" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" uuid NOT NULL REFERENCES "SFUSession"(id) ON DELETE CASCADE,
  "manifestPath" text NOT NULL,
  duration int,
  size int,
  "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Stream" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid NOT NULL,
  title text NOT NULL,
  "ingestKey" text UNIQUE NOT NULL,
  status text DEFAULT 'scheduled',
  "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Organization" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "ownerId" uuid NOT NULL,
  "createdAt" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Team" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  name text NOT NULL,
  "createdAt" timestamptz DEFAULT now()
);
