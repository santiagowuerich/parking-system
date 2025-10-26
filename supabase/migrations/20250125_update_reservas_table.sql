-- Migración optimizada para actualizar tabla reservas con nuevos campos y funcionalidades
-- Fecha: 2025-01-25
-- Descripción: Agregar campos necesarios para sistema de reservas completo

-- ============================================
-- 1. ACTUALIZACIÓN DE TABLA RESERVAS
-- ============================================

-- Agregar nuevos campos a la tabla reservas
ALTER TABLE public.reservas 
ADD COLUMN IF NOT EXISTS res_fh_fin timestamp without time zone,
ADD COLUMN IF NOT EXISTS res_tiempo_gracia_min integer DEFAULT 15 CHECK (res_tiempo_gracia_min > 0 AND res_tiempo_gracia_min <= 60),
ADD COLUMN IF NOT EXISTS res_created_at timestamp without time zone DEFAULT now(),
ADD COLUMN IF NOT EXISTS res_codigo character varying UNIQUE;

-- Actualizar constraint de res_estado para incluir nuevos estados
ALTER TABLE public.reservas 
DROP CONSTRAINT IF EXISTS reservas_res_estado_check;

ALTER TABLE public.reservas 
ADD CONSTRAINT reservas_res_estado_check 
CHECK (res_estado::text = ANY (ARRAY[
  'pendiente_pago'::character varying,
  'confirmada'::character varying,
  'activa'::character varying,
  'completada'::character varying,
  'cancelada'::character varying,
  'expirada'::character varying,
  'no_show'::character varying
]::text[]));

-- Agregar constraint para validar fechas
ALTER TABLE public.reservas 
ADD CONSTRAINT reservas_fechas_validas 
CHECK (res_fh_fin > res_fh_ingreso);

-- ============================================
-- 2. ÍNDICES OPTIMIZADOS
-- ============================================

