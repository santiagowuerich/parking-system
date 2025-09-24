# Plan de Implementación: Sistema de Turnos y Caja para Empleados

## Resumen del Proyecto
Crear una nueva página que permita a los empleados (playeros) registrar sus horarios de entrada y salida, así como gestionar el estado de la caja (fondo inicial, cierre de caja, observaciones).

## Análisis de las Capturas
Basándome en las imágenes proporcionadas, el modal muestra:
- **Caja**: Selector de caja (Caja 1 Principal)
- **Horario**: Campo de tiempo (12:00 am)
- **Fondo de caja**: Monto de cierre ($0,00)
- **Observaciones**: Campos de texto opcionales
- **Botón FIN**: Para confirmar el registro

## Estructura de Base de Datos Requerida

### Tabla `turnos_empleados`
```sql
- tur_id (INT, PRIMARY KEY, AUTO_INCREMENT)
- play_id (INT, FOREIGN KEY to usuario.usu_id)
- est_id (INT, FOREIGN KEY to estacionamientos.est_id)
- tur_fecha (DATE)
- tur_hora_entrada (TIME)
- tur_hora_salida (TIME, NULL)
- tur_estado (ENUM: 'activo', 'finalizado')
- tur_observaciones_entrada (TEXT, NULL)
- tur_observaciones_salida (TEXT, NULL)
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
```

### Tabla `cajas_empleados`
```sql
- caj_id (INT, PRIMARY KEY, AUTO_INCREMENT)
- tur_id (INT, FOREIGN KEY to turnos_empleados.tur_id)
- caj_nombre (VARCHAR: 'Caja 1 (Principal)', 'Caja 2', etc.)
- caj_fondo_inicial (DECIMAL(10,2))
- caj_fondo_final (DECIMAL(10,2), NULL)
- caj_observaciones_apertura (TEXT, NULL)
- caj_observaciones_cierre (TEXT, NULL)
- caj_estado (ENUM: 'abierta', 'cerrada')
- created_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)
- updated_at (TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
```

## Arquitectura de la Aplicación

### 1. Nueva Página Principal
**Ruta**: `/dashboard/turnos`
**Archivo**: `app/dashboard/turnos/page.tsx`

**Funcionalidades**:
- Vista del estado actual del turno del empleado
- Botón "Iniciar Turno" si no hay turno activo
- Información del turno activo con botón "Finalizar Turno"
- Historial de turnos del día/semana

### 2. Componentes React

#### `TurnoStatusCard.tsx`
- Muestra el estado actual del turno
- Información de hora de entrada, duración actual
- Estado de la caja asignada

#### `IniciarTurnoModal.tsx`
- Modal para iniciar turno
- Seleccionar caja disponible
- Ingresar fondo inicial de caja
- Campo de observaciones iniciales
- Registrar hora de entrada automáticamente

#### `FinalizarTurnoModal.tsx`
- Modal para finalizar turno (similar a las capturas)
- Mostrar información del turno actual
- Ingresar fondo final de caja
- Campo de observaciones de cierre
- Registrar hora de salida automáticamente

#### `HistorialTurnos.tsx`
- Tabla con historial de turnos
- Filtros por fecha
- Información de duración, cajas manejadas

### 3. APIs Necesarias

#### `api/turnos/iniciar/route.ts`
```typescript
POST /api/turnos/iniciar
Body: {
  caja_seleccionada: string,
  fondo_inicial: number,
  observaciones?: string
}
```

#### `api/turnos/finalizar/route.ts`
```typescript
PUT /api/turnos/finalizar
Body: {
  tur_id: number,
  fondo_final: number,
  observaciones?: string
}
```

#### `api/turnos/estado/route.ts`
```typescript
GET /api/turnos/estado?emp_id=123
Response: {
  turno_activo?: TurnoActivo,
  historial_hoy: Turno[]
}
```

#### `api/turnos/historial/route.ts`
```typescript
GET /api/turnos/historial?emp_id=123&fecha_desde=2025-01-01&fecha_hasta=2025-01-31
```

## Flujo de Usuario

### Inicio de Turno
1. Empleado accede a `/dashboard/turnos`
2. Si no tiene turno activo, ve botón "Iniciar Turno"
3. Abre modal con:
   - Seleccionar caja disponible
   - Ingresar fondo inicial
   - Observaciones opcionales
4. Al confirmar:
   - Se crea registro en `turnos_empleados`
   - Se crea registro en `cajas_empleados`
   - Se actualiza estado a "activo"

### Durante el Turno
1. Dashboard muestra:
   - Hora de inicio
   - Duración actual (tiempo real)
   - Caja asignada y fondo inicial
   - Botón "Finalizar Turno"

### Fin de Turno
1. Empleado hace clic en "Finalizar Turno"
2. Modal muestra (como en las capturas):
   - Información del turno
   - Caja utilizada
   - Campo para fondo final
   - Observaciones de cierre
3. Al confirmar:
   - Se actualiza hora_salida
   - Se registra fondo_final en caja
   - Estado cambia a "finalizado"

## Integración con Sistema Existente

### Permisos y Roles
- Solo usuarios con rol `'playero'` pueden acceder
- Validar que el empleado esté asignado al estacionamiento
- Usar el sistema de autenticación existente (`useAuth`)

### Navegación
- Agregar nueva opción en el menú lateral: "Gestión de Turnos"
- Ícono sugerido: `Clock` de Lucide React

### Consistencia de Diseño
- Usar componentes UI existentes (`Card`, `Button`, `Input`, etc.)
- Mantener el esquema de colores y tipografía actual
- Responsive design para tablets

## Características Adicionales (Futuras)

### Reportes para Administradores
- Vista de todos los turnos por estacionamiento
- Análisis de diferencias en cajas
- Reporte de horas trabajadas

### Validaciones
- No permitir múltiples turnos activos simultáneos
- Validar que el fondo final sea coherente con las operaciones
- Alertas por diferencias significativas en caja

### Integraciones
- Conectar con sistema de pagos para validar ingresos
- Generar reportes automáticos de cierre de caja
- Notificaciones push para recordar cierre de turno

## Cronograma de Implementación

### Fase 1 (Funcionalidad Básica)
1. Crear tablas en base de datos
2. Implementar APIs básicas
3. Crear página principal y componentes
4. Funcionalidad de inicio/fin de turno

### Fase 2 (Mejoras)
1. Historial y reportes básicos
2. Validaciones avanzadas
3. Integración con sistema de navegación
4. Testing y refinamiento UX

### Fase 3 (Características Avanzadas)
1. Reportes para administradores
2. Análisis de datos de turnos
3. Integraciones con otros módulos
4. Optimizaciones de rendimiento

## Consideraciones Técnicas

### Zona Horaria
- Usar dayjs con timezone de Buenos Aires (consistente con el sistema)
- Almacenar timestamps en UTC, mostrar en hora local

### Validaciones
- Frontend: Validación inmediata de formularios
- Backend: Validación de permisos y reglas de negocio
- Base de datos: Constraints para integridad de datos

### Rendimiento
- Lazy loading para historial extenso
- Optimizaciones para queries de turnos activos
- Caché para datos de cajas disponibles

Este plan proporciona una base sólida para implementar el sistema de turnos y gestión de caja que complementará perfectamente el sistema de estacionamiento existente.