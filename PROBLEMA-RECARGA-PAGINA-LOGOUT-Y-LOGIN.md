# Problema: Logout y Re-login al Recargar la Página

## 📋 Descripción del Problema

Al recargar la página (F5) o cerrar y volver a abrir Chrome, el sistema presenta un comportamiento anómalo:

1. **Parece cerrar sesión y volver a iniciar sesión automáticamente**
2. **El estacionamiento seleccionado vuelve al primero** (ID: 85 en vez de 90)
3. **La experiencia del usuario es confusa** (flash de pantalla, posible redirección)

### Comportamiento Observado

```
Usuario Owner con estacionamiento 90 seleccionado:
┌────────────────────────────────────────────────────┐
│ 1️⃣ Usuario recarga la página (F5)                  │
│ 2️⃣ Se ve un "flash" o parpadeo                     │
│ 3️⃣ Parece que se desloguea y vuelve a loguear      │
│ 4️⃣ Vuelve al estacionamiento 85 (el primero)       │
└────────────────────────────────────────────────────┘

Mismo comportamiento al:
✅ Recargar con F5
✅ Cerrar Chrome y volver a abrir
✅ Cambiar de pestaña y volver (en algunos casos)
```

---

## 🔍 Análisis de la Causa Raíz

### **Problema 1: Multiple Re-renders del Auth Context**

