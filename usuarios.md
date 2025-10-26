ricardo2025@gmail.com   conductor
pablosandoval@gmail.com  dueño
danielramirez@gmail.com  playero



# Comentarios del sitio (25/10/2025, 11:10:19 p.m.)
**URL:** https://parking-system-taupe.vercel.app/auth/forgot-password
**Proyecto:** Parqueo

---

## Tarea 1

**Selector:** `body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > h2:nth-of-type(1)`
**Elemento:** `<h2>`
**Clases:** `text-2xl font-bold text-center mb-2`
**Contenido:** "Recuperar Contraseña"
**Estado:** ⏳ Pendiente

**Cambio requerido:**
> santiago

---

## Tarea 2

**Selector:** `body:nth-of-type(1) > div:nth-of-type(1) > div:nth-of-type(2) > form:nth-of-type(1) > div:nth-of-type(1) > input:nth-of-type(1)`
**Elemento:** `<input>`
**Clases:** `block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900 disabled:opacity-50`
**Contenido:** ""
**Estado:** ⏳ Pendiente

**Cambio requerido:**
> En vez de que este hardcoeado tu@correo.com cambialo por santiago@correo.com

---


# Comentarios del sitio (25/10/2025, 11:11:46 p.m.)
**URL:** https://parking-system-taupe.vercel.app/dashboard/operador
**Proyecto:** Parqueo

---

## Tarea 1

**Selector:** `#radix-«rd» > div:nth-of-type(1) > div:nth-of-type(2)`
**Elemento:** `<div>`
**Clases:** `relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`
**Contenido:** "Zona B"
**Estado:** ⏳ Pendiente

**Cambio requerido:**
> div

---

## Tarea 2

**Selector:** `#radix-«rm» > div:nth-of-type(1) > div:nth-of-type(7)`
**Elemento:** `<div>`
**Clases:** `relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50`
**Contenido:** "🚗AAA159Auto • Ingreso: 10:36 • Plaza 16"
**Estado:** ⏳ Pendiente

**Cambio requerido:**
> prueba

---

## Tarea 3

**Selector:** `#radix-«rd» > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(5) > button:nth-of-type(1)`
**Elemento:** `<button>`
**Clases:** `w-12 h-12 flex items-center justify-center rounded-md text-white font-bold text-sm transition-transform duration-150 bg-green-600 hover:bg-green-700 cursor-pointer hover:scale-110`
**Contenido:** "20"
**Estado:** ⏳ Pendiente

**Cambio requerido:**
> santiago

---

# 📋 ANÁLISIS COMPLETO: SISTEMA DE RESERVAS

## 🎯 RESumen Ejecutivo

El sistema de reservas permite a los conductores reservar plazas de estacionamiento con anticipación. Las reservas pueden pagarse mediante transferencia bancaria, link de pago MercadoPago o QR de MercadoPago. Una vez confirmada la llegada por el operador, el vehículo ingresa al estacionamiento como un automóvil normal.

### Estado Actual: ⚠️ PROBLEMA IDENTIFICADO

**Problema:** Las reservas no aparecen como opción de ingreso normal. El flujo actual requiere que el operador busque manualmente la reserva por código o patente, lo cual no es intuitivo ni eficiente para un flujo de estacionamiento normal.

---

## 📂 Arquitectura del Sistema

### 1. Creación de Reserva (`/api/reservas/crear`)

```typescript
// Ubicación: app/api/reservas/crear/route.ts
// Archivos relacionados: 
// - components/reservas/crear-reserva-dialog.tsx
// - lib/utils/reservas-utils.ts

Flujo:
1. Usuario (conductor) selecciona estacionamiento
2. Selecciona plaza, hora de inicio, duración y método de pago
3. Sistema crea registro en tabla 'reservas' con res_estado = 'pendiente_pago'
4. Si método es 'qr' o 'link_pago', crea preference en MercadoPago
5. Si método es 'transferencia', guarda datos bancarios
```

**Estados posibles de una reserva:**
```
pendiente_pago → Usuario creó reserva pero no pagó
confirmada → Usuario PAGÓ (QR/Link) o espera confirmación (Transferencia)
activa → Operador confirmó llegada, vehículo ESTÁ EN LA PLAZA
completada → Fin automático, conductor se fue
cancelada → Pago fue RECHAZADO
expirada → Confirmada pero no llegó a tiempo
no_show → Llegó fuera del tiempo de gracia
```

### 2. Procesamiento de Pago

