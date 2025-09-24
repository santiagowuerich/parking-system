# PRP: Enhanced Simple Operator Interface

**Feature Goal**: Crear una interfaz de operador simplificada que permita gestión completa de estacionamientos con visualización en tiempo real, entrada/salida de vehículos, movimiento entre plazas, y bloqueo de espacios.

**Deliverable**: Componente de operador mejorado con modales interactivos, API endpoints para gestión de plazas, y sistema de actividades en tiempo real.

**Success Definition**: El operador puede gestionar completamente un estacionamiento desde una sola interfaz intuitiva con todas las funcionalidades mostradas en las imágenes mockup.

---

## Análisis Completo del Proyecto Actual

### Arquitectura Existente Identificada

**Stack Tecnológico:**
- **Frontend**: Next.js 15, React 19, TypeScript 5, TailwindCSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL)
- **Autenticación**: JWT, Supabase Auth con roles (owner/playero)
- **Estado**: Context API + caché multinivel (RAM → IndexedDB → Supabase)
- **UI**: shadcn/ui + Radix UI + Lucide Icons
- **Tiempo Real**: Supabase Realtime con suscripciones por canal

### Componentes Clave Existentes

**1. OperatorPanel (`components/operator-panel.tsx`)** - 780+ líneas
- **Estado actual**: Interfaz funcional completa con visualización de plazas
- **Funcionalidades existentes**:
  - Visualización rica por zonas con tooltips informativos
  - Registro de entrada con selección de plaza y duración
  - Registro de salida con cálculo automático de tarifas
  - Filtrado de vehículos por patente y tipo
  - Sistema híbrido: vista simple vs zonas configuradas
- **Patrones establecidos**:
  ```typescript
  // Selector de plaza con información de plantilla
  <Select value={plaNumero} onValueChange={handlePlazaSelection}>
    {getPlazasLibres().map(plaza => (
      <SelectItem key={plaza.pla_numero} value={String(plaza.pla_numero)}>
        Plaza #{plaza.pla_numero} - {mapearTipoVehiculo(plaza.catv_segmento)}
      </SelectItem>
    ))}
  </Select>

  // Visualización de plazas con tooltips
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={getEstadoColor(plaza.pla_estado)}
             onClick={() => handlePlazaClick(plaza)}>
          {plaza.pla_numero}
        </div>
      </TooltipTrigger>
      <TooltipContent>{/* Plaza details */}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  ```

**2. API Endpoints Existentes**
- **`/api/parking/entry`**: Registro de entrada con validación Zod
- **`/api/parking/log`**: Registro de salida y procesamiento de pagos
- **`/api/plazas/status`**: Estado en tiempo real de plazas (híbrido)
- **`/api/parking/parked`**: Vehículos actualmente estacionados

**3. Sistema de Datos**
```typescript
// Tipos principales establecidos
interface Vehicle {
  license_plate: string
  type: VehicleType // "Auto" | "Moto" | "Camioneta"
  entry_time: string
  plaza_number?: number
  duracion_tipo?: string
  precio_acordado?: number
}

interface PlazaCompleta {
  pla_numero: number
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  pla_zona: string
  catv_segmento: 'AUT' | 'MOT' | 'CAM'
  plantillas?: Plantilla
}
```

### Estado Actual vs Requerimientos de las Imágenes

**✅ Funcionalidades Ya Implementadas (contrario a lo que se creía):**
1. **Visualización de estado en tiempo real** - Totalmente implementada con tooltips informativos
2. **Entrada de vehículos** - Implementada con selección de plaza, duración y precio acordado
3. **Salida de vehículos** - Implementada con cálculo de tarifas y métodos de pago
4. **Interfaz por zonas** - Sistema híbrido funcional con visualización rica
5. **Modal "Ingreso" mejorado** - Ya existe con campos específicos (patente, tipo, duración, precio)
6. **Tabla "Últimos movimientos"** - Historial detallado ya implementado
7. **Gestión de estados** - Estados visuales y filtros ya funcionan
8. **API endpoints robustos** - Entry, log, status, history ya implementados
9. **Base de datos estructurada** - Todas las tablas y relaciones ya existen

**❌ Funcionalidades Realmente Faltantes:**
1. **Modal "Acciones"** con botones contextuales para plazas ocupadas/libres
2. **Modal "Mover vehículo"** con selección de zona destino y tipo de plaza
3. **Endpoint de movimiento** de vehículos entre plazas con logging
4. **Endpoint de gestión de estados** de plazas (bloquear/desbloquear)
5. **Sistema de logging/auditoría** para cambios de estado y movimientos
6. **Transacciones robustas** para operaciones críticas con múltiples tablas

