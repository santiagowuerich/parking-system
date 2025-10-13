# Plan de integración – Login y Mapa de Estacionamientos

## Objetivos
- Habilitar y robustecer el flujo de autenticación con Google OAuth y credenciales tradicionales sin flashes ni loops de redirección.
- Reducir peticiones redundantes y costos de renderizado en el mapa de estacionamientos, garantizando datos consistentes para conductores y operadores.
- Resolver errores detectados durante el análisis (`initParkingMap` ausente, uso de `google.maps.Marker` deprecado, warnings de accesibilidad) y dejar una base para iteraciones de rendimiento.

## Alcance principal
- Autenticación y redirecciones: `app/auth/login/page.tsx:18`, `hooks/use-auto-redirect.tsx:7`, `lib/auth-context.tsx:200`.
- Datos y caché de estacionamientos: `lib/hooks/use-parkings.ts:6`, `components/parking-map.tsx:136`, `app/api/parkings/route.ts:1`.
- Integración con servicios externos: Supabase (dashboard + claves en `.env*`), Google Cloud Console (API Maps).

## Supuestos y dependencias
- Acceso al proyecto de Supabase (configurar provider Google y callback).
- API key de Google Maps válida y autorizada para el dominio productivo.
- Disponibilidad del equipo para validar cambios en dispositivos móviles (tests de geolocalización requieren hardware/permiso).

## Roadmap propuesto

### Lote 0 – Preparación y control de configuración
- Inventariar credenciales actuales (`.env`, `.env.local`) y documentar en `docs/README_AUTO_PARKING.md` cualquier ajuste requerido para OAuth.
- Confirmar variables en pipelines (CI/CD) y rotar claves si es necesario.
- Definir un plan de pruebas (usuarios owner/playero/conductor) y responsables de QA.

### Lote 1 – Autenticación y redirección
1. **Provider Google**  
   - Habilitar Google en Supabase (Authentication → Providers).  
   - Registrar callback (`{APP_URL}/auth/callback`) y actualizar `SUPABASE_REDIRECT_URL` si aplica.
2. **Cliente web**  
   - Revisar `lib/auth-context.tsx:200` para capturar el error `Unsupported provider` y mostrar mensaje claro en `app/auth/login/page.tsx:63`.  
   - Crear una ruta `/auth/callback` (Next server action) que procese `code`/`state`, invoque `supabase.auth.exchangeCodeForSession`, y redirija a dashboard según `use-auto-redirect`.
3. **Redirecciones limpias**  
   - Ajustar `hooks/use-auto-redirect.tsx:20` para ignorar `router.push` si el usuario ya está en la ruta destino (evita re-render infinito y flashes).  
   - Revisar `middleware.ts:44` para que respete sesiones válidas antes de forzar `/auth/login`.
4. **Accesibilidad y formularios**  
   - Añadir `aria-live="polite"` al mensaje de error (`app/auth/login/page.tsx:68`) y verificar `autoComplete` en email/password (`app/auth/login/page.tsx:77`, `app/auth/login/page.tsx:90`).  
   - Incorporar tests de regresión rápida (Playwright o Cypress) para login con credenciales y mock de OAuth.

### Lote 2 – Gestión y cacheo de estacionamientos
1. **Fuente de datos única**  
   - Aprovechar el estado centralizado en `lib/auth-context.tsx:189` (`useParkings`) y exponer hook para el mapa en modo sólo lectura.  
   - Actualizar `components/parking-map.tsx:136` para consumir parkings desde contexto y evitar `fetch` directo cuando los datos ya existen.
2. **Eliminar peticiones duplicadas**  
   - Corregir el `useEffect` de filtro (`components/parking-map.tsx:703`) para que no dispare un nuevo `fetch` cuando `isLoaded` cambia por primera vez (usar `useRef` `didMount`).  
   - Si se requiere refresco manual, delegar en `refreshParkings` de `useParkings` y notificar al mapa mediante `props`.
3. **Cache y expiración**  
   - Reutilizar claves de `localStorage` definidas en `lib/auth-context.tsx:55` para cachear `parkings` (ej. `parking_public_cache`) con TTL corto (2‑5 min).  
   - Registrar métricas con `logger.debug` (`lib/logger.ts`) antes/después del fetch para validar reducción de peticiones.

