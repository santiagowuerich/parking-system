-- supabase/migrations/37_gestion_empleados.sql
-- Crear tabla para asignar playeros a estacionamientos de manera escalable

BEGIN;

-- Tabla para asignar playeros a uno o más estacionamientos.
-- Un playero puede trabajar en varios lugares, y un lugar puede tener varios playeros.
CREATE TABLE IF NOT EXISTS public.empleados_estacionamiento (
  play_id INT NOT NULL,
  est_id INT NOT NULL,
  fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activo BOOLEAN DEFAULT true,
  CONSTRAINT pk_empleados_estacionamiento PRIMARY KEY (play_id, est_id),
  CONSTRAINT fk_ee_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id) ON DELETE CASCADE,
  CONSTRAINT fk_ee_estacionamiento FOREIGN KEY (est_id) REFERENCES public.estacionamientos(est_id) ON DELETE CASCADE
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_empleados_estacionamiento_est_id ON public.empleados_estacionamiento(est_id);
CREATE INDEX IF NOT EXISTS idx_empleados_estacionamiento_activo ON public.empleados_estacionamiento(activo);

-- Comentarios para documentación
COMMENT ON TABLE public.empleados_estacionamiento IS 'Tabla intermedia para asignar playeros a estacionamientos. Permite que un playero trabaje en múltiples estacionamientos y viceversa.';
COMMENT ON COLUMN public.empleados_estacionamiento.fecha_asignacion IS 'Fecha en que se realizó la asignación del playero al estacionamiento';
COMMENT ON COLUMN public.empleados_estacionamiento.activo IS 'Indica si la asignación está activa (true) o inactiva (false)';

COMMIT;
