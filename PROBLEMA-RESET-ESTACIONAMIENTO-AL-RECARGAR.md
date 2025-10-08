# Problema: Reset al Primer Estacionamiento al Recargar la Página

## 📋 Descripción del Problema

Cuando un usuario dueño (owner) de múltiples estacionamientos selecciona un estacionamiento diferente al primero y luego **recarga la página (F5 o Ctrl+R)**, el sistema vuelve automáticamente al primer estacionamiento de la lista, perdiendo la selección del usuario.

### Comportamiento Actual

1. ✅ Usuario inicia sesión → Sistema carga el primer estacionamiento (ID: 85)
2. ✅ Usuario selecciona otro estacionamiento (ID: 90) → Sistema cambia correctamente
3. ❌ Usuario recarga la página (F5) → Sistema vuelve al primer estacionamiento (ID: 85)

### Comportamiento Esperado

El sistema debería **mantener el estacionamiento seleccionado** incluso después de recargar la página.

---

## 🔍 Análisis de la Causa Raíz

### 1. **Flujo Actual de Carga del `estId`**

El problema está en el archivo [`lib/auth-context.tsx`](lib/auth-context.tsx) en el efecto que se ejecuta cuando el usuario se autentica (líneas 658-738):

```typescript
useEffect(() => {
  if (user?.id && !roleLoading && userRole) {
    const getUserEstId = async () => {
      try {
        if (userRole === 'conductor') {
          setEstId(null);
          return null;
        }

        // 🟢 PASO 1: Verificar localStorage
        if (typeof window !== 'undefined') {
          const savedEstId = localStorage.getItem('parking_est_id');
          if (savedEstId) {
            console.log(`📦 estId encontrado en localStorage: ${savedEstId}`);
            const parsedEstId = parseInt(savedEstId);
            setEstId(parsedEstId);
            return parsedEstId;  // ✅ RETORNA AQUÍ - Esto funciona
          }
        }

        // 🔴 PASO 2: Si NO hay localStorage, consultar API
        console.log(`🔍 No hay estId en localStorage, consultando API...`);
        const ownerResponse = await fetch('/api/auth/get-parking-id');

        if (ownerResponse.ok) {
          const ownerData = await ownerResponse.json();
          if (ownerData && ownerData.has_parking && ownerData.est_id) {
            console.log(`✅ Usuario es DUEÑO de estacionamiento: ${ownerData.est_id}`);
            setEstId(ownerData.est_id);  // ⚠️ PROBLEMA: Siempre devuelve el PRIMER estacionamiento
            localStorage.setItem('parking_est_id', String(ownerData.est_id));
            return ownerData.est_id;
          }
        }
        // ... continúa con verificación de empleado
      } catch (error) {
        console.error(`❌ Error obteniendo estId:`, error);
        setEstId(null);
        return null;
      }
    };

    getUserEstId();
  } else {
    // Usuario no autenticado
    setEstId(null);
    // ... reset de otros estados
  }
}, [user?.id, userRole, roleLoading]);
```

### 2. **Problema en el Endpoint API `/api/auth/get-parking-id`**

El endpoint que devuelve el estacionamiento del usuario **siempre devuelve el primer estacionamiento** ordenado por `est_id`:

**Archivo:** [`app/api/auth/get-parking-id/route.ts`](app/api/auth/get-parking-id/route.ts) (líneas 35-76)

```typescript
// Buscar TODOS los estacionamientos del usuario
const { data: estacionamientosData, error: estacionamientosError } = await supabase
  .from('estacionamientos')
  .select('est_id, est_nombre, due_id')
  .eq('due_id', usuarioData.usu_id)
  .order('est_id');  // ⚠️ Ordena por est_id ascendente

if (!estacionamientosData || estacionamientosData.length === 0) {
  return NextResponse.json({
    has_parking: false,
    usuario_id: usuarioData.usu_id,
    message: "Usuario encontrado pero sin estacionamientos asignados"
  });
}

console.log(`✅ Usuario ${userEmail} tiene ${estacionamientosData.length} estacionamiento(s)`);

// 🔴 PROBLEMA: Siempre devuelve el PRIMERO de la lista
const primerEstacionamiento = estacionamientosData[0];

return NextResponse.json({
  has_parking: true,
  est_id: primerEstacionamiento.est_id,  // ⚠️ Siempre el primer ID
  est_nombre: primerEstacionamiento.est_nombre,
  usuario_id: usuarioData.usu_id,
  total_estacionamientos: estacionamientosData.length,
  estacionamientos: estacionamientosData.map(e => ({
    est_id: e.est_id,
    est_nombre: e.est_nombre
  }))
});
```