### Lote 3 – Integración y rendimiento de Google Maps
1. **Loader oficial**  
   - Extraer la carga del script a un helper (`lib/google-maps-loader.ts`) usando `@googlemaps/js-api-loader`, estableciendo `window.initParkingMap = initializeMap` antes de inyectar script (resuelve error detectado en `components/parking-map.tsx:600`).  
   - Sustituir el atributo `callback=initParkingMap` por `Loader.load()` y eliminar dependencias globales innecesarias.
2. **Markers modernos**  
   - Reemplazar `new window.google.maps.Marker` (`components/parking-map.tsx:232`, `components/parking-map.tsx:298`) por `AdvancedMarkerElement` (`@googlemaps/marker-library`) para evitar la API deprecada y habilitar íconos personalizados.  
   - Actualizar tooltips/InfoWindow a la nueva API `google.maps.InfoWindow` o `map.createInfoWindow` (según versión).
3. **Lazy loading y split**  
   - Cargar el mapa sólo cuando el componente sea visible (IntersectionObserver o `next/dynamic` con `ssr: false`).  
   - Extraer constantes de estilo/leyenda a módulos `*.constants.ts` para facilitar memoización.
4. **Optimización de renders**  
   - Derivar `getFilteredParkings` con `useMemo` y `parkings` + `userLocation` como dependencias; exponer un `debouncedUpdateMarkers` con `useMemo` + `lodash.debounce` (300 ms) para marcadores dinámicos.  
   - Convertir `ParkingMap` en `memo` o partirlo en subcomponentes puros (lista de parkings, leyenda) para minimizar re-render del mapa.

### Lote 4 – Experiencia de usuario y accesibilidad
- Añadir confirmaciones visuales al login exitoso (banner temporal) y mensajes de ayuda contextual para bloqueo de OAuth.  
- Revisar componentes de error en mapa para uso de íconos accesibles (`role="alert"`) y textos sin caracteres corruptos.  
- Unificar encoding UTF-8 en archivos de contenido (`ANALISIS_LOGIN_COMPLETO.md`) para evitar glifos erróneos en producción y documentación.

### Lote 5 – Observabilidad, pruebas y despliegue
- Instrumentar eventos clave con `logger.info` y enviarlos a la herramienta de monitoreo usada (ej. Supabase logs, Logflare).  
- Crear pruebas E2E:  
  1. Login con credenciales y redirección por rol (conductores → `/conductor`, operadores → `/dashboard/operador-simple`).  
  2. Visualización de mapa con mock de `navigator.geolocation` y verificación de un único `GET /api/parkings`.  
  3. Smoke test de OAuth (mockear `supabase.auth.signInWithOAuth`).  
- Actualizar `docs/SUMMARY.md` y `README.md` con instrucciones resumidas para desarrolladores nuevos.  
- Definir checklist de despliegue (rotación de keys, purga de caches, validación manual en prod-ci).

## Riesgos y mitigaciones
- **Tokens expuestos:** mover `supabaseAdmin` (service key) a módulos sólo servidor (`lib/supabase.server.ts`) para evitar bundling accidental en el cliente.  
- **Dependencia de geolocalización:** preparar fallback (centrar mapa en ubicación por defecto) y mensaje educativo si el permiso es denegado.  
- **Cambio de API de Google:** versionar la carga (`v=weekly`) y monitorizar breaking changes; mantener pin a `v=beta` sólo en entornos de prueba.

## Definition of Done
- Todos los flujos de login (credenciales + Google) redirigen correctamente sin flashes.  
- `GET /api/parkings` se ejecuta una única vez por sesión/filtro y la traza muestra reducción ≥30 % en peticiones duplicadas.  
- El mapa funciona con la nueva API de markers y sin errores en consola.  
- Herramientas de QA confirman accesibilidad básica (sin warnings críticos en Lighthouse) y pruebas E2E verdes.  
- Documentación actualizada y compartida con el equipo (incluye pasos de configuración externa).

## Próximos pasos
- Agendar revisión de código conjunta tras implementar Lotes 1‑3.  
- Evaluar migrar a un sistema de estado global (TanStack Query) si la caché de parkings crece en complejidad.  
- Considerar internacionalización de textos del login y mapa con `next-intl` para futuros mercados.

