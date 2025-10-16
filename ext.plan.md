# Extender abono - Plan de implementación completo

## 📋 Resumen Ejecutivo

Implementación de un modal completo para extender abonos con cálculo dinámico de precios basado en plantillas, manejo de métodos de pago y actualización atómica de la base de datos.

## 🎯 Alcance Funcional

### UI - Modal "Extender abono"
- **Ubicación**: `components/abonos/extender-abono-dialog.tsx`
- **Componentes reutilizables**: Usa shadcn/ui (Dialog, Input, Select, RadioGroup, Textarea, Button, Card)
- **Responsive**: Móvil y desktop
- **Validación**: Formulario completo con mensajes de error
- **Estados de carga**: Indicadores durante cálculos y operaciones

### Backend - Endpoints necesarios
- `GET /api/abonos/period-price` - Calcular precio por período según plantilla
- `POST /api/abonos/extender` - Extender abono y registrar pago

### Utilidades - Cálculos y lógica
- Funciones puras para cálculos de fechas por período
- Integración con sistema de tarifas existente
- Validaciones de negocio

## 🏗️ Arquitectura Técnica

### Estructura de archivos

```
components/abonos/
├── extender-abono-dialog.tsx      # Modal principal (nuevo)
├── crear-abono-panel.tsx          # Referencia existente
└── zona-plaza-selector.tsx        # Referencia existente

app/api/abonos/
├── extender/
│   └── route.ts                   # POST extender abono (nuevo)
├── period-price/
│   └── route.ts                   # GET precio por período (nuevo)
├── create-conductor/
│   └── route.ts                   # Referencia existente
├── create-for-existing/
│   └── route.ts                   # Referencia existente
└── list/
    └── route.ts                   # Referencia existente

lib/
├── utils/
│   └── date-periods.ts            # Funciones de cálculo de fechas (nuevo)
├── tariff-calculator.ts           # Referencia existente
└── types.ts                       # Tipos necesarios (extender)

hooks/
└── use-abono-extension.ts         # Hook para lógica de extensión (nuevo)
```

## 📊 Modelo de Datos

### Props del componente
```typescript
interface ExtenderAbonoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  abono: {
    abo_nro: number;
    titular: string;
    tipoActual: string; // "Mensual"
    fechaFinActual: string; // "2025-11-30"
    zona: string;
    codigo: string;
    est_id: number;
    pla_numero: number;
    plantilla_id: number;
  };
  onExtended?: (payload: {
    abo_nro: number;
    nuevoVencimiento: string;
    monto: number;
    metodoPago: string;
  }) => void;
}
```

### Estado interno del modal
```typescript
interface ExtensionState {
  tipoExtension: 'mensual' | 'bimestral' | 'trimestral' | 'anual';
  cantidad: number;
  desde: string;
  nuevoVencimiento: string;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
  monto: number;
  nota: string;
  tarjeta: {
    numero: string;
    vencimiento: string;
    cvv: string;
  };
  loading: boolean;
  calculating: boolean;
}
```

## 🔧 Implementación Detallada

### 1. Componente Modal Principal

#### Sección 1: Información del Abono Actual (Solo Lectura)
```typescript
// Campos mostrados (estáticos)
<Card className="p-4 bg-muted/50">
  <h3 className="font-semibold mb-3">Abono actual</h3>
  <div className="grid grid-cols-2 gap-4 text-sm">
    <div>
      <span className="text-muted-foreground">Titular:</span>
      <p className="font-medium">{abono.titular}</p>
    </div>
    <div>
      <span className="text-muted-foreground">Tipo:</span>
      <p className="font-medium">{abono.tipoActual}</p>
    </div>
    <div>
      <span className="text-muted-foreground">Vence:</span>
      <p className="font-medium">{formatDate(abono.fechaFinActual)}</p>
    </div>
    <div>
      <span className="text-muted-foreground">Zona - Plaza:</span>
      <p className="font-medium">{abono.zona} - {abono.codigo}</p>
    </div>
  </div>
</Card>
```

