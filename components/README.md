# components/

**Rol / propósito:** Biblioteca de componentes React reutilizables para la interfaz del sistema de estacionamiento, incluyendo paneles operativos, diálogos modales, widgets y elementos de UI.

## Contenido clave
- `operator-panel.tsx` - Panel principal del operador para gestionar entradas/salidas
- `admin-panel.tsx` - Panel administrativo con historial y configuraciones
- `dashboard-layout.tsx` - Layout principal del dashboard con sidebar y header
- `ui/` - 52 componentes de interfaz base (botones, formularios, tablas, etc.)
- `parking-map.tsx` - Componente de mapa para visualización de plazas
- `payment-*.tsx` - Múltiples componentes para manejo de pagos (QR, métodos, etc.)
- `ZonaEstacionamiento.tsx` - Componente para gestión de zonas de parking
- `theme-provider.tsx` - Proveedor de tema para modo claro/oscuro

## Estructura

```
components/
├── ui/                    # Componentes base reutilizables
│   ├── button.tsx         # Botones estilizados
│   ├── card.tsx           # Tarjetas contenedoras
│   ├── table.tsx          # Tablas de datos
│   ├── dialog.tsx         # Diálogos modales
│   └── ...                # 48+ componentes más
├── admin/                 # Componentes específicos de admin
├── auth/                  # Componentes de autenticación
├── turnos/                # Componentes para gestión de turnos
├── admin-panel.tsx        # Panel administrativo principal
├── operator-panel.tsx     # Panel del operador principal
├── dashboard-layout.tsx   # Layout del dashboard
├── parking-map.tsx        # Mapa de estacionamiento
├── google-map.tsx         # Integración con Google Maps
└── ...                    # Más de 20 componentes específicos
```

## Entradas/Salidas

- **Entradas**: Props de React (datos, callbacks, configuración)
- **Salidas**: Elementos JSX renderizados, eventos de usuario, llamadas a APIs

## Cómo se usa desde afuera

```typescript
// Importar desde páginas Next.js
import { OperatorPanel } from '@/components/operator-panel'
import { DashboardLayout } from '@/components/dashboard-layout'

// Usar en componentes
<DashboardLayout>
  <OperatorPanel />
</DashboardLayout>

// Componentes UI base
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
```

## Dependencias y contratos

- **Depende de**: Librerías UI (Radix UI, Lucide icons), utilidades en `/lib`, contexto de autenticación
- **Expone**: Componentes React tipados con TypeScript, estilos con Tailwind CSS

## Puntos de extensión / modificar con seguridad

- Añadir nuevos componentes: crear archivos `.tsx` siguiendo patrón de nomenclatura
- Extender componentes UI: modificar archivos en `ui/` (afectan toda la app)
- Nuevos paneles: crear componentes siguiendo patrón `*-panel.tsx`

## Convenciones / notas

- Usar 'use client' para componentes interactivos
- Tipado estricto con TypeScript
- Estilos con Tailwind CSS y shadcn/ui
- Nombres descriptivos: `ComponentName.tsx`
- Componentes modulares y reutilizables
- Manejo de estado con React hooks