---

## Plan de Implementación Detallado

### Fase 1: Componentes de UI Faltantes

#### 1.1 Modal de Acciones Contextuales (`components/plaza-actions-modal.tsx`)

**Funcionalidad**: Modal que aparece al hacer clic en una plaza con acciones contextuales según el estado
```typescript
interface PlazaActionsModalProps {
  plaza: PlazaCompleta
  vehicle?: Vehicle
  isOpen: boolean
  onClose: () => void
  onIngreso?: () => void
  onEgreso?: () => void
  onMover?: () => void
  onBloquear?: () => void
}

// Implementación basada en Dialog de shadcn/ui
<Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Acciones - Plaza {plaza.pla_numero}</DialogTitle>
      <DialogDescription>
        {vehicle?.license_plate ? `Vehículo: ${vehicle.license_plate}` : 'Plaza Libre'}
      </DialogDescription>
    </DialogHeader>
    <div className="grid grid-cols-2 gap-3">
      {plaza.pla_estado === 'Libre' && onIngreso && (
        <Button onClick={onIngreso} className="bg-green-600">Ingreso</Button>
      )}
      {plaza.pla_estado === 'Ocupada' && onEgreso && (
        <Button onClick={onEgreso} className="bg-blue-600">Egreso</Button>
      )}
      {plaza.pla_estado === 'Ocupada' && onMover && (
        <Button onClick={onMover} className="bg-purple-600">Mover</Button>
      )}
      {onBloquear && (
        <Button onClick={onBloquear} className="bg-gray-600">
          {plaza.pla_estado === 'Mantenimiento' ? 'Desbloquear' : 'Bloquear'}
        </Button>
      )}
    </div>
  </DialogContent>
</Dialog>
```

#### 1.2 Modal de Movimiento de Vehículos (`components/vehicle-movement-modal.tsx`)

**Funcionalidad**: Permite mover vehículo entre plazas con selección inteligente
```typescript
interface VehicleMovementModalProps {
  vehicle: Vehicle
  currentPlaza: PlazaCompleta
  availableZones: ZoneData[]
  plazasDisponibles: PlazaCompleta[]
  isOpen: boolean
  onClose: () => void
  onConfirm: (destino: PlazaCompleta) => Promise<void>
  loading?: boolean
}

// Estados del modal
const [selectedZone, setSelectedZone] = useState<string>("")
const [selectedPlazaType, setSelectedPlazaType] = useState<VehicleType | "">("")
const [availablePlazas, setAvailablePlazas] = useState<PlazaCompleta[]>([])
const [selectedDestination, setSelectedDestination] = useState<PlazaCompleta | null>(null)

// Lógica de filtrado inteligente
const filterPlazasByTypeAndZone = useCallback((zone: string, type: VehicleType) => {
  return plazasDisponibles.filter(plaza =>
    plaza.pla_zona === zone &&
    plaza.catv_segmento === mapTypeToSegment(type) &&
    plaza.pla_estado === 'Libre' &&
    plaza.pla_numero !== currentPlaza.pla_numero // Excluir plaza actual
  )
}, [plazasDisponibles, currentPlaza])
```

> Nota: El modal se integrará con los datos ya existentes en `OperatorPanel` y usará el endpoint de movimiento que crearemos.

### Fase 2: Nuevos API Endpoints

#### 2.1 Endpoint de Movimiento de Vehículos

**Archivo**: `app/api/parking/move/route.ts`
```typescript
// POST /api/parking/move
interface MoveVehicleRequest {
  license_plate: string
  from_plaza: number
  to_plaza: number
  move_time: string
  reason?: string // Opcional: razón del movimiento
}

// Lógica de implementación con transacciones:
// 1. Validar que vehículo existe en plaza origen
// 2. Validar que plaza destino está libre y es compatible
// 3. Iniciar transacción:
//    - Actualizar ocupacion: cambiar pla_numero
//    - Registrar movimiento en vehicle_movements
//    - Registrar cambio en log de actividades
// 4. Commit o rollback según resultado
// 5. Retornar resultado con información del movimiento
```

#### 2.2 Endpoint de Gestión de Estado de Plazas