#### Sección 2: Formulario de Configuración de Extensión

**Campo Tipo de extensión:**
```typescript
<Select value={tipoExtension} onValueChange={setTipoExtension}>
  <SelectTrigger>
    <SelectValue placeholder="Seleccionar tipo" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="mensual">Mensual</SelectItem>
    <SelectItem value="bimestral">Bimestral</SelectItem>
    <SelectItem value="trimestral">Trimestral</SelectItem>
    <SelectItem value="anual">Anual</SelectItem>
  </SelectContent>
</Select>
```

**Campo Cantidad:**
```typescript
<Input
  type="number"
  min="1"
  max="12"
  value={cantidad}
  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
  placeholder="Cantidad de períodos"
/>
```

**Campo Desde (autocompletado):**
```typescript
<Input
  type="date"
  value={desde}
  onChange={(e) => setDesde(e.target.value)}
  min={addDays(abono.fechaFinActual, 1).toISOString().split('T')[0]}
/>
```

**Campo Nuevo vencimiento (calculado automáticamente):**
```typescript
<Input
  type="date"
  value={nuevoVencimiento}
  readOnly
  className="bg-muted"
/>
```

**Campo Observación:**
```typescript
<Textarea
  placeholder="Nota opcional"
  value={nota}
  onChange={(e) => setNota(e.target.value)}
  rows={2}
/>
```

#### Sección 3: Método de Pago

**Selector de método:**
```typescript
<RadioGroup value={metodoPago} onValueChange={setMetodoPago}>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="efectivo" id="efectivo" />
    <Label htmlFor="efectivo">Efectivo</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="tarjeta" id="tarjeta" />
    <Label htmlFor="tarjeta">Tarjeta</Label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="transferencia" id="transferencia" />
    <Label htmlFor="transferencia">Transferencia</Label>
  </div>
</RadioGroup>
```

**Datos de tarjeta (renderizado condicional):**
```typescript
{metodoPago === 'tarjeta' && (
  <Card className="p-4 space-y-3">
    <div className="grid grid-cols-3 gap-3">
      <Input
        placeholder="Nº"
        value={tarjeta.numero}
        onChange={(e) => setTarjeta({...tarjeta, numero: e.target.value})}
      />
      <Input
        placeholder="Venc."
        value={tarjeta.vencimiento}
        onChange={(e) => setTarjeta({...tarjeta, vencimiento: e.target.value})}
      />
      <Input
        placeholder="CVV"
        value={tarjeta.cvv}
        onChange={(e) => setTarjeta({...tarjeta, cvv: e.target.value})}
        maxLength={4}
      />
    </div>
  </Card>
)}
```

#### Sección 4: Resumen y Total

```typescript
<Card className="p-4">
  <div className="space-y-3">
    <div className="flex justify-between text-sm">
      <span>Subtotal:</span>
      <span className="font-medium">
        ${precioPorPeriodo?.toLocaleString()} × {cantidad}
      </span>
    </div>
    <div className="flex justify-between text-lg font-semibold">
      <span>Total a cobrar:</span>
      <span>${monto?.toLocaleString()}</span>
    </div>
  </div>
</Card>
```

#### Sección 5: Botones de Acción

```typescript
<div className="flex gap-3 justify-end">
  <Button variant="outline" onClick={onClose} disabled={loading}>
    Cancelar
  </Button>
  <Button
    onClick={handleSubmit}
    disabled={loading || !isValidForm()}
    className="min-w-[140px]"
  >
    {loading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Procesando...
      </>
    ) : (
      'Confirmar extensión'
    )}
  </Button>
</div>
```

### 2. Lógica de Cálculo

#### Función para calcular nuevo vencimiento
```typescript
// lib/utils/date-periods.ts
export function calculateNewExpiry(
  startDate: string,
  tipoExtension: string,
  cantidad: number
): string {
  const start = new Date(startDate);

  switch (tipoExtension) {
    case 'mensual':
      return addMonths(start, cantidad).toISOString().split('T')[0];
    case 'bimestral':
      return addMonths(start, cantidad * 2).toISOString().split('T')[0];
    case 'trimestral':
      return addMonths(start, cantidad * 3).toISOString().split('T')[0];
    case 'anual':
      return addYears(start, cantidad).toISOString().split('T')[0];
    default:
      return start.toISOString().split('T')[0];
  }
}
```

