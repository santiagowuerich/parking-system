# Plan de Modificación: Agregar Fecha Ingreso y Fecha Egreso a Tabla de Movimientos

## Estado Actual

La tabla de movimientos en `/dashboard/movimientos` actualmente muestra:

| Columna | Descripción | Origen |
|---------|-------------|--------|
| Fecha/Hora | Timestamp del movimiento (egreso si existe, sino ingreso) | `movement.timestamp` |
| Patente | Patente del vehículo | `movement.license_plate` |
| Acción | Ingreso o Egreso | `movement.action` |
| Zona | Zona de la plaza | `movement.zona` |
| Plaza | Número de plaza | `movement.plaza` |
| Método | Método de pago | `movement.method` |
| Tarifa | Tarifa aplicada | `movement.tarifa` |
| Total | Monto total | `movement.total` |

### Problema Identificado

Actualmente la columna **"Fecha/Hora"** solo muestra **UNA** fecha:
- Si es un **Egreso**: muestra `ocu_fh_salida`
- Si es un **Ingreso**: muestra `ocu_fh_entrada`

Esto hace que **no se vea la fecha de ingreso** cuando el vehículo ya egresó.

## Objetivo

Agregar dos columnas separadas para mostrar claramente:
1. **Fecha Ingreso**: Siempre mostrar `ocu_fh_entrada`
2. **Fecha Egreso**: Mostrar `ocu_fh_salida` (o "-" si aún no egresó)

## Nueva Estructura de Tabla

| Patente | Acción | Fecha Ingreso | Fecha Egreso | Zona | Plaza | Método | Tarifa | Total |
|---------|--------|---------------|--------------|------|-------|--------|--------|-------|
| ACB234 | Ingreso | 08/10/2025 12:01:21 PM | - | zona 234 | P005 | - | $200/h | - |
| ACB234 | Egreso | 08/10/2025 11:30:00 AM | 08/10/2025 12:00:58 PM | zona 234 | P003 | Efectivo | $200/h | $200 |

## Modificaciones Necesarias

### 1. Backend: API Route

**Archivo**: `app/api/parking/movements/route.ts`

**Cambios en líneas 112-122**:

```typescript
// ❌ CÓDIGO ACTUAL
return {
  id: movement.ocu_id,
  timestamp: timestamp,  // Solo muestra una fecha
  license_plate: movement.veh_patente,
  action: isEntry ? 'Ingreso' : 'Egreso',
  zona: movement.plazas?.pla_zona || 'N/A',
  plaza: movement.pla_numero ? `P${movement.pla_numero.toString().padStart(3, '0')}` : 'Sin asignar',
  method: metodoPago,
  tarifa: tarifaBase,
  total: totalPagado
};

// ✅ CÓDIGO MODIFICADO
return {
  id: movement.ocu_id,
  fecha_ingreso: movement.ocu_fh_entrada,     // ✨ NUEVO
  fecha_egreso: movement.ocu_fh_salida,       // ✨ NUEVO
  license_plate: movement.veh_patente,
  action: isEntry ? 'Ingreso' : 'Egreso',
  zona: movement.plazas?.pla_zona || 'N/A',
  plaza: movement.pla_numero ? `P${movement.pla_numero.toString().padStart(3, '0')}` : 'Sin asignar',
  method: metodoPago,
  tarifa: tarifaBase,
  total: totalPagado
};
```

**Notas**:
- Ya se está consultando `ocu_fh_entrada` y `ocu_fh_salida` en la query (líneas 18-19)
- Solo necesitamos retornarlos en el objeto de respuesta
- Se eliminará el campo `timestamp` que actualmente solo muestra una de las dos fechas

### 2. Frontend: Página de Movimientos

**Archivo**: `app/dashboard/movimientos/page.tsx`

#### 2.1. Actualizar Headers de Tabla (líneas 92-101)

