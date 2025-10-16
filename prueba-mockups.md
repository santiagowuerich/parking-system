# Prompt para generar Mockup del Mapa de Plazas

## 📍 PROMPT COMPLETO PARA CURSOR COMPOSER

```
Crea un dashboard moderno e interactivo del mapa de estacionamientos con las siguientes características:

LAYOUT PRINCIPAL:
- Diseño de dos columnas: mapa grande (70% ancho) + panel lateral (30% ancho)
- Header superior con título "Mapa de Estacionamientos" y estadísticas rápidas
- Diseño completamente responsive con shadcn/ui y Tailwind CSS

MAPA INTERACTIVO:
- Mapa grande y central con marcadores coloridos
- Marcadores circulares con colores según disponibilidad:
  * Verde (#10b981): Disponible (más de 5 espacios libres)
  * Naranja (#f59e0b): Pocos espacios (1-5 espacios libres)
  * Rojo (#ef4444): Lleno (sin espacios disponibles)
  * Azul (#3b82f6): Plaza seleccionada
- Tamaño de marcadores: normal=10px, seleccionado=12px
- Animación de rebote al seleccionar
- Popover/info window moderno al hacer clic en marcador

PANEL LATERAL:
- Lista scrollable de plazas con filtros
- Barra de búsqueda por nombre/dirección
- Filtros desplegables:
  * Tipo de vehículo (Auto/Moto/Camión/Todos)
  * Radio de distancia (1km, 2km, 5km, 10km)
  * Estado (Todos/Disponible/Pocos/Lleno)
- Tarjetas de plaza con:
  * Nombre del estacionamiento
  * Dirección
  * Indicador de estado (círculo de color)
  * Espacios disponibles / capacidad total
  * Horario de funcionamiento
  * Distancia desde ubicación actual
  * Botón "Ver en mapa" y "Reservar"

ESTADÍSTICAS EN TIEMPO REAL (HEADER):
- Total de plazas: X
- Plazas disponibles: X (verde)
- Plazas con pocos espacios: X (naranja)
- Plazas llenas: X (rojo)
- Ocupación promedio: XX%

FUNCIONALIDADES:
- Geolocalización automática del usuario
- Filtros aplicados en tiempo real
- Estado hover en tarjetas y marcadores
- Animaciones suaves de transición
- Modo oscuro compatible

BOTONES DE ACCIÓN:
- "Mi ubicación" - centrar mapa en GPS
- "Actualizar" - refrescar datos
- "Vista satélite" - alternar tipo de mapa
- "Pantalla completa" - expandir mapa

INTEGRACIÓN TÉCNICA:
- Usa TypeScript con tipos estrictos
- Componentes shadcn/ui: Card, Button, Badge, Input, Select, Dialog
- Iconos de Lucide React
- Diseño mobile-first responsive
- Estados de loading y error handling
- Animaciones con Tailwind CSS

El resultado debe ser un componente React completamente funcional que se integre perfectamente con el sistema de estacionamiento existente.
```
---
## ✨ Mockup Rápido – Preview Visual

> ⚡ **Sigue este modelo para compartir rápidamente tu mockup antes de codear la versión real.**

### 💡 Propósito
Previsualizar cómo se vería el dashboard solicitado antes de implementar el código.

---

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       Mapa de Estacionamientos (header)                   │
│  Estadísticas:  🟢 12 disponibles   🟠 3 pocos   🔴 2 llenos   OCC: 81%     │
├──────────────────────────┬─────────────────────────────────────────────────┤
│ [MAPA DE PLAZAS]         │  [Panel lateral]                               │
│   • Marcadores:          │   ┌────────────────────────────────────────┐   │
│     🟢 disponible        │   │ Buscar: [___________] ⦿                 │   │
│     🟠 pocos espacios    │   │ Tipo vehículo:  [Todos v]              │   │
│     🔴 lleno             │   │ Distancia:     [2km v]                 │   │
│     🔵 seleccionado      │   │ Estado:        [Disponible v]           │   │
│                         │   │----------------------------------------│   │
│   [Mapa interactivo     │   │ ⦿ Plaza Norte     🟢  14/20             │   │
│       con marcadores,   │   │   Av. Central 123                        │   │
│       animaciones, etc] │   │   450m • 8:00-22:00      [Ver] [Reservar]│  │
│                        │   │----------------------------------------│   │
│                        │   │ ⦿ Parking Sur      🟠  3/12              │  │
│                        │   │ ...                                    │   │
│                        │   └────────────────────────────────────────┘   │
├──────────────────────────┴────────────────────────────────────────────────┤
│ Acciones: [📍 Mi ubicación] [↻ Actualizar] [🛰 Satélite] [⛶ Pantalla comp.] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Notas:**
- El diseño es 70% mapa, 30% panel.
- Los círculos de estado usan los colores especificados.
- Todos los filtros están en el panel lateral.
- Botones principales debajo del mapa.

---

## 🖼️ Inspírate visualmente

- [shadcn/ui dashboard](https://ui.shadcn.com/examples/dashboard)
- [Map mockups en Figma o Dribbble](https://dribbble.com/tags/parking_map)
- [Lucide icons cheatsheet](https://lucide.dev/icons/)

---

## ⏭️ Siguiente paso

Cuando te aprueben el mockup, **comienza la implementación del componente real en React/TypeScript** con la arquitectura propuesta.

---
