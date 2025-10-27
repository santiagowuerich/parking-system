# Sección de Reportes

Esta sección proporciona análisis y reportes detallados del negocio para el perfil de dueño.

## Estructura

### Página Principal (`/dashboard/reportes`)
- **3 Tabs**: Operativos, Económicos, Estrategia
- **9 Tarjetas** (3 por tab) que navegan a reportes individuales
- Diseño responsive con grid adaptativo

### Reportes Disponibles

#### 📊 OPERATIVOS
1. **Ocupación y Disponibilidad** (`/reportes/operativos/ocupacion`)
   - Tasa de ocupación por zona/hora
   - Identificación de horas pico
   - Disponibilidad en tiempo real

2. **Movimientos Diarios** (`/reportes/operativos/movimientos`)
   - Registro de entradas/salidas
   - Tiempos de permanencia
   - Patrones de uso

3. **Desempeño de Turnos** (`/reportes/operativos/turnos`)
   - Rendimiento por playero
   - Vehículos atendidos por turno
   - Eficiencia operativa

#### 💰 ECONÓMICOS
4. **Ingresos por Período** (`/reportes/economicos/ingresos`)
   - Evolución de ingresos diarios/semanales/mensuales
   - Análisis de tendencias
   - Comparativas

5. **Medios de Pago** (`/reportes/economicos/medios-pago`)
   - Distribución: Efectivo, Transferencia, MercadoPago, QR
   - Análisis de preferencias
   - Tendencias de uso

6. **Abonos y Suscripciones** (`/reportes/economicos/abonos`)
   - Ingresos recurrentes
   - Renovaciones mensuales
   - Próximos vencimientos

#### 📈 ESTRATEGIA
7. **Tendencias y Proyecciones** (`/reportes/estrategia/tendencias`)
   - Análisis histórico
   - Proyecciones futuras
   - Patrones de comportamiento

8. **Rentabilidad por Zona** (`/reportes/estrategia/rentabilidad`)
   - ROI por zona
   - Rentabilidad por tipo de vehículo
   - Optimización de recursos

9. **Comparativo de Períodos** (`/reportes/estrategia/comparativo`)
   - Mes vs mes
   - Trimestre vs trimestre
   - Año vs año

## Componentes Compartidos

### `ReporteCard`
Tarjeta reutilizable para el grid de la página principal.

**Props:**
- `icon`: Ícono de Lucide
- `title`: Título del reporte
- `description`: Descripción breve
- `href`: Ruta del reporte
- `badge?`: Badge opcional (ej: "Popular", "Nuevo")
- `color?`: Variante de color (blue, green, purple, orange)

### `ReporteLayout`
Layout wrapper para páginas de reporte.

**Props:**
- `title`: Título de la página
- `description`: Descripción de la página
- `children`: Contenido del reporte

### `ReporteHeader`
Header común con filtros y controles.

**Props:**
- `title`: Título del reporte
- `subtitle?`: Subtítulo opcional
- `dateRange?`: Rango de fechas seleccionado
- `onDateRangeChange?`: Callback para cambio de fechas
- `onPrint?`: Callback para imprimir
- `onExport?`: Callback para exportar
- `showDateFilter?`: Mostrar selector de fechas (default: true)
- `showPrintButton?`: Mostrar botón imprimir (default: true)
- `showExportButton?`: Mostrar botón exportar (default: false)

### `EmptyState`
Estado vacío para cuando no hay datos.

**Props:**
- `icon?`: Ícono a mostrar
- `title?`: Título del mensaje
- `description?`: Descripción del mensaje
- `className?`: Clases CSS adicionales

## Estado Actual

✅ **Estructura completa creada**
- Sidebar actualizado con nueva sección "Reportes"
- Página principal con tabs funcional
- 9 páginas de reportes con estructura básica
- Componentes compartidos implementados

🚧 **Próximos pasos**
- Implementar APIs para cada reporte
- Agregar gráficos con recharts
- Implementar lógica de filtros de fecha
- Conectar con datos reales de Supabase
- Agregar funcionalidad de impresión/exportación

## Tecnologías

- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** (Tabs, Card, Button, Calendar, Popover)
- **Lucide React** (iconos)
- **date-fns** (manejo de fechas)
- **recharts** (gráficos - por implementar)

## Navegación

Desde el sidebar del perfil dueño:
```
Dashboard > Reportes
├── Operativos
│   ├── Ocupación y Disponibilidad
│   ├── Movimientos Diarios
│   └── Desempeño de Turnos
├── Económicos
│   ├── Ingresos por Período
│   ├── Medios de Pago
│   └── Abonos y Suscripciones
└── Estrategia
    ├── Tendencias y Proyecciones
    ├── Rentabilidad por Zona
    └── Comparativo de Períodos
```