#### MercadoPago (QR/Link de Pago)
```typescript
// Ubicación: app/api/reservas/procesar-pago/route.ts

1. MercadoPago envía webhook
2. Backend busca reserva por res_codigo (external_reference)
3. Consulta estado del pago en MercadoPago API
4. Actualiza res_estado:
   - "approved" → "confirmada"
   - "rejected" → "cancelada"
   - "cancelled" → "cancelada"
   - "pending" → "pendiente_pago"
```

#### Transferencia Bancaria
```typescript
// Ubicación: app/api/reservas/confirmar-pago-transferencia-operador/route.ts

⚠️ PROBLEMA: No hay confirmación automática
- Usuario transfiere manualmente
- Operador debe confirmar el pago manualmente
- Se cambia res_estado de 'pendiente_confirmacion_operador' a 'confirmada'
```

### 3. Confirmación de Llegada (`/api/reservas/confirmar-llegada`)

```typescript
// Ubicación: app/api/reservas/confirmar-llegada/route.ts
// Archivos relacionados:
// - components/reservas/buscar-reserva-dialog.tsx
// - components/reservas/lista-reservas-operador.tsx

Proceso:
1. Verifica res_estado = 'confirmada'
2. Verifica tiempo de gracia (15 minutos)
3. Verifica que la plaza esté libre
4. Crea registro en tabla 'ocupacion' con ocu_duracion_tipo = 'reserva'
5. Actualiza res_estado = 'activa'
6. Actualiza plaza: pla_estado = 'Ocupada'
```

---

## 🔍 ANÁLISIS DEL PROBLEMA

### Problema Principal: Reservas no aparecen como ingresos normales

**Descripción del problema:**

1. ✅ Las reservas se crean correctamente
2. ✅ El pago se procesa correctamente
3. ❌ **PROBLEMA**: El operador NO VE las reservas en la lista normal de ingresos
4. ❌ **PROBLEMA**: El operador debe buscar manualmente cada reserva

**Flujo actual problemático:**
```
Operador abre panel → No ve reservas → 
Debe ir a vista de "Reservas" → 
Buscar manualmente por código o patente → 
Confirmar llegada
```

**Flujo esperado:**
```
Operador abre panel → VE RESERVAS PENDIENTES → 
Confirma llegada con un clic → 
Vehículo ingresa automáticamente
```

### Ubicación del Problema

El problema está en cómo se muestran las reservas al operador:

```typescript
// Archivo: components/reservas/lista-reservas-operador.tsx
// API: app/api/reservas/operador/route.ts

// Actualmente las reservas solo se muestran cuando:
query = query.in('res_estado', [
    'confirmada',        // ← Solo muestra reservas confirmadas
    'activa',            // ← Y activas
    'no_show',
    'pendiente_confirmacion_operador' // ← Transferencias pendientes
]);
```

**Problema:** Las reservas confirmadas aparecen en una vista SEPARADA, no en la lista normal de ingresos.

---

## 📊 TABLA DE DATOS: `reservas`

```sql
-- Campos clave de la tabla reservas
CREATE TABLE reservas (
    res_id SERIAL PRIMARY KEY,
    est_id INTEGER,                    -- Estacionamiento
    pla_numero INTEGER,                 -- Plaza asignada
    veh_patente VARCHAR,                -- Patente del vehículo
    res_codigo VARCHAR UNIQUE,          -- Código único: RES-YYYY-MM-DD-NNNN
    res_fh_ingreso TIMESTAMP,           -- Hora prevista de ingreso
    res_fh_fin TIMESTAMP,               -- Hora prevista de salida
    con_id INTEGER,                     -- ID del conductor
    res_estado VARCHAR,                 -- Estado actual
    res_monto DECIMAL,                  -- Monto pagado
    res_tiempo_gracia_min INTEGER,      -- Tiempo de gracia (15 min)
    metodo_pago VARCHAR,                -- transferencia|link_pago|qr
    payment_info JSONB,                 -- Datos del pago
    res_created_at TIMESTAMP
);

-- Estados posibles:
'pendiente_pago'                    -- Recién creada, sin pago
'pendiente_confirmacion_operador'   -- Transferencia esperando confirmación
'confirmada'                        -- Pago confirmado, lista para usar ⭐
'activa'                           -- En uso (ocupación creada)
'completada'                       -- Finalizada
'cancelada'                        -- Cancelada
'expirada'                         -- Expirada
'no_show'                          -- No llegó a tiempo
```

---

## 🛠️ SOLUCIÓN PROPUESTA

### Opción 1: Mostrar Reservas Pendientes en la Vista Principal (RECOMENDADA)

**Descripción:** Agregar una sección especial en el panel del operador que muestre las reservas confirmadas del día actual.