### 3. **El Flujo Completo del Bug**

```
┌─────────────────────────────────────────────────────────────┐
│ ESCENARIO: Usuario recarga la página después de seleccionar│
│            un estacionamiento diferente al primero          │
└─────────────────────────────────────────────────────────────┘

1️⃣ Usuario recarga la página (F5)
   ↓
2️⃣ Se ejecuta useEffect en auth-context.tsx (línea 658)
   ↓
3️⃣ Intenta leer 'parking_est_id' de localStorage
   │
   ├─ ✅ SI existe → Usa ese valor (FUNCIONA)
   │
   └─ ❌ SI NO existe → Llama a /api/auth/get-parking-id
      ↓
4️⃣ El endpoint /api/auth/get-parking-id:
   - Consulta TODOS los estacionamientos del usuario
   - Los ordena por est_id (ascendente)
   - Devuelve SIEMPRE el primero: estacionamientosData[0]
   ↓
5️⃣ Se establece el PRIMER estacionamiento en el estado
   ↓
6️⃣ Se guarda en localStorage el ID del PRIMER estacionamiento
   ↓
7️⃣ Usuario pierde la selección previa
```

---

## 💡 Casos en los que el Bug se Manifiesta

### ✅ Casos que FUNCIONAN (porque localStorage existe)

1. Usuario selecciona estacionamiento → Navega a otra página → Vuelve
   - **Funciona** porque localStorage se mantiene durante la sesión

2. Usuario selecciona estacionamiento → Cierra pestaña → Abre nueva pestaña (mismo navegador)
   - **Funciona** porque localStorage persiste entre pestañas

### ❌ Casos que FALLAN (porque localStorage no existe o se borra)

1. **Recarga manual (F5 o Ctrl+R)** en algunos navegadores con configuración agresiva de privacidad
   - Si el navegador borra localStorage al recargar

2. **Primera carga después de login**
   - localStorage aún no tiene el valor guardado

3. **Navegación en modo incógnito con recarga**
   - localStorage se borra entre recargas en algunos navegadores

4. **Borrado manual del localStorage por el navegador**
   - Configuraciones de privacidad, extensiones, etc.

5. **Cambio de dispositivo o navegador**
   - localStorage no se sincroniza entre dispositivos

---

## 🛠️ Solución Implementada

### **Guardar Último Estacionamiento en Base de Datos (Solo para Dueños)** ⭐

Crear un campo en la base de datos para guardar la **última selección del usuario dueño (owner)**. Esta funcionalidad es **exclusiva para dueños** ya que son los únicos que pueden tener múltiples estacionamientos y necesitan cambiar entre ellos.

> **Nota Importante:** Los playeros y conductores no necesitan esta funcionalidad porque:
> - **Playeros:** Están asignados a un único estacionamiento fijo
> - **Conductores:** No gestionan estacionamientos

#### Ventajas
- ✅ Persistencia entre dispositivos
- ✅ Sobrevive a limpieza de caché/localStorage
- ✅ Más robusto y confiable
- ✅ Sincronización automática entre pestañas/dispositivos
- ✅ Específico para dueños que realmente lo necesitan

---

## 📝 Pasos de Implementación

### **Paso 1: Migración de Base de Datos**

Agregar campo `ultimo_estacionamiento_seleccionado` en la tabla `usuario`:

```sql
-- Migración: Agregar campo para guardar último estacionamiento seleccionado
-- Solo se usa para usuarios con rol 'owner'
ALTER TABLE usuario
ADD COLUMN ultimo_estacionamiento_seleccionado INT REFERENCES estacionamientos(est_id) ON DELETE SET NULL;

-- Comentario para documentación
COMMENT ON COLUMN usuario.ultimo_estacionamiento_seleccionado
IS 'Último estacionamiento seleccionado por el usuario. Solo aplicable para dueños (owners) con múltiples estacionamientos.';
```