El `useEffect` de autenticación en [`lib/auth-context.tsx:658-738`](lib/auth-context.tsx#L658-L738) se ejecuta **cada vez que cambia** `user.id`, `userRole` o `roleLoading`:

```typescript
useEffect(() => {
  if (user?.id && !roleLoading && userRole) {
    // Este código se ejecuta MÚLTIPLES veces durante la carga
    const getUserEstId = async () => {
      // ...
      if (estId !== null) {
        // Guard agregado recientemente
        return estId;
      }
      // Consulta API si no hay estId
    };
    getUserEstId();
  }
}, [user?.id, userRole, roleLoading]); // ⚠️ Se re-ejecuta cuando cambian estas deps
```

**Problema:** Durante la recarga de página, estas dependencias cambian múltiples veces:
1. `user` cambia de `null` → `User`
2. `roleLoading` cambia de `true` → `false`
3. `userRole` cambia de `null` → `'owner'`

Cada cambio dispara el `useEffect`, causando múltiples consultas a la API.

---

### **Problema 2: Evento `onAuthStateChange` en cada Recarga**

Supabase dispara eventos de autenticación en cada recarga de página:

```typescript
// lib/auth-context.tsx:943-960
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_OUT") {
    setUser(null);
    setLastUserId(null);
    clearCache(); // ⚠️ Limpia localStorage
    router.push("/auth/login");
  } else if (event === "SIGNED_IN" && session?.user) {
    setUser(session.user);
    setLastUserId(session.user.id);
  } else if (session?.user) {
    setUser(session.user);
    setLastUserId(session.user.id);
  } else {
    setUser(null);
    setLastUserId(null);
  }
});
```

**Eventos comunes de Supabase al recargar:**
- `TOKEN_REFRESHED` - Cuando se refresca el token automáticamente
- `USER_UPDATED` - Cuando se actualiza información del usuario
- `SIGNED_IN` - Al recuperar la sesión desde cookies
- `INITIAL_SESSION` - Al cargar la sesión inicial

**El problema:** No todos estos eventos están siendo manejados explícitamente, causando comportamiento inconsistente.

---

### **Problema 3: `clearCache()` Borra `parking_est_id`**

Cuando se cierra sesión (intencional o accidentalmente disparado), la función `clearCache()` **NO borra explícitamente** `parking_est_id`, pero el `signOut()` sí lo hace:

```typescript
// lib/auth-context.tsx:1072-1089
const signOut = async () => {
  try {
    setUser(null);
    clearCache();

    if (typeof window !== 'undefined') {
      // ⚠️ ESTO BORRA parking_est_id
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('parking_') || key.startsWith('supabase') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });

      sessionStorage.clear();
    }

    await supabase.auth.signOut({ scope: 'global' });
    router.push("/auth/login");
  }
};
```

**El problema:** Si por alguna razón Supabase dispara un evento que parece un `SIGNED_OUT` (o el código interpreta mal el evento), se ejecuta este código y **borra todo el localStorage**, incluyendo `parking_est_id`.

---

### **Problema 4: Middleware Ejecuta en Cada Request**

El middleware ([`middleware.ts`](middleware.ts)) se ejecuta en **cada request del servidor**, incluyendo navegación y recarga:

```typescript
// middleware.ts:72-80
const { data: { user } } = await supabase.auth.getUser();

// Si no hay usuario autenticado
if (!user) {
  url.pathname = '/auth/login';
  return NextResponse.redirect(url);
}
```

**Flujo al recargar:**
1. Browser hace request a `/dashboard`
2. Middleware ejecuta `getUser()`
3. Si Supabase aún no ha restaurado la sesión desde cookies → `user = null`
4. Redirige a `/auth/login` (flash visible)
5. Supabase termina de cargar sesión
6. Detecta que hay usuario
7. Redirige de vuelta a `/dashboard`

**Resultado:** "Flash" de logout/login visible al usuario.

---

## 🔬 Flujo Completo del Problema

```
┌─────────────────────────────────────────────────────────────────┐
│ ESCENARIO: Usuario recarga /dashboard con estacionamiento 90   │
└─────────────────────────────────────────────────────────────────┘

1️⃣ Usuario presiona F5 en /dashboard
   ↓
2️⃣ Browser hace request a servidor (middleware.ts ejecuta)
   ↓
3️⃣ Middleware llama getUser()
   │
   ├─ ⚠️ TIMING ISSUE: Si cookies no cargaron aún → user = null
   │  └─ Redirige a /auth/login (FLASH visible)
   │
   └─ ✅ Si cookies cargaron → user exists
      └─ Continúa a /dashboard
   ↓
4️⃣ Cliente (navegador) ejecuta lib/auth-context.tsx
   ↓
5️⃣ useEffect de inicialización (línea 908)
   - supabase.auth.getSession() → carga sesión
   - setUser(session?.user)
   ↓
6️⃣ onAuthStateChange dispara eventos:
   - Posibles eventos: SIGNED_IN, TOKEN_REFRESHED, etc.
   - ⚠️ Si algún evento se malinterpreta → puede ejecutar clearCache()
   ↓
7️⃣ useEffect de rol (línea 820)
   - fetchUserRole() consulta API
   - setUserRole('owner')
   - ⚠️ Cambio de estado dispara re-render
   ↓
8️⃣ useEffect de estId (línea 658)
   - Se ejecuta MÚLTIPLES veces:
     * Primera vez: user cambia
     * Segunda vez: userRole cambia
     * Tercera vez: roleLoading cambia
   ↓
9️⃣ Flujo de getUserEstId():
   │
   ├─ 🟢 Guard: ¿Ya tenemos estId?
   │  └─ SI → Retorna (evita consulta API)
   │
   ├─ 🟢 localStorage: ¿Existe parking_est_id?
   │  │
   │  ├─ SI → setEstId(90) ✅
   │  │
   │  └─ NO → Consulta API /api/auth/get-parking-id
   │     └─ Devuelve PRIMER estacionamiento (85) ❌
   ↓
🔟 Resultado:
   - Si localStorage sobrevivió → estId = 90 ✅
   - Si localStorage se borró → estId = 85 ❌
```

---

## 💡 Causas Específicas del Bug

### **Causa A: Race Condition entre Middleware y Cliente**

El middleware server-side ejecuta antes que el código cliente cargue la sesión de Supabase desde localStorage/cookies. Esto causa:

1. Middleware detecta `user = null` (sesión aún no restaurada)
2. Redirige a `/auth/login`
3. Cliente carga y detecta sesión válida
4. Redirige de vuelta

**Resultado:** Flash visible de login/logout.

---

### **Causa B: Eventos de Supabase No Manejados**

`onAuthStateChange` puede disparar eventos como:
- `TOKEN_REFRESHED`
- `USER_UPDATED`
- `INITIAL_SESSION`

El código actual solo maneja explícitamente:
- `SIGNED_OUT`
- `SIGNED_IN`
- `session?.user` (catch-all)

**Problema:** Eventos no manejados pueden causar comportamiento inesperado.

---

### **Causa C: Multiple Ejecuciones del useEffect**

El useEffect de la línea 658 tiene como dependencias:
- `user?.id`
- `userRole`
- `roleLoading`

Durante la carga inicial, estos valores cambian **secuencialmente**:

```typescript
Estado inicial:
{ user: null, userRole: null, roleLoading: false }

Cambio 1: user carga
{ user: {id: "123"}, userRole: null, roleLoading: false }
→ useEffect ejecuta (1era vez)

Cambio 2: roleLoading = true
{ user: {id: "123"}, userRole: null, roleLoading: true }
→ useEffect NO ejecuta (tiene guard roleLoading)

Cambio 3: userRole carga
{ user: {id: "123"}, userRole: "owner", roleLoading: false }
→ useEffect ejecuta (2da vez)
```

**Problema:** Múltiples ejecuciones pueden causar que el guard `if (estId !== null)` no funcione correctamente si `estId` aún no se estableció.

---

### **Causa D: localStorage Puede Borrarse**

Aunque no se llame explícitamente a `signOut()`, hay **múltiples lugares** donde se puede borrar `localStorage`:

1. **clearCache()** (línea 461) - No borra `parking_est_id` directamente
2. **signOut()** (línea 1082) - Borra TODO lo que empieza con `parking_`
3. **clearAuthCompletely()** (línea 501-502) - Borra explícitamente `parking_est_id`
4. **Navegador** - Configuración de privacidad, extensiones, etc.

---

## 🛠️ Soluciones Propuestas

### **Solución 1: Agregar Logging Detallado** ⭐ (PRIMER PASO)

Antes de arreglar, necesitamos **confirmar qué está pasando exactamente**.

**Agregar logs en auth-context.tsx:**

```typescript
// Modificar onAuthStateChange
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔔 AUTH EVENT:', event, 'Session:', session ? 'exists' : 'null');

  if (!mounted) return;

  if (event === "SIGNED_OUT") {
    console.log('🚪 SIGNED_OUT detectado, limpiando...');
    setUser(null);
    setLastUserId(null);
    clearCache();
    router.push("/auth/login");
  } else if (event === "SIGNED_IN" && session?.user) {
    console.log('✅ SIGNED_IN detectado');
    setUser(session.user);
    setLastUserId(session.user.id);
  } else if (event === "TOKEN_REFRESHED") {
    console.log('🔄 TOKEN_REFRESHED detectado');
    // No hacer nada, mantener estado actual
  } else if (event === "INITIAL_SESSION") {
    console.log('🎬 INITIAL_SESSION detectado');
    if (session?.user) {
      setUser(session.user);
      setLastUserId(session.user.id);
    }
  } else if (session?.user) {
    console.log('👤 Session exists (otro evento)');
    setUser(session.user);
    setLastUserId(session.user.id);
  } else {
    console.log('❌ No session, no SIGNED_OUT');
    setUser(null);
    setLastUserId(null);
  }
});
```

---

### **Solución 2: Proteger localStorage de Borrado Accidental** ⭐⭐ (CRÍTICO)

**Modificar `clearCache()` para preservar `parking_est_id`:**

```typescript
// lib/auth-context.tsx:461
const clearCache = () => {
  // Limpiar datos específicos de la app
  localStorage.removeItem(STORAGE_KEYS.RATES);
  localStorage.removeItem(STORAGE_KEYS.RATES_TIMESTAMP);
  localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS);
  localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS_TIMESTAMP);
  localStorage.removeItem(STORAGE_KEYS.CAPACITY);
  localStorage.removeItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);

  // 🟢 NO borrar parking_est_id - debe persistir entre sesiones para owners
  // Solo se borra en logout explícito

  // Limpiar tokens de Supabase
  if (typeof window !== 'undefined') {
    Object.keys(localStorage).forEach(key => {
      if (key.includes('supabase') || key.includes('sb-') || key.startsWith('supabase.auth.token')) {
        localStorage.removeItem(key);
      }
    });
  }
};
```

**Modificar `signOut()` para SOLO borrar `parking_est_id` en logout intencional:**

```typescript
const signOut = async () => {
  try {
    setUser(null);
    clearCache();

    if (typeof window !== 'undefined') {
      // ⚠️ Solo borrar en signOut INTENCIONAL
      console.log('🧹 Borrando parking_est_id en logout intencional');
      localStorage.removeItem('parking_est_id');
      localStorage.removeItem('user_role');

      // Borrar tokens de Supabase
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('supabase') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      });

      sessionStorage.clear();
    }

    await supabase.auth.signOut({ scope: 'global' });
    router.push("/auth/login");
  }
};
```

---

### **Solución 3: Manejar Todos los Eventos de Supabase Explícitamente**

```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔔 AUTH EVENT:', event);

  if (!mounted) return;

  switch (event) {
    case "SIGNED_OUT":
      console.log('🚪 Logout detectado');
      setUser(null);
      setLastUserId(null);
      clearCache();
      router.push("/auth/login");
      break;

    case "SIGNED_IN":
      console.log('✅ Login detectado');
      if (session?.user) {
        setUser(session.user);
        setLastUserId(session.user.id);
      }
      break;

    case "TOKEN_REFRESHED":
      console.log('🔄 Token refrescado (no cambiar estado)');
      // No hacer nada, mantener usuario actual
      break;

    case "USER_UPDATED":
      console.log('👤 Usuario actualizado');
      if (session?.user) {
        setUser(session.user);
      }
      break;

    case "INITIAL_SESSION":
      console.log('🎬 Sesión inicial cargada');
      if (session?.user) {
        setUser(session.user);
        setLastUserId(session.user.id);
      }
      break;

    default:
      console.log('❓ Evento desconocido:', event);
      if (session?.user) {
        setUser(session.user);
        setLastUserId(session.user.id);
      } else {
        // Solo resetear si NO hay sesión y el evento no es TOKEN_REFRESHED
        if (event !== 'TOKEN_REFRESHED') {
          setUser(null);
          setLastUserId(null);
        }
      }
  }
});
```

---

### **Solución 4: Optimizar useEffect para Evitar Múltiples Ejecuciones**

```typescript
// Agregar un ref para controlar si ya se ejecutó
const estIdInitialized = useRef(false);

useEffect(() => {
  if (user?.id && !roleLoading && userRole) {
    console.log(`👤 Usuario autenticado: ${user.email}, userRole: ${userRole}`);

    const getUserEstId = async () => {
      try {
        if (userRole === 'conductor') {
          setEstId(null);
          return null;
        }

        // 🟢 NUEVO: Si ya inicializamos, no ejecutar de nuevo
        if (estIdInitialized.current) {
          console.log('✅ estId ya inicializado, saltando');
          return;
        }

        // 🟢 Guard: Si ya tenemos estId, marcar como inicializado
        if (estId !== null) {
          console.log(`✅ Ya tenemos estId en el estado: ${estId}`);
          estIdInitialized.current = true;
          return estId;
        }

        // Verificar localStorage
        if (typeof window !== 'undefined') {
          const savedEstId = localStorage.getItem('parking_est_id');
          if (savedEstId) {
            console.log(`📦 estId encontrado en localStorage: ${savedEstId}`);
            const parsedEstId = parseInt(savedEstId);
            setEstId(parsedEstId);
            estIdInitialized.current = true; // 🟢 Marcar como inicializado
            return parsedEstId;
          }
        }

        // Consultar API solo si NO hay en localStorage
        console.log(`🔍 Consultando API...`);
        const ownerResponse = await fetch('/api/auth/get-parking-id');

        if (ownerResponse.ok) {
          const ownerData = await ownerResponse.json();
          if (ownerData?.has_parking && ownerData.est_id) {
            console.log(`✅ Usuario es DUEÑO: ${ownerData.est_id}`);
            setEstId(ownerData.est_id);
            localStorage.setItem('parking_est_id', String(ownerData.est_id));
            estIdInitialized.current = true; // 🟢 Marcar como inicializado
            return ownerData.est_id;
          }
        }

        // ... resto del código para empleados
      } catch (error) {
        console.error(`❌ Error obteniendo estId:`, error);
        setEstId(null);
      }
    };

    getUserEstId();
  } else {
    // Reset cuando no hay usuario
    estIdInitialized.current = false; // 🟢 Permitir reinicialización
    setEstId(null);
  }
}, [user?.id, userRole, roleLoading]);
```

---

### **Solución 5: Mejorar Timing del Middleware** (Opcional, más complejo)

Agregar un pequeño delay en el middleware para dar tiempo a que Supabase cargue la sesión:

```typescript
// middleware.ts:72-80
const { data: { user } } = await supabase.auth.getUser();

// Si no hay usuario, verificar cookies antes de redirigir
if (!user) {
  // Verificar si hay tokens de Supabase en cookies (sesión pendiente)
  const hasSupabaseTokens = request.cookies.getAll().some(cookie =>
    cookie.name.includes('sb-') || cookie.name.includes('supabase')
  );

  if (hasSupabaseTokens) {
    // Hay cookies de sesión, probablemente loading
    // Permitir continuar (la sesión se cargará en el cliente)
    console.log('⏳ Tokens encontrados, permitiendo continuar...');
    return response;
  }

  // No hay tokens ni usuario → Redirigir a login
  url.pathname = '/auth/login';
  timer.end();
  return NextResponse.redirect(url);
}
```

**Limitación:** Esto puede permitir acceso temporal a rutas protegidas si no hay sesión válida.

---

## 📊 Resumen de Soluciones Priorizadas

| Solución | Prioridad | Impacto | Complejidad |
|----------|-----------|---------|-------------|
| **Proteger localStorage** | 🥇 ALTA | ⭐⭐⭐⭐⭐ | Baja |
| **Manejar eventos Supabase** | 🥇 ALTA | ⭐⭐⭐⭐ | Media |
| **Agregar logging** | 🥈 MEDIA | ⭐⭐⭐ (debug) | Baja |
| **Optimizar useEffect** | 🥉 BAJA | ⭐⭐⭐ | Media |
| **Mejorar middleware timing** | ⚠️ OPCIONAL | ⭐⭐ | Alta |

---

## 🎯 Plan de Acción Recomendado

### **Fase 1: Diagnóstico (Hacer primero)**

1. ✅ Agregar logging detallado en `onAuthStateChange`
2. ✅ Agregar logs en cada lugar donde se modifica localStorage
3. ✅ Hacer pruebas de recarga y observar logs en consola

**Objetivo:** Confirmar exactamente qué evento/código está causando el problema.

---

### **Fase 2: Fix Crítico**

1. ✅ Proteger `parking_est_id` en `clearCache()`
2. ✅ Manejar explícitamente eventos `TOKEN_REFRESHED`, `INITIAL_SESSION`, etc.
3. ✅ Agregar ref `estIdInitialized` para evitar múltiples ejecuciones

**Objetivo:** Eliminar el bug de reset a primer estacionamiento.

---

### **Fase 3: Mejora de UX**

1. ✅ Agregar spinner o loading state durante recarga
2. ✅ Evitar flash visual de logout/login
3. ✅ Considerar implementar solución de BD del otro documento

---

## 📝 Archivos a Modificar

1. [`lib/auth-context.tsx`](lib/auth-context.tsx)
   - Línea 461: `clearCache()` - No borrar `parking_est_id`
   - Línea 943: `onAuthStateChange` - Manejar todos los eventos
   - Línea 658: `useEffect` - Agregar ref para control de inicialización
   - Línea 1072: `signOut()` - Solo borrar en logout intencional

2. [`middleware.ts`](middleware.ts) (Opcional)
   - Línea 72: Mejorar detección de sesión pendiente

---

## 🔗 Referencias

- [Supabase Auth Events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- Documento relacionado: [PROBLEMA-RESET-ESTACIONAMIENTO-AL-RECARGAR.md](PROBLEMA-RESET-ESTACIONAMIENTO-AL-RECARGAR.md)

---

**Fecha del Análisis:** 2025-10-08
**Versión del Sistema:** Actual (rama: `arreglo-hora-y-tabla-movimientos`)