**Archivo**: `app/api/plazas/[id]/status/route.ts`
```typescript
// PATCH /api/plazas/[id]/status
interface PlazaStatusUpdate {
  pla_estado: 'Libre' | 'Ocupada' | 'Reservada' | 'Mantenimiento'
  razon?: string // Opcional: razón del cambio
}

// Lógica con validación de conflictos:
// 1. Validar que plaza existe y pertenece al estacionamiento
// 2. Verificar permisos del usuario (role: playero)
// 3. Si está ocupada y se intenta bloquear, manejar conflicto
// 4. Actualizar estado en tabla plazas con transacción
// 5. Registrar cambio en plaza_status_changes
// 6. Actualizar ocupaciones si es necesario (desalojar vehículo si se bloquea)
```

#### 2.3 Seguridad y Realtime en Supabase

- Definir políticas RLS para las nuevas tablas de logging
- Conceder únicamente los permisos necesarios a roles de servicio/edge
- Habilitar publicaciones Realtime en las nuevas tablas para el canal existente
- Asegurar que el sistema actual de realtime siga funcionando sin interrupciones

### Fase 3: Mejoras del OperatorPanel Existente

#### 3.1 Integración de Nuevos Modales

**Modificaciones en `components/operator-panel.tsx`:**
```typescript
// Nuevos estados para modales (agregando a los existentes)
const [showActionsModal, setShowActionsModal] = useState(false)
const [showMovementModal, setShowMovementModal] = useState(false)
const [selectedPlazaForActions, setSelectedPlazaForActions] = useState<PlazaCompleta | null>(null)
const [selectedVehicleForMove, setSelectedVehicleForMove] = useState<Vehicle | null>(null)

// Función mejorada de clic en plaza (integrando con sistema existente)
const handlePlazaClick = (plaza: PlazaCompleta) => {
  setSelectedPlazaForActions(plaza)

  if (plaza.pla_estado === 'Ocupada') {
    // Buscar vehículo en esta plaza
    const vehicle = parking.parkedVehicles.find(v => v.plaza_number === plaza.pla_numero)
    if (vehicle) {
      setSelectedVehicleForMove(vehicle)
      setShowActionsModal(true)
    } else {
      toast.error('No se encontró vehículo en esta plaza')
    }
  } else if (plaza.pla_estado === 'Libre') {
    // Usar el sistema de selección existente para ingreso
    handlePlazaSelection(String(plaza.pla_numero))
    toast.success(`Plaza ${plaza.pla_numero} seleccionada para ingreso`)
  } else if (plaza.pla_estado === 'Mantenimiento' || plaza.pla_estado === 'Reservada') {
    setShowActionsModal(true) // Para permitir desbloqueo
  }
}
```

#### 3.2 Mejora del Sistema de Actualización en Tiempo Real

**Extender el sistema de realtime existente:**
```typescript
// Extender la suscripción existente para incluir los nuevos eventos
useEffect(() => {
  const channel = supabase.channel('parking-updates')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'vehicle_movements'
    }, (payload) => {
      console.log('Movimiento de vehículo:', payload)
      fetchPlazasStatus() // Recargar estado de plazas
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'plaza_status_changes'
    }, (payload) => {
      console.log('Cambio de estado de plaza:', payload)
      fetchPlazasStatus() // Recargar estado de plazas
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [estId, fetchPlazasStatus])
```

### Fase 4: Base de Datos - Nuevas Tablas de Logging

#### 4.1 Tabla de Movimientos de Vehículos

```sql
CREATE TABLE vehicle_movements (
  mov_id SERIAL PRIMARY KEY,
  est_id INTEGER REFERENCES estacionamientos(est_id),
  veh_patente VARCHAR(10) REFERENCES vehiculos(veh_patente),
  pla_origen INTEGER,
  pla_destino INTEGER,
  mov_fecha_hora TIMESTAMP DEFAULT NOW(),
  mov_razon TEXT,
  usu_id INTEGER REFERENCES usuarios(usu_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_vehicle_movements_est_id ON vehicle_movements(est_id);
CREATE INDEX idx_vehicle_movements_fecha ON vehicle_movements(mov_fecha_hora);
```

#### 4.2 Tabla de Cambios de Estado de Plazas

```sql
CREATE TABLE plaza_status_changes (
  psc_id SERIAL PRIMARY KEY,
  est_id INTEGER REFERENCES estacionamientos(est_id),
  pla_numero INTEGER,
  psc_estado_anterior VARCHAR(20),
  psc_estado_nuevo VARCHAR(20),
  psc_fecha_hora TIMESTAMP DEFAULT NOW(),
  psc_razon TEXT,
  usu_id INTEGER REFERENCES usuarios(usu_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX idx_plaza_status_changes_est_id ON plaza_status_changes(est_id);
CREATE INDEX idx_plaza_status_changes_fecha ON plaza_status_changes(psc_fecha_hora);
CREATE INDEX idx_plaza_status_changes_plaza ON plaza_status_changes(est_id, pla_numero);
```

