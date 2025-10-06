# app/

**Rol / propósito:** Contiene la estructura de rutas y componentes de Next.js App Router, incluyendo páginas, layouts, API routes y configuraciones globales.

## Contenido clave
- `api/` - 60+ endpoints serverless para operaciones backend (auth, parking, payments, etc.)
- `dashboard/` - Páginas del panel principal con múltiples módulos (operador, admin, configuración)
- `auth/` - Páginas de autenticación y registro de usuarios
- `conductor/` - Funcionalidades específicas para conductores
- `payment/` - Páginas de estado de pagos (success, pending, failure)
- `layout.tsx` - Layout raíz de la aplicación
- `page.tsx` - Página principal del sistema
- `globals.css` - Estilos globales CSS

## Estructura

```
app/
├── api/                    # API routes serverless
│   ├── auth/              # Autenticación y registro
│   ├── parking/           # Operaciones de estacionamiento
│   ├── payment/           # Procesamiento de pagos
│   ├── capacity/          # Gestión de capacidad
│   ├── rates/             # Administración de tarifas
│   └── ...                # Más de 10 módulos API
├── dashboard/             # Panel principal
│   ├── operador/          # Panel del operador
│   ├── panel-administrador/  # Panel administrativo
│   ├── empleados/         # Gestión de empleados
│   ├── tarifas/           # Configuración de tarifas
│   └── ...                # Módulos adicionales
├── auth/                  # Páginas de autenticación
├── conductor/             # Funcionalidades de conductor
├── payment/               # Estados de pago
├── layout.tsx             # Layout raíz
├── page.tsx               # Home page
└── globals.css            # Estilos globales
```

## Entradas/Salidas

- **Entradas**: Rutas HTTP (GET/POST/PUT/DELETE) desde el frontend
- **Salidas**: Respuestas JSON para el frontend, páginas HTML renderizadas

## Cómo se usa desde afuera

```typescript
// Desde componentes React - navegación
import { useRouter } from 'next/navigation'
const router = useRouter()
router.push('/dashboard/operador')

// Llamadas a API routes
const response = await fetch('/api/parking/entry', {
  method: 'POST',
  body: JSON.stringify(vehicleData)
})
```

## Dependencias y contratos

- **Depende de**: Componentes en `/components`, utilidades en `/lib`, base de datos Supabase
- **Expone**: Rutas web accesibles, endpoints API RESTful, páginas renderizadas

## Puntos de extensión / modificar con seguridad

- Añadir nuevas rutas: crear carpetas en `dashboard/` o archivos `page.tsx`
- Nuevos endpoints API: crear archivos `route.ts` en subcarpetas de `api/`
- Modificar layout global: editar `layout.tsx` (afecta toda la app)

## Convenciones / notas

- Usar App Router de Next.js 14+
- Archivos `page.tsx` para rutas, `route.ts` para APIs
- Rutas dinámicas con `[param]` o `[...slug]`
- Layouts anidados para secciones específicas
- Server Components por defecto, Client Components con 'use client'