---

### **Paso 2: Modificar Endpoint `/api/auth/get-parking-id/route.ts`**

Modificar el endpoint para que devuelva el último estacionamiento seleccionado del dueño:

```typescript
import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const userEmail = user.email;

        // 🟢 MODIFICADO: Incluir campo ultimo_estacionamiento_seleccionado
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id, usu_email, ultimo_estacionamiento_seleccionado')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            console.log(`📍 Usuario ${userEmail} no encontrado en tabla usuario`);
            return NextResponse.json({
                has_parking: false,
                message: "Usuario necesita configuración inicial"
            });
        }

        // Buscar TODOS los estacionamientos del usuario
        const { data: estacionamientosData, error: estacionamientosError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, due_id')
            .eq('due_id', usuarioData.usu_id)
            .order('est_id');

        if (estacionamientosError) {
            console.error("❌ Error obteniendo estacionamientos:", estacionamientosError);
            return NextResponse.json({
                has_parking: false,
                usuario_id: usuarioData.usu_id,
                message: "Error consultando estacionamientos"
            });
        }

        if (!estacionamientosData || estacionamientosData.length === 0) {
            console.log(`🅿️ No se encontraron estacionamientos para usuario ${userEmail}`);
            return NextResponse.json({
                has_parking: false,
                usuario_id: usuarioData.usu_id,
                message: "Usuario encontrado pero sin estacionamientos asignados"
            });
        }

        console.log(`✅ Usuario ${userEmail} tiene ${estacionamientosData.length} estacionamiento(s)`);

        // 🟢 NUEVO: Lógica para seleccionar el estacionamiento correcto
        let estacionamientoActual = estacionamientosData[0]; // Fallback al primero

        // Si el usuario tiene guardado un último estacionamiento seleccionado
        if (usuarioData.ultimo_estacionamiento_seleccionado) {
            // Verificar que el estacionamiento guardado aún existe y pertenece al usuario
            const estacionamientoGuardado = estacionamientosData.find(
                e => e.est_id === usuarioData.ultimo_estacionamiento_seleccionado
            );

            if (estacionamientoGuardado) {
                console.log(`🎯 Usando último estacionamiento seleccionado: ${estacionamientoGuardado.est_id}`);
                estacionamientoActual = estacionamientoGuardado;
            } else {
                console.log(`⚠️ Último estacionamiento guardado (${usuarioData.ultimo_estacionamiento_seleccionado}) ya no existe, usando primero`);
            }
        } else {
            console.log(`📍 No hay último estacionamiento guardado, usando primero: ${estacionamientoActual.est_id}`);
        }

        return NextResponse.json({
            has_parking: true,
            est_id: estacionamientoActual.est_id,
            est_nombre: estacionamientoActual.est_nombre,
            usuario_id: usuarioData.usu_id,
            total_estacionamientos: estacionamientosData.length,
            estacionamientos: estacionamientosData.map(e => ({
                est_id: e.est_id,
                est_nombre: e.est_nombre
            }))
        });

    } catch (error) {
        console.error("❌ Error obteniendo parking_id:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

---

### **Paso 3: Crear Endpoint para Actualizar la Selección**

Crear nuevo archivo `app/api/user/update-last-parking/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint para actualizar el último estacionamiento seleccionado por un dueño (owner)
 * Solo se usa cuando un usuario con múltiples estacionamientos cambia entre ellos
 */
