# Informe de Error: Nombre de Estacionamiento no se Muestra para Empleados

## Descripción del Problema

Cuando un empleado inicia sesión, el sidebar muestra "Seleccionar estacionamiento" en lugar del nombre real del estacionamiento asignado.

## Evidencia

```
┌─────────────────────────────────┐
│  Parqueo                        │
│  Sistema de gestión             │
├─────────────────────────────────┤
│  📍 Seleccionar estacionamiento │  ❌ INCORRECTO
└─────────────────────────────────┘
```

Debería mostrar:

```
┌─────────────────────────────────┐
│  Parqueo                        │
│  Sistema de gestión             │
├─────────────────────────────────┤
│  📍 estacionamiento 2348        │  ✅ CORRECTO
└─────────────────────────────────┘
```

## Ubicación del Error

### Archivos Involucrados

1. **Sidebar Component**: `components/dashboard-sidebar.tsx` (línea 214)
2. **Auth Context**: `lib/auth-context.tsx` (línea 544-624)
3. **Parkings Hook**: `lib/hooks/use-parkings.ts` (línea 75-77)
4. **API Endpoint**: `app/api/auth/list-parkings/route.ts` (línea 68-100)

## Análisis Técnico

### Flujo Actual (Con Error)

```
1. Usuario empleado inicia sesión
   ↓
2. auth-context.tsx detecta el rol como 'playero'
   ↓
3. ensureParkingSetup() se ejecuta (línea 875-877)
   ↓
4. Se establece estId correctamente (línea 580)
   estId = 3 (ejemplo)
   ↓
5. ❌ PROBLEMA: parkings = [] (array vacío)
   NO se llama a fetchParkings()
   ↓
6. DashboardSidebar intenta getParkingById(3)
   ↓
7. getParkingById busca en parkings.find(p => p.est_id === 3)
   ↓
8. Retorna null porque parkings está vacío
   ↓
9. Se muestra: "Seleccionar estacionamiento"
```

### Código Problemático

#### dashboard-sidebar.tsx (línea 208-214)
```typescript
const { user, signOut, userRole, roleLoading, estId, getParkingById } = useAuth();
// ...

// Obtener información del estacionamiento actual
const currentParking = estId ? getParkingById(estId) : null;
//                                    ↑
//                           Retorna null porque parkings está vacío
```

#### lib/hooks/use-parkings.ts (línea 75-77)
```typescript
const getParkingById = useCallback((estId: number) => {
    return parkings.find(p => p.est_id === estId) || null;
    //     ↑
    //     parkings = [] (vacío)
}, [parkings]);
```

#### lib/auth-context.tsx (línea 875-877)
```typescript
// Efecto específico para ensureParkingSetup - SOLO para owner y playero
useEffect(() => {
    if (user && userRole && !roleLoading && (userRole === 'owner' || userRole === 'playero')) {
        console.log('🏢 Usuario es owner/playero, ejecutando ensureParkingSetup');
        ensureParkingSetup();
        // ❌ PROBLEMA: No llama a fetchParkings()
    }
}, [user, userRole, roleLoading]);
```

### API Funciona Correctamente

El endpoint `/api/auth/list-parkings` SÍ retorna correctamente el estacionamiento del empleado:

```typescript
// app/api/auth/list-parkings/route.ts (línea 68-100)
// EMPLEADO: obtener solo el estacionamiento asignado
const { data: asignacionData, error: asignacionError } = await supabase
    .from('empleados_estacionamiento')
    .select(`
        est_id,
        fecha_asignacion,
        activo,
        estacionamientos (
            est_id,
            est_nombre,    // ✅ El nombre está aquí
            est_prov,
            est_locali,
            est_direc,
            ...
        )
    `)
    .eq('play_id', usuarioData.usu_id)
    .eq('activo', true)
    .single();
```

## Causa Raíz

**El problema es que `ensureParkingSetup()` solo establece el `estId` pero no carga la lista de parkings.**

Para empleados:
- ✅ `estId` se establece correctamente
- ❌ `parkings[]` permanece vacío
- ❌ `getParkingById(estId)` retorna `null`
- ❌ Sidebar muestra "Seleccionar estacionamiento"

## Solución

Necesitamos asegurarnos de que cuando se establece el `estId` para un empleado, también se cargue la lista de parkings.

### Opción 1: Llamar a fetchParkings después de setEstId (RECOMENDADA)

Modificar `ensureParkingSetup()` en `lib/auth-context.tsx` para cargar parkings después de establecer el estId:

```typescript
// En lib/auth-context.tsx, línea 575-584
if (employeeData.has_assignment) {
    console.log(`✅ Empleado asignado al estacionamiento: ${employeeData.est_id}`);
    setEstId(employeeData.est_id);
    if (typeof window !== 'undefined') {
        localStorage.setItem('parking_est_id', String(employeeData.est_id));
    }

    // ✅ AGREGAR: Cargar lista de parkings
    await fetchParkings();

    return;
}
```

### Opción 2: Efecto automático cuando cambia estId

Agregar un useEffect que cargue parkings cuando estId cambia y parkings está vacío:

```typescript
// En lib/auth-context.tsx, después del useEffect de línea 873
useEffect(() => {
    // Cargar parkings cuando estId está definido pero parkings está vacío
    if (estId !== null && parkings.length === 0 && !parkingsLoading && userRole !== 'conductor') {
        console.log('🔄 estId definido pero parkings vacío, cargando...');
        fetchParkings();
    }
}, [estId, parkings, parkingsLoading, userRole]);
```

## Recomendación

**Implementar Opción 2** porque:

1. ✅ Más robusto: funciona para cualquier caso donde estId se establezca
2. ✅ Evita duplicados: solo carga si parkings está vacío
3. ✅ Más mantenible: un solo lugar para la lógica de carga
4. ✅ Menos invasivo: no modifica ensureParkingSetup
5. ✅ Consistente: funciona tanto para owners como empleados

## Cambios Necesarios

**Archivo**: `lib/auth-context.tsx`

**Ubicación**: Después del useEffect de línea 873-881

**Código a agregar**:

```typescript
// Efecto para cargar parkings cuando estId está definido pero parkings vacío
useEffect(() => {
    // Solo ejecutar si:
    // - estId está definido
    // - parkings está vacío
    // - no está cargando actualmente
    // - no es conductor (conductores no necesitan parkings del estacionamiento)
    if (estId !== null && parkings.length === 0 && !parkingsLoading && userRole !== 'conductor') {
        console.log('🔄 estId definido pero parkings vacío, cargando lista...');
        fetchParkings();
    }
}, [estId, parkings, parkingsLoading, userRole, fetchParkings]);
```

## Impacto

- **Severidad**: Media
- **Usuarios afectados**: Todos los empleados
- **Funcionalidad afectada**: Visual (no muestra el nombre del estacionamiento)
- **Funcionalidad operativa**: No afecta, solo información visual

## Estimación

- **Tiempo de corrección**: 5 minutos
- **Riesgo**: Bajo
- **Testing**: Iniciar sesión como empleado y verificar que aparece el nombre

---

**Fecha del informe**: 08/10/2025
**Prioridad**: Media
**Tipo**: Bug - UX
