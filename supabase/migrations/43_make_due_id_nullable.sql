-- Migration: Make due_id nullable in estacionamientos table
-- Reason: Remove dependency on traditional user system, use est_email instead

-- Make due_id nullable to allow parking creation without traditional user validation
ALTER TABLE estacionamientos ALTER COLUMN due_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN estacionamientos.due_id IS 'Optional: Reference to traditional user system. New parkings use est_email instead';
COMMENT ON COLUMN estacionamientos.est_email IS 'Required: Email of the authenticated user who owns this parking';