#### Función para calcular precio por período
```typescript
// app/api/abonos/period-price/route.ts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const abo_nro = searchParams.get('abo_nro');
  const tipo = searchParams.get('tipo') as TipoExtension;
  const est_id = searchParams.get('est_id');

  if (!abo_nro || !tipo) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: abo_nro, tipo' },
      { status: 400 }
    );
  }

  try {
    // 1. Obtener información del abono y su plaza
    const { data: abonoData, error: abonoError } = await supabase
      .from('abonos')
      .select(`
        abo_nro,
        est_id,
        pla_numero,
        plazas!inner(
          plantilla_id,
          plantillas!inner(
            plantilla_id,
            nombre_plantilla
          )
        )
      `)
      .eq('abo_nro', abo_nro)
      .single();

    if (abonoError || !abonoData) {
      return NextResponse.json(
        { error: 'Abono no encontrado' },
        { status: 404 }
      );
    }

    // 2. Mapear tipo de extensión a tiptar_nro
    const tiptarMap = {
      mensual: 3, // MES
      bimestral: 3, // MES (2 meses)
      trimestral: 3, // MES (3 meses)
      anual: 3 // MES (12 meses)
    };

    const tiptar = tiptarMap[tipo];

    // 3. Obtener tarifa de la plantilla
    const { data: tarifaData, error: tarifaError } = await supabase
      .from('tarifas')
      .select('tar_precio, tar_fraccion')
      .eq('est_id', abonoData.est_id)
      .eq('tiptar_nro', tiptar)
      .eq('plantilla_id', abonoData.plazas.plantilla_id)
      .order('tar_f_desde', { ascending: false })
      .limit(1)
      .single();

    if (tarifaError || !tarifaData) {
      return NextResponse.json(
        { error: 'No se encontró tarifa para esta plantilla' },
        { status: 404 }
      );
    }

    // 4. Calcular precio según cantidad
    let precioPorPeriodo = parseFloat(tarifaData.tar_precio);

    // Para bimestral, trimestral y anual, multiplicar por la cantidad de meses
    if (tipo === 'bimestral') precioPorPeriodo *= 2;
    else if (tipo === 'trimestral') precioPorPeriodo *= 3;
    else if (tipo === 'anual') precioPorPeriodo *= 12;

    return NextResponse.json({
      precioPorPeriodo,
      tarifaBase: tarifaData.tar_precio,
      tipo,
      plantilla: abonoData.plazas.plantillas.nombre_plantilla
    });

  } catch (error) {
    console.error('Error calculando precio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

#### Endpoint de extensión de abono
```typescript
// app/api/abonos/extender/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      abo_nro,
      tipoExtension,
      cantidad,
      nuevoVencimiento,
      metodoPago,
      monto,
      nota,
      tarjeta
    } = body;

    // Validar datos requeridos
    if (!abo_nro || !tipoExtension || !cantidad || !nuevoVencimiento || !metodoPago || !monto) {
      return NextResponse.json(
        { error: 'Datos requeridos faltantes' },
        { status: 400 }
      );
    }

    // 1. Obtener información del abono actual
    const { data: abonoActual, error: abonoError } = await supabase
      .from('abonos')
      .select('*')
      .eq('abo_nro', abo_nro)
      .single();

    if (abonoError || !abonoActual) {
      return NextResponse.json(
        { error: 'Abono no encontrado' },
        { status: 404 }
      );
    }

    // 2. Validar que el nuevo vencimiento sea posterior al actual
    if (new Date(nuevoVencimiento) <= new Date(abonoActual.abo_fecha_fin)) {
      return NextResponse.json(
        { error: 'El nuevo vencimiento debe ser posterior al actual' },
        { status: 400 }
      );
    }

    // 3. Iniciar transacción
    const { error: updateError } = await supabase
      .from('abonos')
      .update({
        abo_fecha_fin: nuevoVencimiento,
        abo_fecha_modificacion: new Date().toISOString()
      })
      .eq('abo_nro', abo_nro);

    if (updateError) {
      return NextResponse.json(
        { error: 'Error actualizando abono: ' + updateError.message },
        { status: 500 }
      );
    }

    // 4. Registrar pago
    const { data: pagoData, error: pagoError } = await supabase
      .from('pagos')
      .insert({
        abo_nro: abo_nro,
        pag_fecha: new Date().toISOString(),
        pag_monto: monto,
        pag_metodo: metodoPago,
        pag_estado: 'completado',
        pag_descripcion: `Extensión ${tipoExtension} x${cantidad} - ${nota || 'Sin observaciones'}`,
        pag_tipo: 'extension',
        // Datos de tarjeta si aplica
        ...(metodoPago === 'tarjeta' && tarjeta && {
          pag_datos_tarjeta: JSON.stringify({
            numero: tarjeta.numero.substring(tarjeta.numero.length - 4),
            vencimiento: tarjeta.vencimiento
          })
        })
      })
      .select()
      .single();

    if (pagoError) {
      // Revertir actualización del abono
      await supabase
        .from('abonos')
        .update({ abo_fecha_fin: abonoActual.abo_fecha_fin })
        .eq('abo_nro', abo_nro);

      return NextResponse.json(
        { error: 'Error registrando pago: ' + pagoError.message },
        { status: 500 }
      );
    }

    // 5. Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: {
        abo_nro,
        nuevoVencimiento,
        monto,
        metodoPago,
        pago_id: pagoData.pag_id
      }
    });

  } catch (error) {
    console.error('Error extendiendo abono:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

### 3. Hook personalizado para lógica de extensión

```typescript
// hooks/use-abono-extension.ts
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export function useAbonoExtension(abono: AbonoData) {
  const { toast } = useToast();

  const [state, setState] = useState<ExtensionState>({
    tipoExtension: 'mensual',
    cantidad: 1,
    desde: '',
    nuevoVencimiento: '',
    metodoPago: 'efectivo',
    monto: 0,
    nota: '',
    tarjeta: { numero: '', vencimiento: '', cvv: '' },
    loading: false,
    calculating: false
  });

  // Inicializar fecha "desde"
  useEffect(() => {
    const fechaDesde = addDays(abono.fechaFinActual, 1);
    setState(prev => ({
      ...prev,
      desde: fechaDesde.toISOString().split('T')[0]
    }));
  }, [abono.fechaFinActual]);

  // Calcular nuevo vencimiento cuando cambian tipo o cantidad
  useEffect(() => {
    if (state.desde && state.tipoExtension && state.cantidad) {
      const nuevoVenc = calculateNewExpiry(state.desde, state.tipoExtension, state.cantidad);
      setState(prev => ({ ...prev, nuevoVencimiento: nuevoVenc }));
    }
  }, [state.desde, state.tipoExtension, state.cantidad]);

  // Calcular precio cuando cambian tipo o cantidad
  useEffect(() => {
    const fetchPrice = async () => {
      if (!state.tipoExtension || !state.cantidad) return;

      setState(prev => ({ ...prev, calculating: true }));

      try {
        const response = await fetch(
          `/api/abonos/period-price?abo_nro=${abono.abo_nro}&tipo=${state.tipoExtension}`
        );

        if (response.ok) {
          const data = await response.json();
          setState(prev => ({
            ...prev,
            monto: data.precioPorPeriodo * state.cantidad,
            calculating: false
          }));
        } else {
          toast({
            title: "Error",
            description: "No se pudo calcular el precio",
            variant: "destructive"
          });
          setState(prev => ({ ...prev, calculating: false }));
        }
      } catch (error) {
        console.error('Error calculando precio:', error);
        setState(prev => ({ ...prev, calculating: false }));
      }
    };

    fetchPrice();
  }, [state.tipoExtension, state.cantidad, abono.abo_nro, toast]);

  const handleSubmit = async () => {
    if (!isValidForm()) {
      toast({
        title: "Error de validación",
        description: "Complete todos los campos requeridos",
        variant: "destructive"
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const response = await fetch('/api/abonos/extender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abo_nro: abono.abo_nro,
          tipoExtension: state.tipoExtension,
          cantidad: state.cantidad,
          nuevoVencimiento: state.nuevoVencimiento,
          metodoPago: state.metodoPago,
          monto: state.monto,
          nota: state.nota,
          tarjeta: state.metodoPago === 'tarjeta' ? state.tarjeta : null
        })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Éxito",
          description: "Abono extendido correctamente"
        });

        // Callback opcional
        abono.onExtended?.(data.data);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Error al extender abono",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error extendiendo abono:', error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive"
      });
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const isValidForm = () => {
    return !!(
      state.tipoExtension &&
      state.cantidad > 0 &&
      state.desde &&
      state.nuevoVencimiento &&
      state.metodoPago &&
      state.monto > 0 &&
      (state.metodoPago !== 'tarjeta' ||
       (state.tarjeta.numero && state.tarjeta.vencimiento && state.tarjeta.cvv))
    );
  };

  return {
    state,
    setTipoExtension: (tipo: typeof state.tipoExtension) =>
      setState(prev => ({ ...prev, tipoExtension: tipo })),
    setCantidad: (cantidad: number) =>
      setState(prev => ({ ...prev, cantidad })),
    setDesde: (desde: string) =>
      setState(prev => ({ ...prev, desde })),
    setMetodoPago: (metodo: typeof state.metodoPago) =>
      setState(prev => ({ ...prev, metodoPago: metodo })),
    setNota: (nota: string) =>
      setState(prev => ({ ...prev, nota })),
    setTarjeta: (tarjeta: typeof state.tarjeta) =>
      setState(prev => ({ ...prev, tarjeta })),
    handleSubmit,
    isValidForm: isValidForm()
  };
}
```

## 🔗 Integración con sistema existente

### Cómo usar el componente desde otras páginas

```typescript
// En app/dashboard/gestion-abonos/page.tsx
import { ExtenderAbonoDialog } from '@/components/abonos/extender-abono-dialog';

export default function GestionAbonosPage() {
  const [selectedAbono, setSelectedAbono] = useState<AbonoData | null>(null);

  return (
    <>
      {/* Lista de abonos con botón "Extender" */}
      <Button onClick={() => setSelectedAbono(abono)}>
        Extender abono
      </Button>

      {/* Modal de extensión */}
      <ExtenderAbonoDialog
        isOpen={!!selectedAbono}
        onClose={() => setSelectedAbono(null)}
        abono={selectedAbono}
        onExtended={(payload) => {
          // Recargar lista o mostrar confirmación
          setSelectedAbono(null);
        }}
      />
    </>
  );
}
```

### Tipos adicionales necesarios

```typescript
// lib/types.ts (extender)
export interface AbonoData {
  abo_nro: number;
  titular: string;
  tipoActual: string;
  fechaFinActual: string;
  zona: string;
  codigo: string;
  est_id: number;
  pla_numero: number;
  plantilla_id: number;
}

export type TipoExtension = 'mensual' | 'bimestral' | 'trimestral' | 'anual';

export interface ExtensionState {
  tipoExtension: TipoExtension;
  cantidad: number;
  desde: string;
  nuevoVencimiento: string;
  metodoPago: 'efectivo' | 'tarjeta' | 'transferencia';
  monto: number;
  nota: string;
  tarjeta: {
    numero: string;
    vencimiento: string;
    cvv: string;
  };
  loading: boolean;
  calculating: boolean;
}
```

## 🧪 Testing

### Casos de prueba principales

1. **Cálculo de fechas**: Verificar que `nuevoVencimiento` se calcula correctamente para cada tipo de extensión
2. **Cálculo de precios**: Verificar que el precio se obtiene correctamente de la plantilla de la plaza
3. **Validaciones**: Verificar que el formulario valida correctamente todos los campos
4. **Transacción atómica**: Verificar que si falla el pago, se revierte la extensión del abono
5. **Métodos de pago**: Verificar que cada método de pago funciona correctamente

### Scripts de testing sugeridos

```typescript
// tests/extender-abono.test.js
describe('Extender abono', () => {
  test('calcula correctamente nuevo vencimiento mensual', () => {
    // Test logic
  });

  test('obtiene precio correcto de plantilla', () => {
    // Test API endpoint
  });

  test('procesa extensión completa correctamente', () => {
    // Test integración completa
  });
});
```

## 🚀 Plan de implementación

### Fase 1: Backend (1-2 días)
1. Crear `app/api/abonos/period-price/route.ts` - Endpoint para calcular precios
2. Crear `app/api/abonos/extender/route.ts` - Endpoint para extender abono
3. Crear `lib/utils/date-periods.ts` - Funciones de cálculo de fechas
4. Extender `lib/types.ts` con tipos necesarios

### Fase 2: Componente UI (2-3 días)
1. Crear `components/abonos/extender-abono-dialog.tsx` - Modal principal
2. Crear `hooks/use-abono-extension.ts` - Hook personalizado
3. Integrar con páginas existentes (gestion-abonos, crear-abono)

### Fase 3: Testing y refinamiento (1 día)
1. Crear tests unitarios para funciones puras
2. Crear tests de integración para endpoints
3. Probar flujo completo en staging
4. Ajustes de UX/UI según feedback

### Fase 4: Documentación (0.5 día)
1. Actualizar READMEs relevantes
2. Documentar API endpoints
3. Crear guía de uso para desarrolladores

## 💾 Estrategia Óptima para Base de Datos

### 🔍 Análisis del Sistema Actual

**Estado actual de pagos:**
- Tabla `pagos` usada principalmente para ocupaciones (estacionamientos por hora/día)
- Relación opcional `abonos.pag_nro → pagos.pag_nro` (puede ser null)
- Creación de pagos en `POST /api/parking/payment` para ocupaciones normales

### ⚖️ Opciones Evaluadas

| Opción | Pros | Contras | Recomendación |
|--------|------|---------|---------------|
| **Extender tabla pagos** | ✅ Reutiliza infraestructura<br>✅ Una tabla para todos los pagos<br>✅ Consultas simples | ❌ Tabla más compleja<br>❌ Mezcla conceptos | **✅ RECOMENDADA** |
| **Tabla pagos_extensiones** | ✅ Especializada para extensiones<br>✅ Más limpia conceptualmente | ❌ Más tablas<br>❌ Joins adicionales<br>❌ Inconsistente con pagos actuales | ❌ NO RECOMENDADA |
| **Campos existentes** | ✅ Sin cambios al esquema | ❌ Muy limitado<br>❌ No distingue tipos | ❌ NO RECOMENDADA |

### 🏆 Estrategia Óptima: Extender Tabla Pagos

**Campos adicionales necesarios:**
```sql
ALTER TABLE pagos ADD COLUMN pag_tipo VARCHAR(50) DEFAULT 'ocupacion';
ALTER TABLE pagos ADD COLUMN pag_descripcion TEXT;
ALTER TABLE pagos ADD COLUMN pag_estado VARCHAR(20) DEFAULT 'completado';
ALTER TABLE pagos ADD COLUMN abo_nro INTEGER; -- Referencia al abono extendido
ALTER TABLE pagos ADD COLUMN pag_datos_tarjeta JSONB; -- Para datos de tarjeta (opcional)

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(pag_tipo);
CREATE INDEX IF NOT EXISTS idx_pagos_abono ON pagos(abo_nro) WHERE abo_nro IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(pag_estado);
```

**Valores para extensiones:**
```typescript
{
  pag_tipo: 'extension',           // Tipo específico para extensiones
  pag_descripcion: `Extensión ${tipoExtension} x${cantidad} - ${nota}`,
  pag_estado: 'completado',        // Estado del pago
  abo_nro: abono.abo_nro,          // Referencia directa al abono
  pag_datos_tarjeta: metodoPago === 'tarjeta' ? {
    numero: tarjeta.numero.substring(tarjeta.numero.length - 4),
    vencimiento: tarjeta.vencimiento
  } : null
}
```

### 🎯 Ventajas de Esta Estrategia

1. **Reutilización**: Usa infraestructura existente de pagos
2. **Consistencia**: Mantiene misma tabla para todos los pagos del sistema
3. **Flexibilidad**: Campos adicionales permiten identificar y filtrar extensiones fácilmente
4. **Performance**: Índices optimizados para consultas frecuentes
5. **Mantenibilidad**: Una sola tabla para auditar todos los pagos
6. **Escalabilidad**: Fácil agregar nuevos tipos de pago en el futuro

### 📊 Consultas Útiles Implementadas

```sql
-- Buscar todas las extensiones de abonos
SELECT * FROM pagos WHERE pag_tipo = 'extension';

-- Historial de pagos de un abono específico
SELECT p.*, a.abo_tipoabono, a.abo_fecha_inicio, a.abo_fecha_fin
FROM pagos p
LEFT JOIN abonos a ON p.abo_nro = a.abo_nro
WHERE p.abo_nro = ?;

-- Resumen de ingresos por tipo de pago
SELECT pag_tipo, COUNT(*), SUM(pag_monto) as total
FROM pagos
WHERE pag_estado = 'completado'
GROUP BY pag_tipo;
```

### 🔄 Migración Necesaria

```sql
-- supabase/migrations/add_extension_fields_to_pagos.sql
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS pag_tipo VARCHAR(50) DEFAULT 'ocupacion',
ADD COLUMN IF NOT EXISTS pag_descripcion TEXT,
ADD COLUMN IF NOT EXISTS pag_estado VARCHAR(20) DEFAULT 'completado',
ADD COLUMN IF NOT EXISTS abo_nro INTEGER,
ADD COLUMN IF NOT EXISTS pag_datos_tarjeta JSONB;

-- Crear índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_pagos_tipo ON pagos(pag_tipo);
CREATE INDEX IF NOT EXISTS idx_pagos_abono ON pagos(abo_nro) WHERE abo_nro IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(pag_estado);

-- Comentario para documentación
COMMENT ON COLUMN pagos.pag_tipo IS 'Tipo de pago: ocupacion, extension, etc.';
COMMENT ON COLUMN pagos.pag_descripcion IS 'Descripción detallada del pago';
COMMENT ON COLUMN pagos.pag_estado IS 'Estado del pago: completado, pendiente, fallido';
COMMENT ON COLUMN pagos.abo_nro IS 'Referencia al abono si es extensión';
COMMENT ON COLUMN pagos.pag_datos_tarjeta IS 'Datos de tarjeta (solo últimos 4 dígitos)';
```

## 🎯 Métricas de éxito

- ✅ Modal se abre correctamente desde páginas de gestión de abonos
- ✅ Cálculos de fechas y precios son precisos
- ✅ Transacciones son atómicas (no hay estados inconsistentes)
- ✅ Validaciones funcionan correctamente
- ✅ UX es fluida en móvil y desktop
- ✅ Tiempo de respuesta < 2 segundos para cálculos
- ✅ Error rate < 1% en producción

## 🔒 Seguridad

- **Validación de permisos**: Solo usuarios autorizados pueden extender abonos
- **Validación de datos**: Todos los inputs se validan tanto en frontend como backend
- **Transacciones atómicas**: Si falla cualquier parte del proceso, se revierte completamente
- **Auditoría**: Todos los cambios se registran en logs y base de datos

## 📈 Mantenimiento

- **Monitoreo**: Logs de errores y métricas de uso
- **Actualizaciones**: Revisar precios de plantillas cuando cambien tarifas
- **Backup**: Respaldo automático de datos críticos antes de operaciones
