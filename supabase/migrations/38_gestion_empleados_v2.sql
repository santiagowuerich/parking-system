-- supabase/migrations/38_gestion_empleados_v2.sql
-- Versión completa del sistema de gestión de empleados

BEGIN;

-- 1. Modificar la tabla 'usuario' para añadir nuevos campos.
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS usu_estado VARCHAR(20) NOT NULL DEFAULT 'Activo';
ALTER TABLE public.usuario ADD COLUMN IF NOT EXISTS requiere_cambio_contrasena BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Crear una tabla catálogo para los turnos.
CREATE TABLE IF NOT EXISTS public.turnos_catalogo (
  turno_id SERIAL PRIMARY KEY,
  nombre_turno VARCHAR(50) UNIQUE NOT NULL -- 'Mañana', 'Tarde', 'Noche'
);

-- Insertar los turnos por defecto.
INSERT INTO public.turnos_catalogo (nombre_turno) VALUES ('Mañana'), ('Tarde'), ('Noche') ON CONFLICT DO NOTHING;

-- 3. Crear tabla para la disponibilidad recurrente de los empleados.
-- Almacena qué días de la semana y en qué turnos trabaja un playero.
CREATE TABLE IF NOT EXISTS public.disponibilidad_empleado (
  play_id INT NOT NULL,
  -- 1=Lunes, 2=Martes, ..., 7=Domingo
  dia_semana SMALLINT NOT NULL CHECK (dia_semana >= 1 AND dia_semana <= 7),
  turno_id INT NOT NULL,
  CONSTRAINT pk_disponibilidad_empleado PRIMARY KEY (play_id, dia_semana, turno_id),
  CONSTRAINT fk_de_playero FOREIGN KEY (play_id) REFERENCES public.playeros(play_id) ON DELETE CASCADE,
  CONSTRAINT fk_de_turno FOREIGN KEY (turno_id) REFERENCES public.turnos_catalogo(turno_id) ON DELETE CASCADE
);

-- 4. Recrear tabla para asignar playeros a uno o más estacionamientos (con mejoras).
DROP TABLE IF EXISTS public.empleados_estacionamiento;
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
COMMENT ON TABLE public.disponibilidad_empleado IS 'Disponibilidad recurrente semanal de los empleados por día y turno';
COMMENT ON COLUMN public.disponibilidad_empleado.dia_semana IS 'Día de la semana: 1=Lunes, 2=Martes, ..., 7=Domingo';
COMMENT ON TABLE public.turnos_catalogo IS 'Catálogo de turnos disponibles: Mañana, Tarde, Noche';

COMMIT;
