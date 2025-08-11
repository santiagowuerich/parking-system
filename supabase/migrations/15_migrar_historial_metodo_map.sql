-- Normalizar métodos de pago al migrar historial y evitar duplicados

-- Índice único lógico para prevenir duplicados de pagos por (est_id, veh_patente, pag_h_fh)
CREATE UNIQUE INDEX IF NOT EXISTS ux_pagos_key
ON pagos(est_id, veh_patente, pag_h_fh);

-- Insertar pagos desde parking_history con mapeo de método a catálogo
INSERT INTO pagos (pag_monto, pag_h_fh, est_id, mepa_metodo, veh_patente)
SELECT 
  ph.fee::real,
  ph.exit_time,
  1 AS est_id,
  CASE 
    WHEN ph.payment_method ILIKE 'efectivo%' THEN 'Efectivo'
    WHEN ph.payment_method ILIKE 'transfer%' THEN 'Transferencia'
    WHEN ph.payment_method ILIKE 'mercado%' THEN 'MercadoPago'
    WHEN ph.payment_method ILIKE 'mp%' THEN 'MercadoPago'
    ELSE 'Efectivo'
  END AS mepa_metodo,
  ph.license_plate
FROM parking_history ph
WHERE ph.exit_time IS NOT NULL
ON CONFLICT ON CONSTRAINT ux_pagos_key DO NOTHING;

-- Insertar ocupación con salida, enlazando al pago insertado
INSERT INTO ocupacion (
  est_id, ocu_fh_entrada, pla_numero, ocu_fh_salida, veh_patente, tiptar_nro, pag_nro
)
SELECT 
  1 AS est_id,
  ph.entry_time,
  1 AS pla_numero,
  ph.exit_time,
  ph.license_plate,
  NULL::INT AS tiptar_nro,
  p.pag_nro
FROM parking_history ph
JOIN pagos p 
  ON p.est_id = 1 
 AND p.veh_patente = ph.license_plate 
 AND p.pag_h_fh = ph.exit_time
WHERE ph.exit_time IS NOT NULL
ON CONFLICT DO NOTHING;




