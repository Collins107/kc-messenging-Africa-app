# Migration: Add Phase 4 group and community models

This migration adds new models for Groups, Communities, Channels, Polls, Stories, Business entities, and related tables.

-- WARNING: This SQL is a generated migration file for development/testing. Do NOT run against production databases.

-- Example SQL (Postgres)
CREATE TABLE IF NOT EXISTS "Group" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  is_private boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "GroupMember" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  muted_until timestamptz,
  banned boolean DEFAULT false
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_group_owner ON "Group" (owner_id);
CREATE INDEX IF NOT EXISTS idx_groupmember_group ON "GroupMember" (group_id);
