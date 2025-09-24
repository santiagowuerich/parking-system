# Plan de Arreglo: Problema de Recarga Total de Página para Empleados

## 🔍 Análisis del Problema

### Síntomas Identificados
- Cuando un empleado recarga la página `/dashboard/turnos`, la aplicación "se cierra" o recarga completamente
- La experiencia de usuario se interrumpe perdiendo el estado de la aplicación
- Los empleados pierden contexto de trabajo y deben volver a cargar todo

### Causas Raíz Identificadas

#### 1. **Multiple useEffect en AuthContext que Causan Loops**
- **Problema**: `auth-context.tsx` tiene 7+ useEffect que se ejecutan en cadena
- **Impacto**: Cada recarga dispara múltiples verificaciones de rol, estacionamiento, y datos
- **Ubicación**: Líneas ~580-750 en `auth-context.tsx`

#### 2. **Verificación Redundante de Rol de Usuario**
- **Problema**: El sistema verifica el rol del empleado múltiples veces:
  - Una vez en `useUserRole()`
  - Otra vez en `RouteGuard`
  - Otra vez en la página de turnos
- **Impacto**: Causa estados de loading prolongados y re-renders excesivos

#### 3. **Falta de Persistencia Optimizada para Empleados**
- **Problema**: El sistema está optimizado para propietarios (múltiples estacionamientos)
- **Impacto**: Los empleados (1 solo estacionamiento) pasan por lógica innecesaria

#### 4. **Gestión de Estado Fragmentada**
- **Problema**: Estado distribuido entre múltiples hooks y contextos:
  - `AuthContext` para usuario y rol
  - `useParkings` para estacionamientos
  - `useUserRole` para permisos
  - Estado local en cada componente
- **Impacto**: Inconsistencias y re-renders innecesarios

#### 5. **LocalStorage Cache Invalidation Issues**
- **Problema**: El cache de localStorage no se gestiona correctamente para empleados
- **Impacto**: Datos obsoletos o pérdida de estado entre recargas

## 🎯 Estrategia de Solución

### Fase 1: Optimización Inmediata para Empleados

#### 1.1 Crear Hook Especializado para Empleados
**Archivo**: `lib/hooks/use-employee-session.ts`

```typescript
/**
 * Hook optimizado específicamente para empleados
 * - Cache agresivo del estacionamiento asignado
 * - Estado de turno persistente
 * - Menos verificaciones de permisos
 */
export function useEmployeeSession() {
  // Lógica simplificada para empleados
  // Cache de 1 hora para estacionamiento asignado
  // Estado de turno guardado en localStorage
}
```

#### 1.2 RouteGuard Optimizado para Empleados
**Archivo**: `components/employee-route-guard.tsx`

```typescript
/**
 * RouteGuard simplificado para empleados
 * - Skip verificaciones de múltiples estacionamientos
 * - Cache de rol más duradero
 * - Loading states más rápidos
 */
```

#### 1.3 Página de Turnos con Estado Persistente
**Modificar**: `app/dashboard/turnos/page.tsx`

- Guardar estado del turno activo en localStorage
- Cargar datos en background sin blocking UI
- Usar Suspense boundaries para mejor UX

### Fase 2: Refactorización del AuthContext

#### 2.1 Separar Lógica por Rol
```typescript
// Para propietarios (lógica actual)
const useOwnerAuth = () => { /* múltiples estacionamientos */ }

// Para empleados (lógica simplificada)
const useEmployeeAuth = () => { /* un solo estacionamiento */ }
```

#### 2.2 Reducir useEffect Dependencies
- Consolidar useEffect relacionados
- Usar useCallback para funciones estables
- Implementar debounce para verificaciones de estado

#### 2.3 Optimizar Cache Strategy
```typescript
const EMPLOYEE_CACHE_KEYS = {
  ASSIGNED_PARKING: 'employee_parking_assignment',
  ACTIVE_SHIFT: 'employee_active_shift',
  ROLE_VERIFIED: 'employee_role_verified'
};

// Cache más duradero para empleados (2 horas vs 15 minutos)
const EMPLOYEE_CACHE_TTL = 2 * 60 * 60 * 1000;
```

### Fase 3: Mejoras de Rendimiento

#### 3.1 Lazy Loading Components
```typescript
// Cargar componentes pesados solo cuando sea necesario
const HistorialTurnos = lazy(() => import('@/components/turnos/historial-turnos'));
const ReportesEmpleado = lazy(() => import('@/components/empleado/reportes'));
```

#### 3.2 React Query para Estado del Servidor
```typescript
// Reemplazar fetch manual con React Query
const { data: turnoActivo, isLoading } = useQuery({
  queryKey: ['turno-activo', playId, estId],
  queryFn: () => fetchTurnoEstado(playId, estId),
  staleTime: 5 * 60 * 1000, // 5 minutos
  cacheTime: 30 * 60 * 1000, // 30 minutos
});
```

#### 3.3 Optimistic Updates
- Actualizar UI inmediatamente
- Sincronizar con servidor en background
- Rollback solo en caso de error

## 🛠️ Plan de Implementación

### Sprint 1 (Arreglo Inmediato - 2-3 días)

#### Día 1: Hook de Empleado Optimizado
- [ ] Crear `useEmployeeSession.ts`
- [ ] Implementar cache optimizado para empleados
- [ ] Migrar página de turnos al nuevo hook