#### 4.3 Políticas de Seguridad RLS

```sql
-- Políticas RLS para vehicle_movements
ALTER TABLE vehicle_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movements from their parkings" ON vehicle_movements
  FOR SELECT USING (
    est_id IN (
      SELECT est_id FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert movements for their parkings" ON vehicle_movements
  FOR INSERT WITH CHECK (
    est_id IN (
      SELECT est_id FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
    )
  );

-- Políticas RLS para plaza_status_changes
ALTER TABLE plaza_status_changes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status changes from their parkings" ON plaza_status_changes
  FOR SELECT USING (
    est_id IN (
      SELECT est_id FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert status changes for their parkings" ON plaza_status_changes
  FOR INSERT WITH CHECK (
    est_id IN (
      SELECT est_id FROM empleados_estacionamiento ee
      JOIN playeros p ON ee.play_id = p.play_id
      WHERE p.usu_id = auth.uid()
    )
  );
```

#### 4.4 Publicaciones Realtime

```sql
-- Habilitar realtime para las nuevas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE plaza_status_changes;
```

### Fase 5: Validación y Testing Comprehensivo

#### 5.1 Validación de Sintaxis y Tipos
```bash
# Añadir scripts "typecheck": "tsc --noEmit" y "test": "vitest run" (o la herramienta elegida) en package.json antes de ejecutar los comandos
npm run lint
npm run typecheck
npm run build

# Validación específica por componente
npx tsc --noEmit components/plaza-actions-modal.tsx
npx tsc --noEmit components/vehicle-movement-modal.tsx
npx tsc --noEmit app/api/parking/move/route.ts
```

#### 5.2 Testing de Componentes
```bash
# Tests unitarios para nuevos componentes (requiere script npm run test configurado previamente)
npm run test -- components/plaza-actions-modal.test.tsx
npm run test -- components/vehicle-movement-modal.test.tsx
npm run test -- components/enhanced-entry-modal.test.tsx

# Test de integración de OperatorPanel mejorado
npm run test -- components/operator-panel.test.tsx
```

#### 5.3 Testing de API Endpoints
```bash
# Test del endpoint de movimiento
curl -X POST http://localhost:3000/api/parking/move \
  -H "Content-Type: application/json" \
  -d '{
    "license_plate": "ABC123",
    "from_plaza": 5,
    "to_plaza": 10,
    "move_time": "2025-01-19T10:30:00Z"
  }'

# Test del endpoint de estado de plaza
curl -X PATCH http://localhost:3000/api/plazas/5/status \
  -H "Content-Type: application/json" \
  -d '{
    "pla_estado": "Mantenimiento",
    "razon": "Limpieza programada"
  }'

# Test del endpoint de movimientos
curl "http://localhost:3000/api/parking/movements?est_id=1&limit=10" | jq .
```

#### 5.4 Testing de Flujos de Usuario Completos
```bash
# Iniciar servidor de desarrollo
npm run dev

# Test manual de flujos:
# 1. Clic en plaza libre → Modal de ingreso mejorado
# 2. Registro de entrada → Actualización en tiempo real
# 3. Clic en plaza ocupada → Modal de acciones
# 4. Movimiento de vehículo → Actualización de ambas plazas
# 5. Bloqueo de plaza → Cambio de estado visual
# 6. Verificación de tabla de últimos movimientos
```

---

## Estimación de Implementación

### Breakdown de Tareas por Tiempo

**Fase 1 - Componentes UI (4-6 horas):**
- PlazaActionsModal: 2 horas (modal contextual con acciones según estado)
- VehicleMovementModal: 2-3 horas (modal de movimiento con filtros inteligentes)
- Integración con OperatorPanel: 1 hora (agregar handlers y estados)

**Fase 2 - API Endpoints (8-10 horas):**
- Endpoint de movimiento: 3-4 horas (con transacciones y logging)
- Endpoint de gestión de estados: 3-4 horas (con validación de conflictos)
- Configuración de seguridad RLS: 2 horas (políticas y permisos)

**Fase 3 - Integración y Testing (4-6 horas):**
- Integración de modales en OperatorPanel: 2 horas
- Extensión del sistema de realtime: 1-2 horas
- Testing de funcionalidades nuevas: 2 horas

**Fase 4 - Base de Datos (2-3 horas):**
- Migraciones de nuevas tablas: 1 hora
- Índices y optimizaciones: 1 hora
- Configuración de realtime: 1 hora

