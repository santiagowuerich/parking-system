-- Migration: Add vehicle movements and plaza status changes logging tables
-- Created: 2025-01-XX
-- Purpose: Enable tracking of vehicle movements between plazas and plaza status changes

-- ============================================================================
-- 1. Create vehicle_movements table for logging vehicle movements between plazas
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicle_movements (
  mov_id SERIAL PRIMARY KEY,
  est_id INTEGER NOT NULL REFERENCES estacionamientos(est_id) ON DELETE CASCADE,
  veh_patente VARCHAR(10) NOT NULL REFERENCES vehiculos(veh_patente) ON DELETE CASCADE,
  pla_origen INTEGER NOT NULL,
  pla_destino INTEGER NOT NULL,
  mov_fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  mov_razon TEXT DEFAULT 'Movimiento manual',
  usu_id INTEGER REFERENCES usuarios(usu_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT vehicle_movements_different_plazas CHECK (pla_origen != pla_destino),
  CONSTRAINT vehicle_movements_positive_plazas CHECK (pla_origen > 0 AND pla_destino > 0)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_vehicle_movements_est_id ON vehicle_movements(est_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_movements_fecha ON vehicle_movements(mov_fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_movements_patente ON vehicle_movements(veh_patente);
CREATE INDEX IF NOT EXISTS idx_vehicle_movements_plazas ON vehicle_movements(est_id, pla_origen, pla_destino);

-- ============================================================================
-- 2. Create plaza_status_changes table for logging plaza status changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS plaza_status_changes (
  psc_id SERIAL PRIMARY KEY,
  est_id INTEGER NOT NULL REFERENCES estacionamientos(est_id) ON DELETE CASCADE,
  pla_numero INTEGER NOT NULL,
  psc_estado_anterior VARCHAR(20) NOT NULL,
  psc_estado_nuevo VARCHAR(20) NOT NULL,
  psc_fecha_hora TIMESTAMP NOT NULL DEFAULT NOW(),
  psc_razon TEXT DEFAULT 'Cambio manual',
  usu_id INTEGER REFERENCES usuarios(usu_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT plaza_status_changes_valid_estados CHECK (
    psc_estado_anterior IN ('Libre', 'Ocupada', 'Reservada', 'Mantenimiento') AND
    psc_estado_nuevo IN ('Libre', 'Ocupada', 'Reservada', 'Mantenimiento')
  ),
  CONSTRAINT plaza_status_changes_different_estados CHECK (psc_estado_anterior != psc_estado_nuevo),
  CONSTRAINT plaza_status_changes_positive_plaza CHECK (pla_numero > 0)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_plaza_status_changes_est_id ON plaza_status_changes(est_id);
CREATE INDEX IF NOT EXISTS idx_plaza_status_changes_fecha ON plaza_status_changes(psc_fecha_hora DESC);
CREATE INDEX IF NOT EXISTS idx_plaza_status_changes_plaza ON plaza_status_changes(est_id, pla_numero);
CREATE INDEX IF NOT EXISTS idx_plaza_status_changes_estado ON plaza_status_changes(psc_estado_nuevo);

-- ============================================================================
-- 3. Set up Row Level Security (RLS) policies
-- ============================================================================

-- Enable RLS for vehicle_movements
ALTER TABLE vehicle_movements ENABLE ROW LEVEL SECURITY;

-- Policy for users to view movements from their parkings
CREATE POLICY "Users can view movements from their parkings" ON vehicle_movements
  FOR SELECT USING (
    est_id IN (
      SELECT ee.est_id
      FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
      UNION
      SELECT e.est_id
      FROM estacionamientos e
      WHERE e.usu_id = auth.uid()
    )
  );

-- Policy for users to insert movements for their parkings
CREATE POLICY "Users can insert movements for their parkings" ON vehicle_movements
  FOR INSERT WITH CHECK (
    est_id IN (
      SELECT ee.est_id
      FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
      UNION
      SELECT e.est_id
      FROM estacionamientos e
      WHERE e.usu_id = auth.uid()
    )
  );

-- Enable RLS for plaza_status_changes
ALTER TABLE plaza_status_changes ENABLE ROW LEVEL SECURITY;

-- Policy for users to view status changes from their parkings
CREATE POLICY "Users can view status changes from their parkings" ON plaza_status_changes
  FOR SELECT USING (
    est_id IN (
      SELECT ee.est_id
      FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
      UNION
      SELECT e.est_id
      FROM estacionamientos e
      WHERE e.usu_id = auth.uid()
    )
  );

-- Policy for users to insert status changes for their parkings
CREATE POLICY "Users can insert status changes for their parkings" ON plaza_status_changes
  FOR INSERT WITH CHECK (
    est_id IN (
      SELECT ee.est_id
      FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
      UNION
      SELECT e.est_id
      FROM estacionamientos e
      WHERE e.usu_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. Add missing estado column to plazas table if it doesn't exist
-- ============================================================================

-- Check if pla_estado column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'plazas' AND column_name = 'pla_estado'
    ) THEN
        ALTER TABLE plazas ADD COLUMN pla_estado VARCHAR(20) DEFAULT 'Libre';

        -- Add constraint for valid estados
        ALTER TABLE plazas ADD CONSTRAINT plazas_valid_estado
        CHECK (pla_estado IN ('Libre', 'Ocupada', 'Reservada', 'Mantenimiento'));

        -- Create index for estado column
        CREATE INDEX idx_plazas_estado ON plazas(pla_estado);
    END IF;
END $$;

-- ============================================================================
-- 5. Create useful views for reporting
-- ============================================================================

-- View for recent vehicle movements with user info
CREATE OR REPLACE VIEW vw_vehicle_movements_detailed AS
SELECT
  vm.mov_id,
  vm.est_id,
  e.est_nombre,
  vm.veh_patente,
  vm.pla_origen,
  vm.pla_destino,
  vm.mov_fecha_hora,
  vm.mov_razon,
  u.usu_nombre as usuario_nombre,
  u.usu_email as usuario_email
FROM vehicle_movements vm
LEFT JOIN estacionamientos e ON vm.est_id = e.est_id
LEFT JOIN usuarios u ON vm.usu_id = u.usu_id
ORDER BY vm.mov_fecha_hora DESC;

-- View for recent plaza status changes with user info
CREATE OR REPLACE VIEW vw_plaza_status_changes_detailed AS
SELECT
  psc.psc_id,
  psc.est_id,
  e.est_nombre,
  psc.pla_numero,
  psc.psc_estado_anterior,
  psc.psc_estado_nuevo,
  psc.psc_fecha_hora,
  psc.psc_razon,
  u.usu_nombre as usuario_nombre,
  u.usu_email as usuario_email
FROM plaza_status_changes psc
LEFT JOIN estacionamientos e ON psc.est_id = e.est_id
LEFT JOIN usuarios u ON psc.usu_id = u.usu_id
ORDER BY psc.psc_fecha_hora DESC;

-- ============================================================================
-- 6. Comments for documentation
-- ============================================================================

COMMENT ON TABLE vehicle_movements IS 'Log of vehicle movements between plazas within parking lots';
COMMENT ON COLUMN vehicle_movements.pla_origen IS 'Origin plaza number';
COMMENT ON COLUMN vehicle_movements.pla_destino IS 'Destination plaza number';
COMMENT ON COLUMN vehicle_movements.mov_razon IS 'Reason for the movement (manual, maintenance, etc.)';

COMMENT ON TABLE plaza_status_changes IS 'Log of plaza status changes (libre, ocupada, mantenimiento, etc.)';
COMMENT ON COLUMN plaza_status_changes.psc_estado_anterior IS 'Previous plaza status';
COMMENT ON COLUMN plaza_status_changes.psc_estado_nuevo IS 'New plaza status';
COMMENT ON COLUMN plaza_status_changes.psc_razon IS 'Reason for the status change';

-- ============================================================================
-- Migration completed successfully
-- ============================================================================