-- Índice compuesto para consultas de disponibilidad (más eficiente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservas_disponibilidad 
ON public.reservas (est_id, pla_numero, res_estado, res_fh_ingreso, res_fh_fin)
WHERE res_estado IN ('confirmada', 'activa');

-- Índice para consultas del conductor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservas_conductor_fecha 
ON public.reservas (con_id, res_estado, res_fh_ingreso DESC);

-- Índice único para código (ya existe pero asegurémonos)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_reservas_codigo_unique 
ON public.reservas (res_codigo);

-- Índice para expiración automática
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservas_expiracion 
ON public.reservas (res_estado, res_fh_ingreso, res_tiempo_gracia_min)
WHERE res_estado = 'confirmada';

-- ============================================
-- 3. SECUENCIA Y FUNCIONES OPTIMIZADAS
-- ============================================

-- Crear secuencia para códigos de reserva con cache
CREATE SEQUENCE IF NOT EXISTS reservas_codigo_seq CACHE 10;

-- Función optimizada para generar código único de reserva
CREATE OR REPLACE FUNCTION generar_codigo_reserva()
RETURNS text AS $$
DECLARE
    fecha_str text;
    secuencia text;
    codigo text;
    intentos integer := 0;
BEGIN
    -- Formato: RES-YYYYMMDD-NNNN
    fecha_str := to_char(now(), 'YYYYMMDD');
    
    LOOP
        -- Obtener siguiente número de secuencia
        secuencia := lpad(nextval('reservas_codigo_seq')::text, 4, '0');
        codigo := 'RES-' || fecha_str || '-' || secuencia;
        
        -- Verificar unicidad (por si hay colisiones)
        IF NOT EXISTS (SELECT 1 FROM reservas WHERE res_codigo = codigo) THEN
            RETURN codigo;
        END IF;
        
        intentos := intentos + 1;
        IF intentos > 100 THEN
            RAISE EXCEPTION 'No se pudo generar código único después de 100 intentos';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función optimizada para validar disponibilidad de plaza
CREATE OR REPLACE FUNCTION validar_disponibilidad_plaza(
    p_est_id integer,
    p_pla_numero integer,
    p_fecha_inicio timestamp without time zone,
    p_fecha_fin timestamp without time zone
)
RETURNS boolean AS $$
DECLARE
    estado_plaza text;
BEGIN
    -- Verificar estado de la plaza (una sola consulta)
    SELECT pla_estado INTO estado_plaza
    FROM plazas 
    WHERE est_id = p_est_id AND pla_numero = p_pla_numero;
    
    -- Si no existe la plaza o está en mantenimiento/abonada, no disponible
    IF NOT FOUND OR estado_plaza IN ('Mantenimiento', 'Abonado') THEN
        RETURN false;
    END IF;
    
    -- Verificar conflictos en una sola consulta usando EXISTS
    RETURN NOT EXISTS (
        -- Conflictos con reservas
        SELECT 1 FROM reservas 
        WHERE est_id = p_est_id 
        AND pla_numero = p_pla_numero
        AND res_estado IN ('confirmada', 'activa')
        AND res_fh_ingreso < p_fecha_fin 
        AND res_fh_fin > p_fecha_inicio
        
        UNION ALL
        
        -- Conflictos con ocupaciones activas
        SELECT 1 FROM ocupacion 
        WHERE est_id = p_est_id 
        AND pla_numero = p_pla_numero
        AND ocu_fh_salida IS NULL
        AND ocu_fh_entrada < p_fecha_fin
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Función optimizada para expirar reservas automáticamente
CREATE OR REPLACE FUNCTION expirar_reservas_no_show()
RETURNS integer AS $$
DECLARE
    reservas_expiradas integer;
BEGIN
    -- Usar una sola consulta UPDATE con RETURNING
    WITH reservas_a_expirar AS (
        SELECT res_codigo
        FROM reservas 
        WHERE res_estado = 'confirmada'
        AND res_fh_ingreso + (res_tiempo_gracia_min || ' minutes')::interval < now()
        LIMIT 1000  -- Limitar para evitar bloqueos largos
    )
    UPDATE reservas 
    SET res_estado = 'no_show'
    WHERE res_codigo IN (SELECT res_codigo FROM reservas_a_expirar);
    
    GET DIAGNOSTICS reservas_expiradas = ROW_COUNT;
    
    -- Log para debugging
    IF reservas_expiradas > 0 THEN
        RAISE NOTICE 'Expiraron % reservas', reservas_expiradas;
    END IF;
    
    RETURN reservas_expiradas;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. TRIGGERS OPTIMIZADOS
-- ============================================

-- Trigger optimizado para generar código automáticamente
CREATE OR REPLACE FUNCTION trigger_generar_codigo_reserva()
RETURNS trigger AS $$
BEGIN
    -- Solo generar código si no existe
    IF NEW.res_codigo IS NULL OR NEW.res_codigo = '' THEN
        NEW.res_codigo := generar_codigo_reserva();
    END IF;
    
    -- Establecer fecha de creación si no existe
    IF NEW.res_created_at IS NULL THEN
        NEW.res_created_at := now();
    END IF;
    
    -- Validar que res_fh_fin sea posterior a res_fh_ingreso
    IF NEW.res_fh_fin IS NOT NULL AND NEW.res_fh_fin <= NEW.res_fh_ingreso THEN
        RAISE EXCEPTION 'La fecha de fin debe ser posterior a la fecha de inicio';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger
DROP TRIGGER IF EXISTS trigger_reservas_generar_codigo ON public.reservas;
CREATE TRIGGER trigger_reservas_generar_codigo
    BEFORE INSERT ON public.reservas
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generar_codigo_reserva();

-- ============================================
-- 5. VISTA OPTIMIZADA CON ÍNDICES
-- ============================================

-- Crear vista optimizada para reservas con detalles completos
CREATE OR REPLACE VIEW vw_reservas_detalles AS
SELECT 
    r.est_id,
    r.pla_numero,
    r.veh_patente,
    r.res_fh_ingreso,
    r.res_fh_fin,
    r.con_id,
    r.pag_nro,
    r.res_estado,
    r.res_monto,
    r.res_tiempo_gracia_min,
    r.res_created_at,
    r.res_codigo,
    -- Datos del estacionamiento
    e.est_nombre,
    e.est_direc,
    e.est_telefono,
    e.est_email,
    -- Datos de la plaza
    p.pla_zona,
    p.catv_segmento,
    -- Datos del vehículo
    v.veh_marca,
    v.veh_modelo,
    v.veh_color,
    -- Datos del conductor
    u.usu_nom,
    u.usu_ape,
    u.usu_tel,
    u.usu_email,
    -- Estado calculado (optimizado)
    CASE 
        WHEN r.res_estado = 'confirmada' 
        AND r.res_fh_ingreso + (r.res_tiempo_gracia_min || ' minutes')::interval < now() 
        THEN 'expirada'
        ELSE r.res_estado
    END as estado_calculado
FROM reservas r
JOIN estacionamientos e ON r.est_id = e.est_id
JOIN plazas p ON r.est_id = p.est_id AND r.pla_numero = p.pla_numero
JOIN vehiculos v ON r.veh_patente = v.veh_patente
JOIN conductores c ON r.con_id = c.con_id
JOIN usuario u ON c.con_id = u.usu_id;

-- ============================================
-- 6. FUNCIONES DE UTILIDAD ADICIONALES
-- ============================================

-- Función para obtener estadísticas de reservas
CREATE OR REPLACE FUNCTION obtener_estadisticas_reservas(p_est_id integer, p_fecha date DEFAULT CURRENT_DATE)
RETURNS TABLE (
    total_reservas bigint,
    reservas_confirmadas bigint,
    reservas_activas bigint,
    reservas_no_show bigint,
    ingresos_totales numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_reservas,
        COUNT(*) FILTER (WHERE res_estado = 'confirmada') as reservas_confirmadas,
        COUNT(*) FILTER (WHERE res_estado = 'activa') as reservas_activas,
        COUNT(*) FILTER (WHERE res_estado = 'no_show') as reservas_no_show,
        COALESCE(SUM(res_monto) FILTER (WHERE res_estado IN ('confirmada', 'activa', 'completada')), 0) as ingresos_totales
    FROM reservas 
    WHERE est_id = p_est_id 
    AND DATE(res_fh_ingreso) = p_fecha;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 7. COMENTARIOS Y DOCUMENTACIÓN
-- ============================================

COMMENT ON TABLE public.reservas IS 'Tabla de reservas de plazas de estacionamiento con sistema completo de gestión';
COMMENT ON COLUMN public.reservas.res_fh_fin IS 'Fecha y hora de finalización de la reserva';
COMMENT ON COLUMN public.reservas.res_tiempo_gracia_min IS 'Minutos de tolerancia para llegar después de la hora de inicio (1-60)';
COMMENT ON COLUMN public.reservas.res_created_at IS 'Fecha y hora de creación de la reserva';
COMMENT ON COLUMN public.reservas.res_codigo IS 'Código único identificador de la reserva (formato: RES-YYYYMMDD-NNNN)';

COMMENT ON FUNCTION generar_codigo_reserva() IS 'Genera un código único para identificar reservas con verificación de unicidad';
COMMENT ON FUNCTION validar_disponibilidad_plaza(integer, integer, timestamp, timestamp) IS 'Valida si una plaza está disponible en un rango horario específico (optimizada)';
COMMENT ON FUNCTION expirar_reservas_no_show() IS 'Marca como no_show las reservas confirmadas que han expirado (con límite de seguridad)';
COMMENT ON FUNCTION obtener_estadisticas_reservas(integer, date) IS 'Obtiene estadísticas de reservas para un estacionamiento en una fecha específica';

-- ============================================
-- 8. CONFIGURACIÓN DE PERFORMANCE
-- ============================================

-- Configurar estadísticas para optimización del query planner
ALTER TABLE public.reservas ALTER COLUMN res_estado SET STATISTICS 100;
ALTER TABLE public.reservas ALTER COLUMN res_fh_ingreso SET STATISTICS 1000;
ALTER TABLE public.reservas ALTER COLUMN est_id SET STATISTICS 1000;
ALTER TABLE public.reservas ALTER COLUMN pla_numero SET STATISTICS 1000;

-- 7. CORRECCIÓN DE RESTRICCIONES (Ejecutar después de creación de tabla)
-- Eliminar restricción única incorrecta si existe
ALTER TABLE public.reservas
DROP CONSTRAINT IF EXISTS pk_reservas CASCADE;

-- Asegurar que solo res_codigo sea única (ya está por definición de UNIQUE en la columna)
-- Esta es la única restricción única que debería existir

-- Verificar que res_codigo sea unique (ya lo está por ser UNIQUE en la columna)
ALTER TABLE public.reservas
ADD CONSTRAINT uk_reservas_codigo UNIQUE (res_codigo) ON CONFLICT DO NOTHING;

