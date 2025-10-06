# hooks/

**Rol / propósito:** Custom hooks reutilizables de React para lógica común del sistema de estacionamiento, incluyendo detección de dispositivos móviles y gestión de notificaciones toast.

## Contenido clave
- `use-mobile.tsx` - Hook para detectar si el dispositivo es móvil basado en el ancho de pantalla
- `use-toast.ts` - Hook para gestión centralizada de notificaciones toast

## Estructura

```
hooks/
├── use-mobile.tsx          # Detección de dispositivos móviles
└── use-toast.ts            # Sistema de notificaciones toast
```

## Entradas/Salidas

- **Entradas**: Eventos del navegador (resize), configuración de notificaciones
- **Salidas**: Estados booleanos (isMobile), funciones para mostrar toasts

## Cómo se usa desde afuera

```typescript
// Detección de móvil
import { useIsMobile } from '@/hooks/use-mobile'
const isMobile = useIsMobile()

// Notificaciones toast
import { useToast } from '@/hooks/use-toast'
const { toast } = useToast()
toast({ title: "Éxito", description: "Operación completada" })
```

## Dependencias y contratos

- **Depende de**: React hooks (useState, useEffect), matchMedia API
- **Expone**: Funciones hook tipadas, estados reactivos

## Puntos de extensión / modificar con seguridad

- Añadir nuevo hook: crear `use-*.tsx` siguiendo patrón de nomenclatura
- Extender funcionalidad: modificar hooks existentes manteniendo compatibilidad
- Nuevos tipos de notificación: extender `use-toast.ts` con nuevas variantes

## Convenciones / notas

- Nombres descriptivos: `use-*` para hooks personalizados
- Archivos `.tsx` para hooks con JSX, `.ts` para hooks puros
- Tipado estricto con TypeScript
- Reutilización de lógica común entre componentes