#### Día 2: RouteGuard Especializado
- [ ] Crear `EmployeeRouteGuard.tsx`
- [ ] Implementar loading states más rápidos
- [ ] Reducir verificaciones redundantes

#### Día 3: Testing y Refinamiento
- [ ] Probar recarga de página en modo empleado
- [ ] Verificar persistencia de estado
- [ ] Optimizar loading times

### Sprint 2 (Optimización Profunda - 1 semana)

#### Días 4-5: Refactorización AuthContext
- [ ] Separar lógica owner vs employee
- [ ] Consolidar useEffect hooks
- [ ] Implementar debouncing

#### Días 6-7: React Query Integration
- [ ] Instalar y configurar React Query
- [ ] Migrar fetch calls principales
- [ ] Implementar optimistic updates

#### Día 8: Performance Testing
- [ ] Benchmarking antes/después
- [ ] Verificar memory leaks
- [ ] Testing de edge cases

### Sprint 3 (Pulimento - 2-3 días)

#### Días 9-10: UI/UX Improvements
- [ ] Skeleton loaders para mejor perceived performance
- [ ] Error boundaries específicos
- [ ] Toast notifications optimizadas

#### Día 11: Documentation y Deployment
- [ ] Documentar cambios realizados
- [ ] Crear guía de troubleshooting
- [ ] Deploy y monitoring

## 🚀 Implementación de Arreglo Rápido (Para Hoy)

### Arreglo Temporal Inmediato

**1. Modificar `auth-context.tsx`** - Añadir flag para empleados:

```typescript
// Línea ~137
const [isEmployee, setIsEmployee] = useState(false);

// En el useEffect de rol (línea ~450)
useEffect(() => {
  if (userRole === 'playero') {
    setIsEmployee(true);
    // Skip verificaciones pesadas para empleados
    return;
  }
  // ... resto de lógica solo para propietarios
}, [userRole]);
```

**2. Modificar `turnos/page.tsx`** - Añadir estado persistente:

```typescript
// Al inicio del componente
const [turnoCache, setTurnoCache] = useState(() => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem('employee_turno_state');
    return cached ? JSON.parse(cached) : null;
  }
  return null;
});

// Guardar estado automáticamente
useEffect(() => {
  if (turnoActivo && typeof window !== 'undefined') {
    localStorage.setItem('employee_turno_state', JSON.stringify({
      turnoActivo,
      lastUpdated: Date.now()
    }));
  }
}, [turnoActivo]);
```

**3. Crear Loading State Optimizado**:

```typescript
// Mostrar datos cacheados inmediatamente, actualizar en background
if (turnoCache && !turnoActivo) {
  // Mostrar datos cacheados mientras carga
  return <TurnosCachedView cache={turnoCache} onRefresh={loadTurnoEstado} />;
}
```

## 📊 Métricas de Éxito

### Before (Estado Actual)
- ⏱️ Tiempo de carga inicial: 3-5 segundos
- 🔄 Re-renders por recarga: 15-20
- 💾 Requests por recarga: 8-12
- 😡 UX Score: 2/10

### After (Objetivo)
- ⏱️ Tiempo de carga inicial: 0.5-1 segundo
- 🔄 Re-renders por recarga: 3-5
- 💾 Requests por recarga: 2-3
- 😊 UX Score: 8/10

### KPIs Específicos
- [ ] Recarga de página < 1 segundo
- [ ] Estado de turno persiste entre recargas
- [ ] Cero pérdida de contexto de trabajo
- [ ] Reducir API calls en 60%

## 🔧 Configuración Recomendada

### Variables de Entorno
```env
# Cache más agresivo para empleados
NEXT_PUBLIC_EMPLOYEE_CACHE_TTL=7200000  # 2 horas
NEXT_PUBLIC_EMPLOYEE_PREFETCH=true       # Pre-cargar datos
NEXT_PUBLIC_EMPLOYEE_OFFLINE=true        # Soporte offline básico
```

### Next.js Config
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', '@supabase/supabase-js']
  }
}
```

## ⚠️ Riesgos y Mitigaciones

### Riesgo 1: Cache Stale Data
- **Mitigación**: TTL configurable + force refresh button
- **Fallback**: API call si cache > 2 horas

### Riesgo 2: Regresión en Funcionalidad Owner
- **Mitigación**: Feature flags para separar comportamientos
- **Testing**: Suite de tests específica para cada rol

### Riesgo 3: Increased Bundle Size
- **Mitigación**: Code splitting por rol
- **Monitoring**: Bundle analyzer en CI/CD

## 🎉 Beneficios Esperados

### Para Empleados
- ✅ Experiencia fluida sin interrupciones
- ✅ Datos de turno siempre disponibles
- ✅ Interfaz más responsiva
- ✅ Menos frustración con recargas

### Para el Sistema
- ✅ Menos carga en APIs
- ✅ Mejor utilización de cache
- ✅ Código más mantenible
- ✅ Performance metrics mejoradas

### Para Desarrollo
- ✅ Código más claro y separado por responsabilidad
- ✅ Easier debugging y troubleshooting
- ✅ Mejor testabilidad
- ✅ Base sólida para futuras mejoras

---

**Próximo Paso Inmediato**: Implementar el arreglo rápido del punto 🚀 para resolver el problema hoy mismo, luego proceder con las fases de optimización profunda.