**Implementación:**

1. **Modificar componente del operador:**
```typescript
// Archivo: app/dashboard/operador/page.tsx

// Agregar sección de "Reservas del Día"
const ReservasDelDia = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reservas Pendientes de Hoy</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Lista de reservas con estado 'confirmada' del día actual */}
        {/* Botón "Confirmar Llegada" en cada reserva */}
      </CardContent>
    </Card>
  );
};
```

2. **Modificar API para incluir reservas en lista principal:**
```typescript
// Archivo: app/api/reservas/operador/route.ts

// Extender query para incluir reservas confirmadas del día
query = query.in('res_estado', [
    'confirmada', 
    'activa',
    'pendiente_confirmacion_operador'
])
.gte('res_fh_ingreso', fechaInicio)
.lt('res_fh_ingreso', fechaFin);
```

### Opción 2: Integrar Reservas en el Flujo Normal de Ingreso (MÁS COMPLEJA)

**Descripción:** Modificar el modal de ingreso para que detecte automáticamente si hay una reserva activa para el vehículo.

**Implementación:**

1. **Al abrir modal de ingreso, verificar si hay reserva:**
```typescript
// Archivo: components/ingreso-modal.tsx

// Al ingresar patente, verificar si existe reserva
const verificarReserva = async (patente: string) => {
  const response = await fetch(
    `/api/reservas/buscar?patente=${patente}&est_id=${estId}`
  );
  
  if (response.data && response.data[0].res_estado === 'confirmada') {
    // Mostrar información de reserva
    // Pre-llenar datos
    // Activar botón "Confirmar Llegada de Reserva"
  }
};
```

2. **Función de ingreso rápido de reserva:**
```typescript
// Agregar endpoint: /api/reservas/ingreso-rapido
// Combina buscar reserva + confirmar llegada en una sola acción
```

---

## 🔄 FLUJO CORRECTO ACTUAL (DETALLADO)

### Fase 1: Conductor Crea Reserva

**Ubicación:** Página `/conductor`

1. Usuario selecciona estacionamiento en el mapa
2. Hace clic en "Reservar"
3. Selecciona plaza disponible
4. Elige hora de inicio (15-120 min desde ahora)
5. Elige duración (1-24 horas)
6. Elige método de pago
7. Sistema calcula precio = tarifa × duración
8. Usuario confirma
9. Backend crea registro con `res_estado = 'pendiente_pago'`

**Código relevante:**
```typescript:554:app/api/reservas/crear/route.ts
// Se crea la reserva con este estado
res_estado: metodo_pago === 'transferencia' 
  ? 'pendiente_confirmacion_operador' 
  : 'pendiente_pago'
```

### Fase 2: Usuario Paga

**MercadoPago (QR/Link):**
```
Usuario completa pago → MercadoPago envía webhook → 
Backend actualiza res_estado = 'confirmada'
```

**Transferencia:**
```
Usuario transfiere → Operador confirma manualmente → 
Backend actualiza res_estado = 'confirmada'
```

### Fase 3: Operador Confirma Llegada

**Ubicación:** Panel `/dashboard/operador` → Vista "Reservas"

**Proceso actual:**
1. Operador va a vista de Reservas
2. Busca por código o patente
3. Hace clic en "Confirmar Llegada"
4. Sistema verifica:
   - `res_estado = 'confirmada'` ✅
   - Dentro del tiempo de gracia ✅
   - Plaza libre ✅
5. Sistema crea ocupación
6. Sistema actualiza `res_estado = 'activa'`
7. Sistema actualiza plaza: `pla_estado = 'Ocupada'`

**Código relevante:**
```typescript:166:app/api/reservas/confirmar-llegada/route.ts
// Verifica que esté confirmada
.eq('res_estado', 'confirmada')

// Verifica tiempo de gracia
if (!estaEnTiempoGracia(reserva.res_fh_ingreso, reserva.res_tiempo_gracia_min)) {
  // Marca como no_show
}

// Crea ocupación
INSERT INTO ocupacion {
  est_id, veh_patente, ocu_fh_entrada,
  pla_numero, ocu_duracion_tipo: 'reserva',
  ocu_precio_acordado, pag_nro
}

// Actualiza reserva
UPDATE reservas SET res_estado = 'activa'

// Actualiza plaza
UPDATE plazas SET pla_estado = 'Ocupada'
```

### Fase 4: Vehículo en Estacionamiento

Una vez confirmada la llegada, el vehículo **YA ESTÁ EN EL ESTACIONAMIENTO** como cualquier otro vehículo:

