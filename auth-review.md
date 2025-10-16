# Reporte de Autenticación y Control de Roles

## Alcance de la revisión
- Páginas de registro e inicio de sesión (`app/auth/*`), hook `use-auto-redirect` y `AuthContext` (`lib/auth-context.tsx`).
- API de autenticación y provisión de estacionamientos (`app/api/auth/*`).
- Middleware global (`middleware.ts`) y guardas de interfaz (`components/route-guard.tsx`, `hooks/use-user-role.ts`).
- Navegación y layouts principales (`components/dashboard-sidebar.tsx`, `components/dashboard-layout.tsx`), vistas para conductor y dashboard.

## Flujo de autenticación
- **Registro de dueños/conductores**: Las páginas `app/auth/register/page.tsx` y `app/auth/register-conductor/page.tsx` delegan en endpoints específicos que crean usuarios en Supabase Auth con `supabaseAdmin` y sincronizan la tabla `usuario` según el rol (`dueno`, `conductores`). Tras el alta se dispara `signIn` del contexto para iniciar sesión automáticamente.
- **Inicio de sesión**: El hook `useAuth` usa `supabase.auth.signInWithPassword` y, tras éxito, invalida el cache local de rol. El listener `onAuthStateChange` inicializa `user` y activa efectos que cargan rol, estacionamiento y datos asociados.
- **Recuperación de contraseña**: `requestPasswordReset` y `updatePassword` envían correos y actualizan credenciales vía Supabase. El flujo reutiliza la misma sesión y respeta redirecciones desde `use-auto-redirect`.
- **Cierre de sesión**: `signOut` limpia estado local, `localStorage` y `sessionStorage`, revoca tokens (`supabase.auth.signOut({ scope: 'global' })`) y navega de vuelta a `/auth/login`.
- **API de login**: Existe `app/api/auth/login/route.ts`, pero la respuesta no propaga las cookies del helper (`copyResponseCookies` no se usa), por lo que no mantiene sesión si se consume ese endpoint directamente.

## Resolución y uso del rol
- **Detección en cliente**: `AuthContext` (`lib/auth-context.tsx:815-889`) guarda un rol cacheado en `localStorage` por 5 minutos y, si no existe, consulta `/api/auth/get-role`. Ese endpoint (`app/api/auth/get-role/route.ts`) usa `supabaseAdmin` para buscar por `auth_user_id` o email y actualiza el vínculo si falta.
- **Detección en servidor**: El `middleware` (`middleware.ts:83-140`) replica la lógica consultando `supabaseAdmin` y guarda el resultado en una cookie `user_role` con TTL de 5 minutos para acelerar solicitudes subsecuentes.
- **Guardas en la UI**: `RouteGuard` (`components/route-guard.tsx`) sólo acepta `owner` o `playero`. Para conductores se confía en el middleware y en redirecciones manuales, ya que la guarda no admite `'conductor'` en `allowedRoles`.
- **Navegación**: El sidebar (`components/dashboard-sidebar.tsx:81-112`) muestra menús condicionales. Sin embargo, la sección de conductores sigue apuntando a rutas `/dashboard/...` que el middleware bloquea, generando redirecciones inmediatas.

## Hallazgos principales
- **Alto – Elevación de privilegios vía cookie manipulable**: `middleware.ts:85-137` confía en la cookie `user_role` (expresamente `httpOnly: false`). Un usuario puede actualizarla desde el navegador para hacerse pasar por `owner` sin tocar la base de datos. Recomendado: marcar la cookie como `httpOnly` y firmarla, o eliminar el cache en favor de reconsultar `supabaseAdmin` en cada petición crítica.
- **Medio – RouteGuard no protege rutas de conductor**: `components/route-guard.tsx:10-131` tipa `allowedRoles` como `('owner' | 'playero')[]`. Las vistas de conductor (`app/conductor/*`) quedan sin protección declarativa; cualquier componente que re-use la guarda no podrá limitar acceso a conductores legítimos ni bloquear a owners/empleados desde el cliente.
- **Medio – Menú de conductor con enlaces bloqueados**: `components/dashboard-sidebar.tsx:95-105` ofrece rutas `/dashboard/abonos` y `/dashboard/reservas` aun cuando el middleware redirige a `/conductor`. Además de mala UX puede incentivar a los usuarios a intentar eludir la restricción.
- **Bajo – Endpoint de login sin propagación de cookies**: `app/api/auth/login/route.ts` ignora `copyResponseCookies`, por lo que un consumidor que dependa de ese endpoint no recibiría la sesión autenticada.

## Recomendaciones
1. Eliminar el uso de la cookie `user_role` o reforzarlo generando un token firmado; en requests sensibles consultar siempre a Supabase con el service role (`middleware.ts`).
2. Extender el `RouteGuard` para aceptar `'conductor'` y reutilizarlo en páginas de conductor, reduciendo la dependencia exclusiva del middleware.
3. Ajustar las entradas del sidebar para conductores a rutas realmente accesibles o mover esas features fuera del prefijo `/dashboard`.
4. Corregir `app/api/auth/login/route.ts` para copiar cookies emitidas por Supabase si se planea usar esa ruta.
5. Añadir pruebas automatizadas que verifiquen accesos a rutas y endpoints críticos para los tres roles.

