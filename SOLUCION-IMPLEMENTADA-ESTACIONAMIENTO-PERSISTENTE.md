# Solución Implementada: Persistencia de Estacionamiento Seleccionado

## 📋 Problema Original

Al recargar la página o cerrar/abrir el navegador, el sistema volvía al **primer estacionamiento** (ID: 85) en lugar de mantener el estacionamiento seleccionado (ID: 90).

### Síntomas:
- ✅ Selección funciona correctamente
- ❌ Recarga (F5) vuelve al primer estacionamiento
- ❌ Cerrar y abrir navegador vuelve al primer estacionamiento
- ⚠️ Flash visible de `/auth/login` al recargar
- ⚠️ Múltiples llamadas a `/api/auth/get-parking-id`

---

## 🛠️ Solución Implementada

### **Cambio 1: Proteger localStorage en `clearCache()`**

**Archivo:** [`lib/auth-context.tsx:461`](lib/auth-context.tsx#L461)

**Antes:**
```typescript
const clearCache = () => {
  // Borraba todos los datos de la app
  // incluyendo indirectamente parking_est_id
};
```

**Ahora:**
```typescript
const clearCache = () => {
  console.log('🧹 Ejecutando clearCache()');

  // Limpiar solo datos temporales (rates, settings, capacity)
  localStorage.removeItem(STORAGE_KEYS.RATES);
  // ... otros datos temporales

  // 🟢 NO borrar parking_est_id - debe persistir entre recargas
  console.log('✅ Preservando parking_est_id en localStorage');

  // Limpiar solo tokens de Supabase
};
```

**Beneficio:** `parking_est_id` ya NO se borra en eventos automáticos de Supabase.

---

### **Cambio 2: Modificar `signOut()` para Borrado Selectivo**

**Archivo:** [`lib/auth-context.tsx:1079`](lib/auth-context.tsx#L1079)

**Antes:**
```typescript
const signOut = async () => {
  clearCache();

  // Borraba TODO lo que empiece con 'parking_'
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('parking_') || ...) {
      localStorage.removeItem(key);
    }
  });
};
```

**Ahora:**
```typescript
const signOut = async () => {
  console.log('🚪 Iniciando logout INTENCIONAL');
  clearCache();

  // 🟢 Borrar explícitamente solo en logout intencional
  localStorage.removeItem('parking_est_id');
  localStorage.removeItem('user_role');

  // Borrar solo tokens de Supabase (no usar startsWith)
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('supabase') || key.startsWith('sb-')) {
      localStorage.removeItem(key);
    }
  });
};
```

**Beneficio:** `parking_est_id` solo se borra cuando el usuario hace logout INTENCIONAL.

---

### **Cambio 3: Agregar `useRef` para Control de Inicialización**

**Archivo:** [`lib/auth-context.tsx:152`](lib/auth-context.tsx#L152)

**Agregado:**
```typescript
// Ref para controlar que getUserEstId solo se ejecute UNA VEZ por usuario
const estIdInitialized = useRef(false);
```

**Beneficio:** Evita múltiples ejecuciones del useEffect que causaban consultas duplicadas a la API.

---

### **Cambio 4: Optimizar `useEffect` con Ref y Prioridad a localStorage**

**Archivo:** [`lib/auth-context.tsx:669-764`](lib/auth-context.tsx#L669-L764)

**Flujo ANTES:**
```
1. useEffect ejecuta
2. Verifica if (estId !== null) → Siempre false en recarga
3. Verifica localStorage
4. Si no hay → Consulta API (devuelve primer estacionamiento)
5. Sobrescribe selección del usuario
```

**Flujo AHORA:**
```typescript
const getUserEstId = async () => {
  // 1️⃣ Si es conductor → No necesita estId
  if (userRole === 'conductor') {
    setEstId(null);
    estIdInitialized.current = true;
    return null;
  }

  // 2️⃣ 🟢 GUARD: Si ya inicializamos, no ejecutar de nuevo
  if (estIdInitialized.current) {
    console.log(`✅ estId ya fue inicializado, saltando ejecución`);
    return;
  }

  // 3️⃣ 🟢 PRIORIDAD 1: localStorage PRIMERO (persiste entre recargas)
  if (typeof window !== 'undefined') {
    const savedEstId = localStorage.getItem('parking_est_id');
    if (savedEstId) {
      console.log(`📦 estId encontrado en localStorage: ${savedEstId} - USANDO ESTE`);
      const parsedEstId = parseInt(savedEstId);
      setEstId(parsedEstId);
      estIdInitialized.current = true; // 🟢 Marcar como inicializado
      return parsedEstId;
    }
  }

  // 4️⃣ 🟢 PRIORIDAD 2: API solo si NO hay en localStorage
  console.log(`🔍 No hay estId en localStorage, consultando API...`);
  const ownerResponse = await fetch('/api/auth/get-parking-id');

  if (ownerResponse.ok) {
    const ownerData = await ownerResponse.json();
    if (ownerData?.has_parking && ownerData.est_id) {
      setEstId(ownerData.est_id);
      localStorage.setItem('parking_est_id', String(ownerData.est_id));
      estIdInitialized.current = true; // 🟢 Marcar como inicializado
      return ownerData.est_id;
    }
  }

  // ... resto del código para empleados
};

// Resetear ref cuando no hay usuario
if (!user?.id || !userRole || roleLoading) {
  estIdInitialized.current = false; // 🟢 Permitir reinicialización
}
```

**Beneficios:**
1. ✅ **localStorage tiene prioridad absoluta** - Si existe, se usa directamente
2. ✅ **Una sola ejecución por usuario** - El ref previene llamadas duplicadas
3. ✅ **API solo en primera vez** - Solo se consulta cuando NO hay localStorage
4. ✅ **Reseteo correcto** - El ref se resetea al cambiar de usuario

---

## 🔄 Flujo Completo DESPUÉS de los Cambios

```
┌─────────────────────────────────────────────────────────────┐
│ ESCENARIO: Usuario recarga página con estacionamiento 90   │
└─────────────────────────────────────────────────────────────┘

1️⃣ Usuario presiona F5
   ↓
2️⃣ Middleware ejecuta → Puede causar flash de /auth/login (timing)
   ↓
3️⃣ Cliente carga → AuthContext inicializa
   ↓
4️⃣ Supabase restaura sesión desde cookies
   - Dispara eventos: INITIAL_SESSION, TOKEN_REFRESHED, etc.
   - clearCache() NO borra parking_est_id ✅
   ↓
5️⃣ useEffect de rol ejecuta → Obtiene userRole = 'owner'
   ↓
6️⃣ useEffect de estId ejecuta (línea 669)
   │
   ├─ Guard: estIdInitialized.current === false ✅
   │
   ├─ localStorage.getItem('parking_est_id')
   │  └─ Encuentra '90' ✅
   │
   ├─ setEstId(90) ✅
   │
   └─ estIdInitialized.current = true ✅
   ↓
7️⃣ useEffect se dispara de nuevo (cambio de dependencias)
   │
   └─ Guard: estIdInitialized.current === true
      └─ RETORNA sin ejecutar ✅
   ↓
8️⃣ Usuario ve estacionamiento 90 ✅
   └─ NO se llama a /api/auth/get-parking-id ✅
```

---

## 📊 Resultados Esperados

### ✅ **Casos que AHORA Funcionan:**

1. **Recarga de página (F5)**
   - Mantiene estacionamiento seleccionado ✅
   - No consulta API innecesariamente ✅

2. **Cerrar y abrir navegador**
   - localStorage persiste ✅
   - Carga el estacionamiento correcto ✅

3. **Cambiar de pestaña y volver**
   - Estado se mantiene ✅

4. **Token refresh automático**
   - No resetea estacionamiento ✅

### ✅ **Casos donde SÍ se Borra (Correcto):**

1. **Logout intencional** (botón Cerrar Sesión)
   - Borra `parking_est_id` ✅
   - Usuario vuelve a login ✅

2. **Error crítico de token** (`clearAuthCompletely()`)
   - Limpia todo ✅

---

## 🔍 Logs para Debugging

Con los cambios implementados, ahora verás estos logs en la consola:

### **Al Recargar Página (Flujo Exitoso):**

```
🎯 estId cambió a: null
👤 Usuario autenticado: prueba35@gmail.com, userRole: owner, verificando estacionamiento...
📦 estId encontrado en localStorage: 90 - USANDO ESTE
💾 Guardado en localStorage: 90
🎯 estId cambió a: 90
✅ estId ya fue inicializado, saltando ejecución
```

### **Primera Vez (Sin localStorage):**

```
👤 Usuario autenticado: prueba35@gmail.com, userRole: owner, verificando estacionamiento...
🔍 No hay estId en localStorage, consultando API...
✅ Usuario es DUEÑO de estacionamiento: 85
📝 Guardando primer estacionamiento en localStorage (primera vez): 85
💾 Guardado en localStorage: 85
```

### **Al Hacer Logout:**

```
🚪 Iniciando logout INTENCIONAL
🧹 Ejecutando clearCache()
✅ Preservando parking_est_id en localStorage
🧹 Borrando parking_est_id y user_role (logout intencional)
```

### **Si clearCache() Se Ejecuta (Eventos Supabase):**

```
🧹 Ejecutando clearCache()
✅ Preservando parking_est_id en localStorage
```

---

## ⚠️ Problema Pendiente: Flash de Login

**Síntoma:** Al recargar, se ve un flash de la página `/auth/login` por 1 microsegundo.

**Causa:** Race condition entre middleware (server) y carga de sesión (client).

**Estado:** No resuelto en esta implementación.

**Próximo paso:** Implementar Solución 2 del documento:
- [PROBLEMA-RECARGA-PAGINA-LOGOUT-Y-LOGIN.md](PROBLEMA-RECARGA-PAGINA-LOGOUT-Y-LOGIN.md)
- Manejar eventos de Supabase explícitamente (`TOKEN_REFRESHED`, `INITIAL_SESSION`, etc.)

---

## 📝 Archivos Modificados

1. [`lib/auth-context.tsx`](lib/auth-context.tsx)
   - Línea 3-10: Agregado `useRef` a imports
   - Línea 152: Agregado `estIdInitialized` ref
   - Línea 461-488: Modificado `clearCache()`
   - Línea 669-764: Optimizado `useEffect` de estId
   - Línea 1079-1142: Modificado `signOut()`

---

## 🧪 Pasos para Probar

1. **Login** como owner con múltiples estacionamientos (ej: `prueba35@gmail.com`)

2. **Seleccionar** estacionamiento diferente al primero (ej: ID 90)

3. **Abrir DevTools** → Console

4. **Recargar página (F5)** y verificar:
   - ✅ Logs muestran: `📦 estId encontrado en localStorage: 90`
   - ✅ Dashboard muestra estacionamiento 90
   - ✅ NO se llama a `/api/auth/get-parking-id`

5. **Cerrar Chrome completamente** → Volver a abrir → Ir a dashboard:
   - ✅ Mantiene estacionamiento 90

6. **Hacer logout** y verificar:
   - ✅ Logs muestran: `🧹 Borrando parking_est_id...`
   - ✅ Vuelve a `/auth/login`

7. **Login de nuevo**:
   - ✅ Carga primer estacionamiento (porque se borró en logout)

---

## 🎯 Conclusión

La solución implementada resuelve el **90% del problema**:

### ✅ Resuelto:
- Persistencia de estacionamiento entre recargas
- Evitar consultas innecesarias a la API
- Protección de localStorage en eventos automáticos

### ⚠️ Pendiente:
- Flash de `/auth/login` al recargar (problema cosmético)
- Optimización de eventos de Supabase

---

**Fecha de Implementación:** 2025-10-08
**Versión:** v1.0
**Archivos Modificados:** 1 ([`lib/auth-context.tsx`](lib/auth-context.tsx))
