Fase 0 — Fundaciones (0.5 sprint)

Objetivo: dejar listas bases visuales y de datos para que todo el resto caiga solo.

Tokens & componentes UI

Tailwind + shadcn/ui: Button, Badge, Dialog, Popover, Tooltip, Table, Select, Input.

Escala tipográfica y espaciados (4/8/12/16/24).

Paleta accesible para estados: libre (verde), ocupado (rojo), bloqueado (gris), reservado (amarillo).

Estados de plaza (normalizados)

FREE | OCCUPIED | RESERVED | BLOCKED | OOS (+ type: COMMON | EV | DISCAP | ROOFED).

Asegurar aria-label por plaza (“Plaza B0104 — Ocupada, ABC123”).

Realtime

Canal Supabase por zone_id para: plazas, estancias, movimientos.

Invalida cachés finos (plaza afectada + KPIs de su zona).

Fase 1 — “Estado en tiempo real” + Acciones en celda (1 sprint)

Objetivo: replicar el tablero por zonas con popover de acciones.

UI

Layout por zonas (como Figma): grid 8×5 (o dinámico); header con KPIs:

“Total: 40 • Ocupados: 9 • Libres: 29”.

Tile de plaza

Libre (número grande); Ocupada (muestra patente); Bloqueada/Reservada en gris con patrón/ícono.

Hover/focus: anillo azul (como en Figma).

Popover contextual

Si ocupada: “Egreso” (primario rojo) y “Mover”.

Si libre: “Ingreso” (primario verde) y “Bloquear”.

Si bloqueada: “Desbloquear”.

Siempre: subtítulo “Plaza B0104 • ABC123”.

Lógica / datos

Consulta compacta para la grilla (una por zona):

plaza_id, code, status, type, vehicle_plate (si ocupada).

KPIs zona

Vista/RPC que retorne {total, ocupadas, libres, reservadas, bloqueadas}.

Movimientos recientes (abajo)

Tabla “Últimos movimientos” (join/vista): fecha, patente, acción, zona, plaza, método, tarifa, total.

Aceptación

Grilla reacciona en <=1s a cambios remotos.

Popover correcto según estado.

KPIs nunca quedan desactualizados tras una acción.

Fase 2 — Modales de Ingreso / Egreso (1 sprint)

Objetivo: formularios “auto” como en Figma, con campos bloqueados/auto.

Ingreso

Campos:

Patente (normalizar/validar), Tipo de vehículo,

Tipo de plaza (Común/EV/Discap/Techada),

Modalidad (Hora/Día/Mes/Año),

Plaza asignada (auto) (viene de la celda clickeada),

Tarifa aplicada (auto).

Muchos campos en readOnly con ícono de candado (exacto al Figma).

CTA: Registrar ingreso.

Reglas:

Compatibilidad tipo de plaza ↔ tipo de vehículo y modalidad.

Si la plaza no es compatible, bloquear CTA y mostrar motivo.

Egreso

Campos auto/bloqueados: Patente, Tiempo estacionado (hh:mm), Tarifa vigente, Total a cobrar.

“Método de pago” (select).

CTA destructiva: Registrar egreso.

Datos / RPC

rpc_register_entry(plate, vehicle_type, plaza_id, modality, …)

Valida compatibilidad, crea estancia activa, cambia plaza.status→OCCUPIED, genera movimiento: INGRESO.

rpc_register_exit(estancia_id, payment_method)

Calcula tiempo/importe (según modalidad/tarifa), cierra estancia, plaza.status→FREE, genera movimiento: EGRESO.

Cálculo de tarifa centralizado (no en front). Devuelve desglose para poblar los campos bloqueados.

Aceptación

Ingreso/egreso completan en <300 ms p95 (cache + optimistic).

Cierre exitoso siempre refleja cambio visual en grilla y fila en “Últimos movimientos”.

Fase 3 — Mover vehículo + Bloquear/Reservar (0.75 sprint)

Mover

Modal: “Zona destino” (select), “Tipo de plaza” (chips), mini-grilla de plazas filtradas (solo libres compatibles).

CTA: Confirmar movimiento.

RPC transaccional:

rpc_move_vehicle(estancia_id, to_plaza_id)

chequea libre/compatible, cambia plaza_from→FREE, plaza_to→OCCUPIED, actualiza estancia.plaza_id, crea movimiento: MOVIMIENTO.

Control de concurrencia: updated_at + where status='FREE' en to_plaza.

Bloquear / Reservar

Bloquear: plaza.status→BLOCKED (+ razón opcional, usuario, timestamps).

Reservar: tabla reservas(plaza_id, plate?, valid_until, estado) y plaza.status→RESERVED con expiración automática (trigger).

Aceptación

No se puede mover a plaza ocupada/bloqueada/reservada.

Deshacer bloqueos y el estado vuelve a la grilla sin refrescar.

Cambios en modelo de datos (mínimos y seguros)

plazas

status enum, type enum, code (ej. B0104), zone_id, updated_at.

Índices: (zone_id, status), (zone_id, type, status).

estancias

id, plate, vehicle_type, plaza_id, zone_id, entry_at, exit_at, active bool, modality, tariff_id, amount_total.

Índices: (active, plaza_id), (active, plate), (active, entry_at desc).

movimientos

id, ts, type enum(INGRESO,EGRESO,MOVIMIENTO,RESERVA,BLOQUEO), plate, zone_id, plaza_from, plaza_to, method, tariff, total.

reservas (opcional, si lo usarás).

RPCs / vistas

zone_grid(zone_id), zone_kpis(zone_id), last_movements(limit), register_entry, register_exit, move_vehicle.

Checklist de implementación (orden recomendado)

Tokens y estilos base (tipos, botones, badges, estados).

Vista por zonas + KPIs (datos reales).

Tile + Popover de acciones (máquina de estados).

Modal de Ingreso (flujo completo + optimistic + toasts).

Modal de Egreso (cálculo servidor + recibo).

Tabla “Últimos movimientos” (vinculada a eventos).

Modal de Mover (filtros por compatibilidad).

Bloquear/Reservar (y su expiración).

Realtime + a11y + atajos (Enter confirma, Esc cierra, N=Ingreso si plaza libre).

Criterios de “listo”

Paridad visual con Figma (espaciados, anillos de foco, candados).

Resiliencia offline: encolar ingreso/egreso/mover; badge “Pendiente de sincronizar”.

Auditoría: todo cambio genera movimiento con usuario y timestamp.

Accesibilidad: navegación por teclado en grilla, aria-live en KPIs.

Rendimiento: render de una zona (40 celdas) < 16ms p95; suscripción realtime por zona (no global).

Mapa Figma → Componentes (nombres sugeridos)

ZoneBoard (contiene ZoneHeader + PlazaGrid)

PlazaTile (prop: {status,type,code,plate}) + PlazaActionsPopover

EntryDialog, ExitDialog, MoveDialog, BlockDialog

MovementsTable

useZoneData(zoneId), useMovements()

Servicios: parkingService.registerEntry/Exit/Move/Block (wrap a RPCs)

Quick wins (en 1–2 días)

Anillo/foco + popover contextual en tu grilla actual.

KPIs por zona con % correcto y “Última sync hace Xs”.

Tabla “Últimos movimientos” (aunque sea mock, enganchar después a la vista real).

Si querés, en el próximo paso te bajo esto a issues (estilo GitHub) con “tareas, criterios de aceptación y subtareas técnicas” para que puedas repartirlo o seguirlo sprint por sprint.