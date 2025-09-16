Voy a buscar en el código cómo funciona el login y dónde se generan logs para detectar cuellos de botella y exceso de logging antes de proponer el plan.

[5 tools called]

Acabo de identificar el flujo de login, el middleware y varios puntos con logging verboso. Ahora te propongo un plan de optimización enfocado y pragmático.

### Hallazgos rápidos
- middleware: ejecuta `createServerClient` y `supabase.auth.getUser()` incluso en rutas públicas antes de decidir si son públicas.
- Endpoint de rol: hace 2-3 consultas secuenciales y loguea mucho.
```84:131:app/api/auth/get-role/route.ts
console.log('✅ GET /api/auth/get-role - Usuario encontrado en BD:', {
    usu_id: usuId,
    nombre: usuarioData.usu_nom,
    email: usuarioData.usu_email
});
// ...
console.log('👑 GET /api/auth/get-role - Usuario identificado como OWNER');
// ...
console.log('👷 GET /api/auth/get-role - Usuario identificado como PLAYERO');
// ...
console.log('🚗 GET /api/auth/get-role - Usuario identificado como CONDUCTOR (rol por defecto)');
```
- Frontend `PaymentMethodDialog`: logging muy detallado de respuestas completas y elementos.
```41:71:components/payment-method-dialog.tsx
console.log('📦 Respuesta completa de métodos de pago:', data)
console.log('📋 Todos los métodos en data.methods:', data.methods)
// ...
data.methods?.forEach((method: any, index: number) => {
  console.log(`🔍 Método ${index + 1}: ${method.method} = ${method.enabled} (enabled: ${method.enabled})`)
})
```
- `AuthProvider` dispara inicialización de sesión y escucha de estado; hay cargas adicionales tras login que pueden afectar tiempo de llegada al dashboard.

### Plan de optimización (priorizado)

- Medición inicial (30-45 min)
  - Instrumentar tiempos en login: envío→respuesta, tiempo de `middleware`, `get-role`, y cargas post-login del `AuthProvider`.
  - Añadir headers temporales de timing en `middleware` y medidas con `performance.now()` en dev.
  - Objetivo base: TTFB login, tiempo a primer render del dashboard, número de requests post-login.

- Logging: recorte y nivelado (Quick wins, alto impacto)
  - Introducir un `logger` mínimo con niveles controlados por `LOG_LEVEL`/`NEXT_PUBLIC_LOG_LEVEL` y reemplazar `console.log` en server/cliente.
  - Bajar a `debug` o eliminar: logs masivos en `get-role` y `PaymentMethodDialog`. Mantener solo WARN/ERROR en producción.
  - En `middleware`, dejar solo `warn/error` en casos anómalos; evitar logs por request.

- Middleware: cortar trabajo temprano (Alto impacto)
  - Evaluar `publicPaths` y hacer early return ANTES de crear el cliente Supabase y llamar `getUser`.
  - Evitar `getUser` si la ruta no requiere auth (p. ej., login/register).
  - Opcional: añadir pequeña caché/heurística basada en presencia de cookies para evitar llamadas innecesarias.

- Rol de usuario: menos roundtrips (Medio impacto)
  - Unificar las 2-3 consultas del endpoint en una consulta única (view, `exists()`, o RPC) o persistir `role` en `auth.users.user_metadata`/tabla `usuario` y leer una única vez.
  - Cachear el rol en cliente (sessionStorage) y revalidar sólo tras cambios o cada X mins.

- Flujo post-login en `AuthProvider` (Medio impacto)
  - Diferir cargas pesadas (p. ej., `fetchUserData`) hasta después de que el dashboard esté visible; cargar en paralelo y no bloquear navegación.
  - Revisar que `initializeAuth` + `onAuthStateChange` no dupliquen trabajo y que no disparen fetches redundantes.

- Endpoints/uso duplicado
  - Confirmar si `/api/auth/login` está en uso; si el login va directo con supabase desde cliente, remover la ruta o dejarla sólo para escenarios específicos para reducir superficie y confusión.

- Aceptación y guardrails
  - Producción: 0 logs INFO/DEBUG en rutas de auth; sólo WARN/ERROR.
  - TTFB login < 300 ms (sin cold start) y time-to-dashboard < 1.5 s en “3G rápido”.
  - Reducir requests post-login a lo esencial (auth + rol en 1-2 llamadas).

### Hoja de ruta por fases

- Fase 1: Quick wins (0.5-1 día)
  - Logger con niveles y gating por env; recortar logs en `get-role`, `PaymentMethodDialog`, `middleware`.
  - Medición básica y reporte con 2-3 métricas clave.
  - Early return en `middleware` para rutas públicas.

- Fase 2: Flujo y consultas (1-2 días)
  - Unificar obtención de rol (view/RPC/metadata).
  - Diferir cargas post-login en `AuthProvider` y paralelizar fetches no críticos.

- Fase 3: Pulido (0.5 día)
  - Validar métricas, ajustar niveles de logs, sampleo de métricas si hace falta.
  - Documentar convenciones de logging y presupuesto de tiempo para login.

¿Te parece si avanzo con la Fase 1 (logger, recortes de logs y optimización del middleware) y te dejo una PR con las mediciones antes/después?

- He localizado el flujo de login y dónde se generan logs excesivos; ahora puedo implementar los quick wins de la Fase 1.