```typescript
// ❌ CÓDIGO ACTUAL
<TableRow className="dark:border-zinc-800">
  <TableHead className="dark:text-zinc-400">Fecha/Hora</TableHead>
  <TableHead className="dark:text-zinc-400">Patente</TableHead>
  <TableHead className="dark:text-zinc-400">Acción</TableHead>
  <TableHead className="dark:text-zinc-400">Zona</TableHead>
  <TableHead className="dark:text-zinc-400">Plaza</TableHead>
  <TableHead className="dark:text-zinc-400">Método</TableHead>
  <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
  <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
</TableRow>

// ✅ CÓDIGO MODIFICADO
<TableRow className="dark:border-zinc-800">
  <TableHead className="dark:text-zinc-400">Patente</TableHead>
  <TableHead className="dark:text-zinc-400">Acción</TableHead>
  <TableHead className="dark:text-zinc-400">Fecha Ingreso</TableHead>     {/* ✨ NUEVO */}
  <TableHead className="dark:text-zinc-400">Fecha Egreso</TableHead>      {/* ✨ NUEVO */}
  <TableHead className="dark:text-zinc-400">Zona</TableHead>
  <TableHead className="dark:text-zinc-400">Plaza</TableHead>
  <TableHead className="dark:text-zinc-400">Método</TableHead>
  <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
  <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
</TableRow>
```

#### 2.2. Actualizar Celdas de Datos (líneas 118-142)

```typescript
// ❌ CÓDIGO ACTUAL
<TableRow key={idx} className="dark:border-zinc-800">
  <TableCell className="dark:text-zinc-100">
    {formatArgentineTimeWithDayjs(movement.timestamp)}
  </TableCell>
  <TableCell className="dark:text-zinc-100 font-medium">
    {movement.license_plate}
  </TableCell>
  <TableCell>
    <Badge variant={...}>
      {movement.action}
    </Badge>
  </TableCell>
  <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
  <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
</TableRow>

// ✅ CÓDIGO MODIFICADO
<TableRow key={idx} className="dark:border-zinc-800">
  <TableCell className="dark:text-zinc-100 font-medium">
    {movement.license_plate}
  </TableCell>
  <TableCell>
    <Badge variant={...}>
      {movement.action}
    </Badge>
  </TableCell>
  <TableCell className="dark:text-zinc-100">                              {/* ✨ NUEVO */}
    {formatArgentineTimeWithDayjs(movement.fecha_ingreso)}
  </TableCell>
  <TableCell className="dark:text-zinc-100">                              {/* ✨ NUEVO */}
    {movement.fecha_egreso ? formatArgentineTimeWithDayjs(movement.fecha_egreso) : '-'}
  </TableCell>
  <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
  <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
  <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
</TableRow>
```

#### 2.3. Actualizar colspan en mensajes (líneas 106, 112)

```typescript
// ❌ CÓDIGO ACTUAL
<TableCell colSpan={8} className="...">

// ✅ CÓDIGO MODIFICADO
<TableCell colSpan={9} className="...">  {/* Cambiar de 8 a 9 columnas */}
```

## Resumen de Cambios

### Backend (1 archivo)
- ✅ `app/api/parking/movements/route.ts`
  - Agregar `fecha_ingreso: movement.ocu_fh_entrada`
  - Agregar `fecha_egreso: movement.ocu_fh_salida`
  - Eliminar `timestamp` (ya no se necesita)

### Frontend (1 archivo)
- ✅ `app/dashboard/movimientos/page.tsx`
  - Reorganizar headers: mover "Patente" y "Acción" al inicio
  - Reemplazar "Fecha/Hora" por "Fecha Ingreso" y "Fecha Egreso"
  - Actualizar las celdas para mostrar ambas fechas
  - Mostrar "-" cuando no hay fecha de egreso
  - Actualizar `colSpan` de 8 a 9

## Ventajas de esta Modificación

1. ✅ **Mayor claridad**: Se ve cuándo ingresó y cuándo egresó cada vehículo
2. ✅ **Información completa**: No se pierde la fecha de ingreso en egresos
3. ✅ **Mejor UX**: Usuario puede calcular tiempo de permanencia visualmente
4. ✅ **Consistencia**: Mismo formato que otros componentes (PaymentMethodSelector, EgresoModal)
5. ✅ **Reutilización**: Usa la función `formatArgentineTimeWithDayjs` ya corregida

## Orden de Implementación

1. **Primero**: Modificar el backend (API route) para agregar los campos
2. **Segundo**: Modificar el frontend para mostrar las nuevas columnas
3. **Tercero**: Probar con datos de ingreso y egreso

## Estimación de Tiempo

- Backend: 5 minutos
- Frontend: 10 minutos
- Pruebas: 5 minutos
- **Total**: ~20 minutos

---

**Fecha del plan**: 08/10/2025
**Archivos a modificar**: 2
**Complejidad**: Baja
