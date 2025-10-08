# Informe de Error: Zona Horaria en /movimientos

## Descripción del Problema

En la página `/movimientos` (`app/dashboard/movimientos/page.tsx`), las fechas y horas se están mostrando incorrectas, desfasadas respecto a la hora de Argentina (UTC-3).

## Ubicación del Error

### Archivos Afectados

1. **API Route**: `app/api/parking/movements/route.ts` (líneas 114-120)
2. **Página Frontend**: `app/dashboard/movimientos/page.tsx` (línea 120)
3. **Base de Datos**: `supabase/migrations/basededatos.sql` (líneas 112, 114)

## Análisis Técnico

### Causa Raíz

El problema se origina en **múltiples niveles**:

#### 1. Base de Datos (PostgreSQL/Supabase)
```sql
ocu_fh_entrada timestamp without time zone NOT NULL,
ocu_fh_salida timestamp without time zone,
```

Las columnas están definidas como `timestamp without time zone`, lo que significa que **no almacenan información de zona horaria**. Cuando se guarda una fecha, se almacena tal cual sin conversión.

#### 2. API Route (Backend)
```typescript
// Líneas 114-120 en route.ts
timestamp: new Date(timestamp).toLocaleString('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})
```

**Problemas detectados:**

- `new Date(timestamp)` interpreta el timestamp de la base de datos
- Si el timestamp viene sin zona horaria desde Supabase, JavaScript lo interpreta como **UTC** por defecto
- `toLocaleString('es-AR')` formatea con zona horaria pero **NO especifica `timeZone`**
- Esto hace que use la zona horaria del servidor, que puede no ser Argentina

#### 3. Frontend
```typescript
// Línea 120 en page.tsx
{movement.timestamp}
```

El frontend simplemente **muestra el string** ya formateado que viene de la API, sin realizar ninguna transformación.

## Comparación con Función Correcta

El proyecto ya tiene una función que maneja correctamente las zonas horarias:

```typescript
// lib/utils.ts - líneas 71-83
export function formatArgentineTimeWithDayjs(dateString: string | Date | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const dateUtc = dayjs.utc(dateString);
    if (!dateUtc.isValid()) {
      return "Fecha inválida";
    }
    return dateUtc.tz('America/Argentina/Buenos_Aires').format('DD/MM/YYYY hh:mm:ss A');
  } catch (error) {
    console.error("Error formateando fecha con Day.js:", error);
    return "Error";
  }
}
```

Esta función:
- ✅ Parsea explícitamente como UTC con `dayjs.utc()`
- ✅ Convierte a zona horaria Argentina con `.tz('America/Argentina/Buenos_Aires')`
- ✅ Maneja errores y casos nulos

## Impacto

- **Severidad**: Media-Alta
- **Usuarios afectados**: Todos los que consulten movimientos
- **Datos afectados**: Todas las fechas/horas de ingresos y egresos
- **Desfase típico**: 3 horas (diferencia entre UTC y Argentina)

## Soluciones Propuestas

### Solución 1: Usar la función existente `formatArgentineTimeWithDayjs` (RECOMENDADA)

**Ventajas:**
- Ya existe en el proyecto
- Probada y utilizada en otros componentes
- Maneja correctamente UTC → Argentina

**Cambios necesarios:**

En `app/api/parking/movements/route.ts`, línea 114-120:

```typescript
// ❌ CÓDIGO ACTUAL (INCORRECTO)
timestamp: new Date(timestamp).toLocaleString('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})

// ✅ CÓDIGO CORREGIDO
timestamp: timestamp
```

Y en `app/dashboard/movimientos/page.tsx`, línea 120:

```typescript
// ❌ CÓDIGO ACTUAL
{movement.timestamp}

// ✅ CÓDIGO CORREGIDO
{formatArgentineTimeWithDayjs(movement.timestamp)}
```

### Solución 2: Arreglar directamente en el API Route

**Cambios en** `app/api/parking/movements/route.ts`:

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// En el map de formattedMovements (línea 114-120):
timestamp: dayjs.utc(timestamp)
  .tz('America/Argentina/Buenos_Aires')
  .format('DD/MM/YYYY hh:mm A')
```

### Solución 3: Cambiar columnas de base de datos (A LARGO PLAZO)

Modificar el esquema para usar `timestamp with time zone`:

```sql
ALTER TABLE ocupacion
  ALTER COLUMN ocu_fh_entrada TYPE timestamp with time zone,
  ALTER COLUMN ocu_fh_salida TYPE timestamp with time zone;
```

**Ventajas:**
- Solución más robusta y correcta a nivel arquitectura
- Evita problemas futuros

**Desventajas:**
- Requiere migración de datos existentes
- Puede afectar otros componentes

## Recomendación Final

Implementar **Solución 1** por las siguientes razones:

1. Es la más simple y rápida
2. Reutiliza código existente y probado
3. Consistente con el resto del proyecto
4. No requiere cambios en base de datos
5. Mínimo riesgo de introducir nuevos bugs

---

**Fecha del informe**: 08/10/2025
**Prioridad**: Alta
**Estimación de corrección**: 10-15 minutos
