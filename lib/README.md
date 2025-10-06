# lib/

**Rol / propósito:** Utilidades centrales del sistema, incluyendo contextos de autenticación, integraciones con servicios externos, tipos TypeScript, hooks personalizados y funciones auxiliares.

## Contenido clave
- `auth-context.tsx` - Contexto principal de autenticación y estado global de la app
- `supabase.ts` - Configuración de clientes Supabase (usuario y admin)
- `types.ts` - Definiciones de tipos TypeScript para toda la aplicación
- `utils.ts` - Funciones utilitarias generales
- `hooks/` - Custom hooks para lógica reutilizable
- `constants/` - Constantes de configuración
- `logger.ts` - Sistema de logging y debugging
- `use-user-role.ts` - Hook para gestión de roles de usuario

## Estructura

```
lib/
├── auth-context.tsx        # Contexto de autenticación principal
├── supabase.ts             # Configuración Supabase
├── supabase/               # Utilidades específicas de Supabase
├── types.ts                # Tipos TypeScript globales
├── utils.ts                # Funciones utilitarias
├── logger.ts               # Sistema de logging
├── use-user-role.ts        # Hook de roles de usuario
├── constants/              # Constantes de configuración
├── hooks/                  # Custom hooks
│   ├── use-parkings.ts     # Hook para gestión de estacionamientos
│   ├── use-rates.ts        # Hook para tarifas
│   └── ...                 # Más hooks específicos
├── empleados-utils.ts      # Utilidades para gestión de empleados
└── botpress.ts             # Integración con Botpress
```

## Entradas/Salidas

- **Entradas**: Variables de entorno, configuración inicial, callbacks de componentes
- **Salidas**: Estados globales, funciones de utilidad, tipos TypeScript, hooks personalizados

## Cómo se usa desde afuera

```typescript
// Importar tipos
import { Vehicle, ParkingHistory } from '@/lib/types'

// Usar contexto de autenticación
import { useAuth } from '@/lib/auth-context'
const { user, estId, signIn, signOut } = useAuth()

// Utilidades generales
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger'

// Cliente Supabase
import { supabase } from '@/lib/supabase'
```

## Dependencias y contratos

- **Depende de**: Variables de entorno, paquetes npm (Supabase, Next.js)
- **Expone**: Contextos React, custom hooks, tipos TypeScript, funciones puras

## Puntos de extensión / modificar con seguridad

- Añadir nuevos tipos: extender `types.ts` con interfaces adicionales
- Nuevos hooks: crear archivos en `hooks/` siguiendo patrón `use-*.ts`
- Integraciones externas: añadir archivos como `botpress.ts` o `google-maps.ts`
- Utilidades: extender `utils.ts` con funciones puras

## Convenciones / notas

- Archivos `.ts` para utilidades puras, `.tsx` para contextos React
- Tipado estricto con TypeScript
- Separación clara entre lógica de negocio y presentación
- Custom hooks para lógica reutilizable
- Logger centralizado para debugging
- Constantes en mayúsculas y archivos dedicados