export async function POST(request: NextRequest) {
    try {
        const { estId } = await request.json();
        const { supabase } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        // Validar que estId sea un número válido
        if (!estId || typeof estId !== 'number') {
            return NextResponse.json(
                { error: "estId inválido" },
                { status: 400 }
            );
        }

        console.log(`🔄 Actualizando último estacionamiento para ${user.email}: ${estId}`);

        // Actualizar último estacionamiento seleccionado
        const { error } = await supabase
            .from('usuario')
            .update({ ultimo_estacionamiento_seleccionado: estId })
            .eq('usu_email', user.email);

        if (error) {
            console.error('❌ Error actualizando último estacionamiento:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        console.log(`✅ Último estacionamiento actualizado correctamente: ${estId}`);
        return NextResponse.json({ success: true, estId });

    } catch (error) {
        console.error("❌ Error en update-last-parking:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

---

### **Paso 4: Modificar Context para Guardar Automáticamente (Solo Owners)**

En [`lib/auth-context.tsx`](lib/auth-context.tsx), modificar la función `setEstId` para que guarde automáticamente en BD cuando un **owner** cambia de estacionamiento.

**Opción A: Modificar el Context Provider**

Agregar esta función dentro del `AuthProvider`:

```typescript
// En AuthProvider, antes del return
const setEstIdWithPersistence = useCallback(async (newEstId: number | null) => {
  setEstId(newEstId);

  // Solo guardar en BD si es owner y el estId es válido
  if (newEstId !== null && userRole === 'owner' && typeof window !== 'undefined') {
    // Guardar en localStorage (backup local)
    localStorage.setItem('parking_est_id', String(newEstId));

    // 🟢 NUEVO: Guardar en base de datos (solo para owners)
    try {
      console.log(`💾 Guardando selección de estacionamiento en BD: ${newEstId}`);
      const response = await fetch('/api/user/update-last-parking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estId: newEstId })
      });

      if (response.ok) {
        console.log(`✅ Selección guardada correctamente en BD`);
      } else {
        console.error('⚠️ Error guardando en BD, pero localStorage sigue funcionando');
      }
    } catch (error) {
      console.error('❌ Error guardando último estacionamiento:', error);
      // No es crítico, localStorage sigue funcionando
    }
  }
}, [userRole]);
```

Luego exportar en el Context:

```typescript
return (
  <AuthContext.Provider
    value={{
      // ... otros valores
      setEstId: setEstIdWithPersistence, // 🟢 Usar versión con persistencia
      // ... resto de valores
    }}
  >
    {children}
  </AuthContext.Provider>
);
```

**Opción B: Modificar directamente en el componente que usa setEstId**

En [`app/dashboard/parking/page.tsx`](app/dashboard/parking/page.tsx):

```typescript
const handleSelectParking = async (newEstId: number) => {
    console.log('🔄 Iniciando cambio de estacionamiento a:', newEstId);

    // Cambiar el estacionamiento en el contexto
    setEstId(newEstId);

    // 🟢 NUEVO: Guardar en base de datos (solo se ejecuta para owners)
    try {
        await fetch('/api/user/update-last-parking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estId: newEstId })
        });
        console.log(`✅ Selección guardada en BD: ${newEstId}`);
    } catch (error) {
        console.error('Error guardando selección:', error);
        // No es crítico, localStorage sigue funcionando
    }

    // Mostrar toast
    toast({
        title: "Cambiando estacionamiento...",
        description: `Cargando datos del estacionamiento ID: ${newEstId}`
    });

    // Refrescar datos del nuevo estacionamiento
    setTimeout(async () => {
        try {
            await Promise.all([
                refreshParkedVehicles(),
                refreshParkingHistory(),
                refreshCapacity()
            ]);

            toast({
                title: "Estacionamiento cambiado",
                description: `Ahora estás gestionando el estacionamiento ID: ${newEstId}`
            });
        } catch (error) {
            console.error('Error al cambiar estacionamiento:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar los datos del nuevo estacionamiento"
            });
        }
    }, 100);
};
```

---

## ⚙️ Consideraciones de Implementación

### 1. **Solo para Dueños (Owners)**

La funcionalidad de guardar el último estacionamiento **solo se aplica cuando `userRole === 'owner'`** porque:

- ✅ Los **owners** pueden tener múltiples estacionamientos y cambian entre ellos
- ❌ Los **playeros** están asignados a un único estacionamiento (no necesitan cambiar)
- ❌ Los **conductores** no gestionan estacionamientos

### 2. **Validación en el Backend**

El endpoint `/api/user/update-last-parking` debería idealmente verificar:

```typescript
// Opcional: Verificar que el usuario es owner
const { data: roleData } = await supabase.rpc('obtener_rol_usuario', {
    p_user_email: user.email
});

if (roleData !== 'owner') {
    return NextResponse.json(
        { error: "Solo los dueños pueden guardar preferencias de estacionamiento" },
        { status: 403 }
    );
}

// Verificar que el estacionamiento pertenece al usuario
const { data: estData } = await supabase
    .from('estacionamientos')
    .select('est_id')
    .eq('est_id', estId)
    .eq('due_id', (await supabase
        .from('usuario')
        .select('usu_id')
        .eq('usu_email', user.email)
        .single()
    ).data?.usu_id)
    .single();

if (!estData) {
    return NextResponse.json(
        { error: "Estacionamiento no encontrado o no pertenece al usuario" },
        { status: 403 }
    );
}
```

### 3. **Fallback a localStorage**

El sistema mantiene `localStorage` como backup por si:
- La llamada a la BD falla
- El usuario está offline
- Hay problemas de red temporales

### 4. **Migración de Datos Existentes**

Los usuarios existentes tendrán `ultimo_estacionamiento_seleccionado = NULL`, por lo que:
- Primera vez que se ejecute el endpoint `/api/auth/get-parking-id` → Devolverá el primer estacionamiento
- Cuando el usuario seleccione un estacionamiento → Se guardará en BD
- Próximas recargas → Se usará el valor guardado

---

## 📊 Resumen de Archivos a Modificar

### ✅ **Archivos que se Crean:**

1. **Migración SQL:** Nueva migración para agregar columna
   - Archivo: `supabase/migrations/YYYYMMDDHHMMSS_add_ultimo_estacionamiento_seleccionado.sql`

2. **Nuevo Endpoint:** Para actualizar selección
   - Archivo: `app/api/user/update-last-parking/route.ts`

### ✏️ **Archivos que se Modifican:**

1. [`app/api/auth/get-parking-id/route.ts`](app/api/auth/get-parking-id/route.ts)
   - Incluir campo `ultimo_estacionamiento_seleccionado` en la consulta
   - Agregar lógica para priorizar estacionamiento guardado

2. [`lib/auth-context.tsx`](lib/auth-context.tsx) **O** [`app/dashboard/parking/page.tsx`](app/dashboard/parking/page.tsx)
   - Opción A: Modificar `setEstId` en el context (recomendado)
   - Opción B: Modificar `handleSelectParking` en la página

---

## 🎯 Recomendación de Implementación

**Se recomienda Opción A** (modificar el context) porque:
- ✅ Centraliza la lógica de persistencia
- ✅ Se aplica automáticamente en todos los lugares donde se llama `setEstId`
- ✅ Más mantenible a largo plazo
- ✅ Garantiza que siempre se guarde, sin importar desde dónde se llame

---

## 📝 Notas Adicionales

### Efectos Secundarios del Bug

1. **UX Negativa**: El usuario pierde su selección sin explicación
2. **Datos Incorrectos**: Al recargar, ve datos del estacionamiento equivocado
3. **Confusión**: Puede registrar vehículos en el estacionamiento incorrecto

### Logging Actual

El sistema ya tiene logs útiles para debugging:
- `📦 estId encontrado en localStorage`
- `🔍 No hay estId en localStorage, consultando API`
- `✅ Usuario es DUEÑO de estacionamiento: {id}`

---

## 🔗 Referencias

- [`lib/auth-context.tsx:658-738`](lib/auth-context.tsx) - Lógica de carga de estId
- [`lib/auth-context.tsx:535-541`](lib/auth-context.tsx) - useEffect que guarda en localStorage
- [`app/api/auth/get-parking-id/route.ts:62-76`](app/api/auth/get-parking-id/route.ts) - Endpoint que devuelve primer estacionamiento
- [`app/dashboard/parking/page.tsx:14-49`](app/dashboard/parking/page.tsx) - Handler de selección de estacionamiento
- [`components/user-parkings.tsx:38-42`](components/user-parkings.tsx) - Componente que muestra lista de estacionamientos

---

**Fecha del Análisis:** 2025-10-08
**Versión del Sistema:** Actual (rama: `arreglo-hora-y-tabla-movimientos`)