- Aparece en la lista de vehículos estacionados
- Se puede dar salida normal
- El egreso funciona igual que cualquier otro vehículo

---

## 🐛 PROBLEMAS IDENTIFICADOS

### 1. ❌ Reservas no visibles en vista principal

**Problema:** Las reservas confirmadas no aparecen en la vista principal del operador.

**Causa:** Las reservas están en una vista separada llamada "Reservas" que el operador debe abrir manualmente.

**Impacto:** 
- El operador no sabe que hay reservas pendientes
- Debe recordar buscar manualmente
- Flujo ineficiente

**Solución propuesta:** Ver "Opción 1" arriba.

### 2. ❌ Falta notificación de reservas pendientes

**Problema:** No hay alerta o notificación para el operador cuando hay reservas confirmadas esperando.

**Solución propuesta:**
```typescript
// Agregar badge con contador de reservas pendientes
const [reservasPendientes, setReservasPendientes] = useState(0);

useEffect(() => {
  const cargarReservasPendientes = async () => {
    const response = await fetch(
      `/api/reservas/operador?est_id=${estId}&fecha=${hoy}&estado=confirmada`
    );
    const data = await response.json();
    setReservasPendientes(data.data?.reservas?.length || 0);
  };
  cargarReservasPendientes();
}, [estId]);
```

### 3. ⚠️ Transferencia requiere confirmación manual

**Problema:** Las transferencias bancarias no tienen confirmación automática.

**Estado actual:** El operador debe confirmar manualmente que recibió la transferencia.

**Solución:** Esta es una limitación del método de pago. Mantener proceso actual.

---

## 📁 ARCHIVOS PRINCIPALES DEL SISTEMA

### Backend (API Routes)
```
app/api/reservas/
├── crear/route.ts                      # Crear reserva
├── buscar/route.ts                     # Buscar reserva por código/patente
├── operador/route.ts                   # Lista de reservas para operador
├── confirmar-llegada/route.ts          # Confirmar llegada y crear ocupación
├── procesar-pago/route.ts              # Webhook de MercadoPago
├── confirmar-pago-transferencia-operador/route.ts  # Confirmar transferencia
└── expirar/route.ts                    # Expirar reservas automáticamente
```

### Frontend (Components)
```
components/reservas/
├── crear-reserva-dialog.tsx            # Dialog para crear reserva
├── mis-reservas-panel.tsx              # Panel de conductor
├── lista-reservas-operador.tsx         # Lista para operador
├── buscar-reserva-dialog.tsx           # Buscar reserva
└── detalle-reserva-dialog.tsx          # Detalle de reserva
```

### Utilidades
```
lib/
├── utils/reservas-utils.ts             # Funciones utilitarias
├── hooks/
│   ├── use-reservas.ts                 # Hooks de reservas
│   └── use-reservas-unified.ts         # Hook unificado
└── types.ts                            # Tipos TypeScript
```

---

## 🎯 CONCLUSIÓN Y RECOMENDACIONES

### Resumen del Sistema Actual

**Lo que funciona:**
- ✅ Creación de reservas
- ✅ Procesamiento de pagos (MercadoPago)
- ✅ Confirmación de llegada
- ✅ Creación de ocupación automática
- ✅ Integración con sistema de plaza

**Lo que no funciona bien:**
- ❌ Visibilidad de reservas en panel principal
- ❌ Flujo intuitivo para el operador
- ❌ Confirmación automática de transferencias

### Recomendación Principal

**Implementar la Opción 1:** Agregar una sección visible en el panel principal del operador que muestre las reservas confirmadas del día actual con un botón para "Confirmar Llegada" en cada una.

**Beneficios:**
- El operador ve inmediatamente las reservas pendientes
- Menos clics para confirmar llegada
- Flujo más intuitivo
- Menor posibilidad de olvidar una reserva

**Implementación estimada:** 2-3 horas de desarrollo.

---

## 📞 Soporte

Para más información, consultar:
- `FLUJO_RESERVAS_COMPLETO.md` - Documentación original del flujo
- `app/README.md` - Documentación de la API
- `components/README.md` - Documentación de componentes





Necesito armar la parte de ingresada de vehiculos con reserva la logica va a ser la siguiente el cliente reserva y abona su plaza, la reserva va a contar desde que abono hasta que ingrese su vehiculo, cuando ingresa va a verificar el sistema que seria el playero, que este todavia su reserva, y va a ingresar el vehiculo luego se va a tratar como un vehiculo normal osea que el egreso va a tener que hacer que verifique el monto abonado y el monto que le corresponde 