**Total Estimado: 18-25 horas de desarrollo**

> **Nota**: Las estimaciones son más bajas porque muchas funcionalidades ya existen. El enfoque es en integrar nuevas capacidades con el sistema existente.

---

## Consideraciones Técnicas Críticas

### 1. Concurrencia y Transacciones
```typescript
// Validación de estado antes de operaciones críticas
const validatePlazaState = async (plazaId: number, expectedState: string) => {
  const { data: currentPlaza } = await supabase
    .from('plazas')
    .select('pla_estado')
    .eq('pla_numero', plazaId)
    .single()

  if (currentPlaza?.pla_estado !== expectedState) {
    throw new Error(`Plaza ${plazaId} cambió de estado: ${currentPlaza?.pla_estado}`)
  }
}

// Operación con transacción para movimiento de vehículo
const moveVehicleTransaction = async (vehicle: Vehicle, fromPlaza: number, toPlaza: number) => {
  const { data, error } = await supabase.rpc('move_vehicle_with_logging', {
    license_plate: vehicle.license_plate,
    from_plaza: fromPlaza,
    to_plaza: toPlaza,
    user_id: user.id
  })

  if (error) throw error
  return data
}
```

### 2. Manejo de Errores y Estados de Carga
```typescript
// Estados de carga para operaciones asíncronas
const [moveLoading, setMoveLoading] = useState(false)
const [statusChangeLoading, setStatusChangeLoading] = useState(false)

// Función con manejo robusto de errores
const handleMoveVehicle = async (vehicle: Vehicle, destination: PlazaCompleta) => {
  setMoveLoading(true)
  try {
    await moveVehicleTransaction(vehicle, vehicle.plaza_number!, destination.pla_numero)
    toast.success(`Vehículo ${vehicle.license_plate} movido a plaza ${destination.pla_numero}`)
    onClose() // Cerrar modal
  } catch (error) {
    console.error('Error moviendo vehículo:', error)
    toast.error('Error al mover vehículo. Intenta nuevamente.')
  } finally {
    setMoveLoading(false)
  }
}
```

### 3. Integración con Sistema Existente
```typescript
// Extender la función de clic existente en OperatorPanel
const handlePlazaClick = useCallback((plaza: PlazaCompleta) => {
  // Buscar vehículo si la plaza está ocupada
  const vehicle = parking.parkedVehicles.find(v => v.plaza_number === plaza.pla_numero)

  if (plaza.pla_estado === 'Ocupada' && vehicle) {
    setSelectedVehicle(vehicle)
    setSelectedPlaza(plaza)
    setShowActionsModal(true)
  } else if (plaza.pla_estado === 'Libre') {
    // Usar el sistema de selección existente
    handlePlazaSelection(String(plaza.pla_numero))
  } else {
    // Plaza en mantenimiento o reservada
    setSelectedPlaza(plaza)
    setShowActionsModal(true)
  }
}, [parking.parkedVehicles, handlePlazaSelection])
```

---

## Criterios de Éxito Final

### Funcionalidades Obligatorias
- [ ] Modal de acciones contextuales según estado de plaza
- [ ] Modal de movimiento de vehículos con filtros inteligentes
- [ ] Endpoint de movimiento con transacciones y logging
- [ ] Endpoint de gestión de estados con validación de conflictos
- [ ] Sistema de logging de cambios de estado y movimientos
- [ ] Integración seamless con el sistema existente

### Criterios de Performance
- [ ] Carga inicial < 2 segundos (mantener performance actual)
- [ ] Operaciones de movimiento < 3 segundos
- [ ] Actualizaciones en tiempo real < 500ms (extender sistema existente)
- [ ] Sin degradación con 100+ plazas

### Criterios de UX
- [ ] Acciones contextuales intuitivas al hacer clic en plazas
- [ ] Feedback inmediato para todas las operaciones nuevas
- [ ] Manejo graceful de errores con mensajes claros
- [ ] Integración natural con el flujo de trabajo existente
- [ ] Responsivo en tablets (operadores móviles)

### Criterios Técnicos
- [ ] Zero errores de TypeScript
- [ ] Código siguiendo convenciones existentes
- [ ] Transacciones robustas para operaciones críticas
- [ ] Políticas RLS correctamente implementadas
- [ ] Performance sin regresiones del sistema existente

**Confidence Score: 9.0/10** - Plan realista basado en análisis del código existente, enfocándose en mejoras incrementales sin reinventar funcionalidades ya implementadas.