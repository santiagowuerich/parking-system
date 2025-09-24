-- Migration: Enable Supabase Realtime for new tables
-- Created: 2025-01-XX
-- Purpose: Enable real-time subscriptions for vehicle movements and plaza status changes

-- ============================================================================
-- Enable Realtime Publications for New Tables
-- ============================================================================

-- Add vehicle_movements table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_movements;

-- Add plaza_status_changes table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE plaza_status_changes;

-- ============================================================================
-- Create trigger functions for realtime updates
-- ============================================================================

-- Function to notify clients about vehicle movements
CREATE OR REPLACE FUNCTION notify_vehicle_movement()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform the notification to the 'vehicle_movements' channel
  PERFORM pg_notify('vehicle_movements', json_build_object(
    'operation', TG_OP,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    'est_id', COALESCE(NEW.est_id, OLD.est_id),
    'timestamp', extract(epoch from now())
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Function to notify clients about plaza status changes
CREATE OR REPLACE FUNCTION notify_plaza_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Perform the notification to the 'plaza_status_changes' channel
  PERFORM pg_notify('plaza_status_changes', json_build_object(
    'operation', TG_OP,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    'est_id', COALESCE(NEW.est_id, OLD.est_id),
    'timestamp', extract(epoch from now())
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create triggers for real-time notifications
-- ============================================================================

-- Trigger for vehicle movements
DROP TRIGGER IF EXISTS trigger_vehicle_movement_notify ON vehicle_movements;
CREATE TRIGGER trigger_vehicle_movement_notify
  AFTER INSERT OR UPDATE OR DELETE ON vehicle_movements
  FOR EACH ROW EXECUTE FUNCTION notify_vehicle_movement();

-- Trigger for plaza status changes
DROP TRIGGER IF EXISTS trigger_plaza_status_change_notify ON plaza_status_changes;
CREATE TRIGGER trigger_plaza_status_change_notify
  AFTER INSERT OR UPDATE OR DELETE ON plaza_status_changes
  FOR EACH ROW EXECUTE FUNCTION notify_plaza_status_change();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION notify_vehicle_movement() IS 'Sends real-time notifications when vehicle movements occur';
COMMENT ON FUNCTION notify_plaza_status_change() IS 'Sends real-time notifications when plaza status changes occur';

-- ============================================================================
-- Realtime setup completed successfully
-- ============================================================================