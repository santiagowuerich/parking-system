# 🔧 Plan de Arreglo - Problema de Dashboard por Roles

## 📋 Problema Identificado

El dashboard tiene **comportamiento inconsistente** al mostrar opciones según el rol del usuario:

- ✅ **Dueño**: Debería ver todas las opciones administrativas
- 👷 **Empleado**: Debería ver solo panel de operador simple
- 🚗 **Conductor**: Debería ver dashboard general limitado

### ❌ Problemas Encontrados

1. **Lógica de roles fragmentada**:
   - Middleware usa consulta unificada (`/api/auth/get-role`)
   - Dashboard usa múltiples consultas (`/api/auth/get-parking-id` + `/api/auth/get-employee-parking`)
   - AuthContext duplica lógica del dashboard

2. **Problemas de timing**:
   - Dashboard carga `isOwner` de forma asíncrona
   - Usuario ve opciones de "dueño" inicialmente, luego cambian
   - Flash de contenido incorrecto

3. **Cache inconsistente**:
   - `estId` se guarda en localStorage pero puede estar desactualizado
   - No hay invalidación de cache cuando cambian roles/asignaciones

4. **Validaciones duplicadas**:
   - Middleware redirige basado en rol
   - Dashboard vuelve a validar el mismo rol
   - Conflicto entre capas de validación

## 🎯 Plan de Solución

### Fase 1: Unificar Lógica de Roles 🔄
**Tiempo estimado**: 1-2 horas
**Impacto**: Alto

- ✅ **Modificar AuthContext** para usar `/api/auth/get-role` en lugar de consultas múltiples
- ✅ **Actualizar dashboard principal** para usar rol unificado
- ✅ **Simplificar lógica** de determinación de `isOwner`
- ✅ **Eliminar consultas redundantes** (`get-parking-id`, `get-employee-parking`)

### Fase 2: Optimizar Carga Inicial 🚀
**Tiempo estimado**: 30-45 minutos
**Impacto**: Alto

- ✅ **Cargar rol en AuthContext** durante inicialización
- ✅ **Mostrar loading state** mientras se determina el rol
- ✅ **Evitar renderizado condicional** hasta tener rol confirmado
- ✅ **Prevenir flash** de contenido incorrecto

### Fase 3: Mejorar Sistema de Cache 💾
**Tiempo estimado**: 45-60 minutos
**Impacto**: Medio

- ✅ **Cache rol en localStorage** con timestamp
- ✅ **Invalidar cache** cuando cambian asignaciones
- ✅ **Fallback inteligente** si cache está corrupto
- ✅ **Sincronización** entre pestañas del navegador

### Fase 4: Simplificar Validaciones 📝
**Tiempo estimado**: 30-45 minutos
**Impacto**: Bajo

- ✅ **Crear hook personalizado** `useUserRole()` para centralizar lógica
- ✅ **Eliminar validaciones duplicadas** en componentes
- ✅ **Usar permisos basados en rol** en lugar de múltiples flags
- ✅ **Documentar** permisos por rol

## 🛠️ Implementación Detallada

### 1. Unificar Lógica de Roles

**Modificar `lib/auth-context.tsx`**:
```typescript
// Agregar estado de rol
const [userRole, setUserRole] = useState<'owner' | 'playero' | 'conductor' | null>(null);

// Función para obtener rol unificado
const fetchUserRole = async () => {
  try {
    const response = await fetch('/api/auth/get-role');
    if (response.ok) {
      const data = await response.json();
      setUserRole(data.role);
      // Guardar en localStorage con timestamp
      localStorage.setItem('user_role', JSON.stringify({
        role: data.role,
        timestamp: Date.now()
      }));
      return data.role;
    }
  } catch (error) {
    console.error('Error obteniendo rol:', error);
  }
  return null;
};
```

### 2. Optimizar Dashboard Loading

**Modificar `app/dashboard/page.tsx`**:
```typescript
// Agregar estado de carga del rol
const [roleLoading, setRoleLoading] = useState(true);

// Cargar rol al montar componente
useEffect(() => {
  const loadUserRole = async () => {
    setRoleLoading(true);
    await fetchUserRole();
    setRoleLoading(false);
  };

  if (user && !userRole) {
    loadUserRole();
  } else {
    setRoleLoading(false);
  }
}, [user]);

// Mostrar loading mientras se determina el rol
if (roleLoading) {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando...</span>
      </div>
    </DashboardLayout>
  );
}

// Solo renderizar contenido cuando se conoce el rol
if (userRole === 'playero') {
  return <Redirect to="/dashboard/operador-simple" />;
}
```

### 3. Crear Hook Personalizado

**Crear `lib/use-user-role.ts`**:
```typescript
import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<'owner' | 'playero' | 'conductor' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user) return;

      // Intentar obtener de cache primero
      const cached = localStorage.getItem('user_role');
      if (cached) {
        const { role: cachedRole, timestamp } = JSON.parse(cached);
        // Cache válido por 5 minutos
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setRole(cachedRole);
          setLoading(false);
          return;
        }
      }

      // Si no hay cache válido, consultar API
      try {
        const response = await fetch('/api/auth/get-role');
        if (response.ok) {
          const data = await response.json();
          setRole(data.role);
        }
      } catch (error) {
        console.error('Error obteniendo rol:', error);
      }

      setLoading(false);
    };

    fetchRole();
  }, [user]);

  return { role, loading, isOwner: role === 'owner', isEmployee: role === 'playero' };
}
```

## 📊 Resultados Esperados

### ✅ Beneficios del Arreglo

1. **Consistencia**: Un solo sistema para determinar roles
2. **Performance**: Menos consultas a la base de datos
3. **UX**: Sin flashes de contenido incorrecto
4. **Mantenibilidad**: Lógica centralizada y reutilizable
5. **Cache**: Roles se cargan más rápido en visitas posteriores

### ⏱️ Tiempo de Implementación

- **Fase 1**: 1-2 horas (Unificar lógica)
- **Fase 2**: 30-45 minutos (Optimizar carga)
- **Fase 3**: 45-60 minutos (Mejorar cache)
- **Fase 4**: 30-45 minutos (Simplificar validaciones)

**Total estimado**: 3-4 horas

### 🧪 Testing Plan

1. **Test Dueño**:
   - Crear usuario con estacionamiento propio
   - Verificar redirección a `/dashboard`
   - Verificar todas las opciones administrativas

2. **Test Empleado**:
   - Crear usuario asignado como empleado
   - Verificar redirección a `/dashboard/operador-simple`
   - Verificar opciones limitadas

3. **Test Conductor**:
   - Usuario sin estacionamiento ni asignación
   - Verificar acceso limitado al dashboard

4. **Test Cache**:
   - Verificar carga rápida en refresh
   - Verificar invalidación cuando cambian roles

## 🚀 ¿Quieres que implemente esta solución?

El plan está diseñado para resolver completamente el problema de manera sistemática. ¿Te parece bien proceder con la implementación?
