# Plan de Implementación: Selector de Vehículo en Dashboard del Conductor

## 📋 Objetivo

Permitir que el conductor seleccione un vehículo en su dashboard y mostrar el vehículo seleccionado de forma persistente. Esto servirá para posteriormente buscar estacionamientos según el tipo de vehículo seleccionado.

---

## 🎯 Requerimientos Funcionales

### **RF1: Selector de Vehículo**
- El conductor puede ver una lista de sus vehículos registrados
- Puede seleccionar uno como "vehículo activo"
- La selección debe persistir entre sesiones (localStorage + base de datos)

### **RF2: Visualización del Vehículo Seleccionado**
- Mostrar el vehículo seleccionado en el header del dashboard
- Mostrar información básica: patente, tipo, marca/modelo
- Indicador visual claro del vehículo activo

### **RF3: Integración con Búsqueda**
- El filtro de búsqueda de estacionamientos debe usar automáticamente el tipo del vehículo seleccionado
- Permitir override manual del filtro si el conductor lo desea

---

## 🏗️ Arquitectura de la Solución

### **Componentes a Crear/Modificar**

```
parking-system/
├── components/
│   ├── vehicle-selector.tsx          [NUEVO] - Selector de vehículo
│   └── vehicle-display.tsx            [NUEVO] - Mostrar vehículo seleccionado
├── lib/
│   ├── contexts/
│   │   └── vehicle-context.tsx        [NUEVO] - Context para vehículo activo
│   └── hooks/
│       └── use-selected-vehicle.ts    [NUEVO] - Hook para manejar vehículo
├── app/
│   ├── conductor/
│   │   ├── page.tsx                   [MODIFICAR] - Integrar selector
│   │   └── vehiculos/
│   │       └── page.tsx               [MODIFICAR] - Agregar selección
│   └── api/
│       └── conductor/
│           ├── vehicles/route.ts      [EXISTENTE] - Ya existe
│           └── select-vehicle/
│               └── route.ts           [NUEVO] - Guardar selección en BD
└── supabase/
    └── migrations/
        └── YYYYMMDDHHMMSS_add_selected_vehicle.sql  [NUEVO]
```

---

## 📝 Plan de Implementación Detallado

### **Fase 1: Base de Datos (30 min)**

#### 1.1. Crear Migración SQL

**Archivo:** `supabase/migrations/YYYYMMDDHHMMSS_add_selected_vehicle.sql`

```sql
-- Agregar campo para guardar el vehículo seleccionado del conductor
ALTER TABLE usuario
ADD COLUMN selected_vehicle_id VARCHAR(50) REFERENCES vehiculos(veh_patente) ON DELETE SET NULL;

-- Índice para mejorar performance
CREATE INDEX idx_usuario_selected_vehicle ON usuario(selected_vehicle_id);

-- Comentario para documentación
COMMENT ON COLUMN usuario.selected_vehicle_id
IS 'Patente del vehículo seleccionado actualmente por el conductor. NULL si no hay selección.';
```

**Justificación:**
- Usar `selected_vehicle_id` como VARCHAR(50) para almacenar la patente
- Reference a `vehiculos(veh_patente)` para integridad referencial
- `ON DELETE SET NULL` para que si se borra el vehículo, la selección se limpie

---

### **Fase 2: Context y Hook (1 hora)**

#### 2.1. Crear Vehicle Context

**Archivo:** `lib/contexts/vehicle-context.tsx`

```typescript
"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

interface Vehicle {
    id: string;
    patente: string;
    tipo: 'AUT' | 'MOT' | 'CAM';
    marca: string;
    modelo: string;
    color: string;
}

interface VehicleContextType {
    selectedVehicle: Vehicle | null;
    setSelectedVehicle: (vehicle: Vehicle | null) => void;
    vehicles: Vehicle[];
    loadingVehicles: boolean;
    refreshVehicles: () => Promise<void>;
}

const VehicleContext = createContext<VehicleContextType>({
    selectedVehicle: null,
    setSelectedVehicle: () => {},
    vehicles: [],
    loadingVehicles: false,
    refreshVehicles: async () => {},
});

export const useVehicle = () => useContext(VehicleContext);

export function VehicleProvider({ children }: { children: ReactNode }) {
    const { user, userRole } = useAuth();
    const [selectedVehicle, setSelectedVehicleState] = useState<Vehicle | null>(null);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loadingVehicles, setLoadingVehicles] = useState(false);

    // Inicializar vehículo seleccionado desde localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && userRole === 'conductor') {
            const saved = localStorage.getItem('selected_vehicle');
            if (saved) {
                try {
                    const vehicle = JSON.parse(saved);
                    console.log('🚗 Vehículo seleccionado desde localStorage:', vehicle);
                    setSelectedVehicleState(vehicle);
                } catch (error) {
                    console.error('Error parseando vehículo guardado:', error);
                    localStorage.removeItem('selected_vehicle');
                }
            }
        }
    }, [userRole]);

    // Cargar vehículos del conductor
    const refreshVehicles = async () => {
        if (!user?.id || userRole !== 'conductor') return;

        try {
            setLoadingVehicles(true);
            const response = await fetch('/api/conductor/vehicles');

            if (response.ok) {
                const data = await response.json();
                setVehicles(data.vehicles || []);
                console.log(`✅ Vehículos cargados: ${data.vehicles?.length || 0}`);
            }
        } catch (error) {
            console.error('Error cargando vehículos:', error);
        } finally {
            setLoadingVehicles(false);
        }
    };

    // Cargar vehículos al montar
    useEffect(() => {
        if (user?.id && userRole === 'conductor') {
            refreshVehicles();
        }
    }, [user?.id, userRole]);

    // Función para establecer vehículo seleccionado
    const setSelectedVehicle = async (vehicle: Vehicle | null) => {
        setSelectedVehicleState(vehicle);

        // Guardar en localStorage
        if (typeof window !== 'undefined') {
            if (vehicle) {
                localStorage.setItem('selected_vehicle', JSON.stringify(vehicle));
                console.log('💾 Vehículo guardado en localStorage:', vehicle.patente);
            } else {
                localStorage.removeItem('selected_vehicle');
                console.log('🗑️ Vehículo removido de localStorage');
            }
        }

        // Guardar en base de datos
        if (user?.id && userRole === 'conductor') {
            try {
                const response = await fetch('/api/conductor/select-vehicle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        vehicleId: vehicle?.patente || null
                    })
                });

                if (response.ok) {
                    console.log('✅ Vehículo seleccionado guardado en BD');
                } else {
                    console.error('Error guardando selección en BD');
                }
            } catch (error) {
                console.error('Error guardando selección:', error);
            }
        }
    };

    return (
        <VehicleContext.Provider
            value={{
                selectedVehicle,
                setSelectedVehicle,
                vehicles,
                loadingVehicles,
                refreshVehicles
            }}
        >
            {children}
        </VehicleContext.Provider>
    );
}
```

**Características:**
- Inicializa desde localStorage al montar
- Guarda en localStorage + BD al seleccionar
- Expone lista de vehículos del conductor
- Solo activo para `userRole === 'conductor'`

---

#### 2.2. Crear Hook Personalizado (Opcional)

**Archivo:** `lib/hooks/use-selected-vehicle.ts`

```typescript
import { useVehicle } from "@/lib/contexts/vehicle-context";

export function useSelectedVehicle() {
    const { selectedVehicle, setSelectedVehicle } = useVehicle();

    return {
        vehicle: selectedVehicle,
        selectVehicle: setSelectedVehicle,
        isSelected: (patente: string) => selectedVehicle?.patente === patente,
        vehicleType: selectedVehicle?.tipo || null
    };
}
```

---

### **Fase 3: API Endpoint (30 min)**

#### 3.1. Crear Endpoint para Guardar Selección

**Archivo:** `app/api/conductor/select-vehicle/route.ts`

```typescript
import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint para guardar el vehículo seleccionado por el conductor
 * POST /api/conductor/select-vehicle
 */
export async function POST(request: NextRequest) {
    try {
        const { vehicleId } = await request.json();
        const { supabase } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        console.log(`🚗 Actualizando vehículo seleccionado para ${user.email}: ${vehicleId || 'ninguno'}`);

        // Actualizar vehículo seleccionado en la BD
        const { error } = await supabase
            .from('usuario')
            .update({ selected_vehicle_id: vehicleId })
            .eq('usu_email', user.email);

        if (error) {
            console.error('❌ Error actualizando vehículo seleccionado:', error);
            return NextResponse.json(
                { error: error.message },
                { status: 500 }
            );
        }

        console.log(`✅ Vehículo seleccionado actualizado correctamente`);
        return NextResponse.json({
            success: true,
            vehicleId
        });

    } catch (error) {
        console.error("❌ Error en select-vehicle:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

/**
 * Obtener el vehículo seleccionado del conductor
 * GET /api/conductor/select-vehicle
 */
export async function GET(request: NextRequest) {
    try {
        const { supabase } = createClient(request);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "No autenticado" },
                { status: 401 }
            );
        }

        // Obtener usuario con vehículo seleccionado
        const { data: usuario, error: usuarioError } = await supabase
            .from('usuario')
            .select('selected_vehicle_id')
            .eq('usu_email', user.email)
            .single();

        if (usuarioError || !usuario) {
            return NextResponse.json({ vehicleId: null });
        }

        // Si hay vehículo seleccionado, obtener sus datos
        if (usuario.selected_vehicle_id) {
            const { data: vehicle, error: vehicleError } = await supabase
                .from('vehiculos')
                .select('*')
                .eq('veh_patente', usuario.selected_vehicle_id)
                .single();

            if (!vehicleError && vehicle) {
                return NextResponse.json({
                    vehicle: {
                        id: vehicle.veh_patente,
                        patente: vehicle.veh_patente,
                        tipo: vehicle.catv_segmento,
                        marca: vehicle.veh_marca || '',
                        modelo: vehicle.veh_modelo || '',
                        color: vehicle.veh_color || ''
                    }
                });
            }
        }

        return NextResponse.json({ vehicleId: null });

    } catch (error) {
        console.error("❌ Error obteniendo vehículo seleccionado:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
```

---

### **Fase 4: Componentes UI (2 horas)**

#### 4.1. Componente Selector de Vehículo

**Archivo:** `components/vehicle-selector.tsx`

```typescript
"use client";

import { useState } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Car, Bike, Truck, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function VehicleSelector() {
    const { selectedVehicle, setSelectedVehicle, vehicles, loadingVehicles } = useVehicle();
    const router = useRouter();

    const getVehicleIcon = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return <Car className="w-4 h-4" />;
            case 'MOT': return <Bike className="w-4 h-4" />;
            case 'CAM': return <Truck className="w-4 h-4" />;
            default: return <Car className="w-4 h-4" />;
        }
    };

    const getVehicleLabel = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return 'Vehículo';
        }
    };

    if (loadingVehicles) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Selecciona tu Vehículo</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500">Cargando vehículos...</p>
                </CardContent>
            </Card>
        );
    }

    if (vehicles.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No tienes vehículos registrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-600 mb-4">
                        Necesitas registrar al menos un vehículo para buscar estacionamientos.
                    </p>
                    <Button onClick={() => router.push('/conductor/vehiculos')}>
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Vehículo
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-2 border-blue-500">
            <CardHeader>
                <CardTitle>Vehículo Actual</CardTitle>
            </CardHeader>
            <CardContent>
                <Select
                    value={selectedVehicle?.patente || ""}
                    onValueChange={(patente) => {
                        const vehicle = vehicles.find(v => v.patente === patente);
                        setSelectedVehicle(vehicle || null);
                    }}
                >
                    <SelectTrigger className="w-full h-12">
                        <SelectValue placeholder="Selecciona un vehículo">
                            {selectedVehicle && (
                                <div className="flex items-center gap-3">
                                    {getVehicleIcon(selectedVehicle.tipo)}
                                    <span className="font-semibold">{selectedVehicle.patente}</span>
                                    <span className="text-gray-500 text-sm">
                                        {getVehicleLabel(selectedVehicle.tipo)}
                                        {selectedVehicle.marca && ` - ${selectedVehicle.marca}`}
                                        {selectedVehicle.modelo && ` ${selectedVehicle.modelo}`}
                                    </span>
                                </div>
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.patente} value={vehicle.patente}>
                                <div className="flex items-center gap-3">
                                    {getVehicleIcon(vehicle.tipo)}
                                    <span className="font-semibold">{vehicle.patente}</span>
                                    <span className="text-gray-500 text-sm">
                                        {getVehicleLabel(vehicle.tipo)}
                                        {vehicle.marca && ` - ${vehicle.marca}`}
                                        {vehicle.modelo && ` ${vehicle.modelo}`}
                                    </span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => router.push('/conductor/vehiculos')}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Gestionar Vehículos
                </Button>
            </CardContent>
        </Card>
    );
}
```

---

#### 4.2. Componente Display de Vehículo

**Archivo:** `components/vehicle-display.tsx`

```typescript
"use client";

import { Badge } from "@/components/ui/badge";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Car, Bike, Truck } from "lucide-react";

export function VehicleDisplay({ compact = false }: { compact?: boolean }) {
    const { selectedVehicle } = useVehicle();

    if (!selectedVehicle) {
        return (
            <Badge variant="outline" className="text-gray-500">
                Sin vehículo seleccionado
            </Badge>
        );
    }

    const getVehicleIcon = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return <Car className="w-4 h-4" />;
            case 'MOT': return <Bike className="w-4 h-4" />;
            case 'CAM': return <Truck className="w-4 h-4" />;
            default: return <Car className="w-4 h-4" />;
        }
    };

    const getVehicleColor = (tipo: string) => {
        switch (tipo) {
            case 'AUT': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'MOT': return 'bg-green-100 text-green-800 border-green-300';
            case 'CAM': return 'bg-purple-100 text-purple-800 border-purple-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    if (compact) {
        return (
            <Badge className={`flex items-center gap-2 ${getVehicleColor(selectedVehicle.tipo)}`}>
                {getVehicleIcon(selectedVehicle.tipo)}
                <span className="font-semibold">{selectedVehicle.patente}</span>
            </Badge>
        );
    }

    return (
        <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 ${getVehicleColor(selectedVehicle.tipo)}`}>
            {getVehicleIcon(selectedVehicle.tipo)}
            <div>
                <div className="font-semibold">{selectedVehicle.patente}</div>
                {(selectedVehicle.marca || selectedVehicle.modelo) && (
                    <div className="text-xs opacity-75">
                        {selectedVehicle.marca} {selectedVehicle.modelo}
                    </div>
                )}
            </div>
        </div>
    );
}
```

---

### **Fase 5: Integración con Dashboard (1 hora)**

#### 5.1. Modificar Layout Principal

**Archivo:** `app/layout.tsx` o `app/conductor/layout.tsx`

```typescript
import { VehicleProvider } from "@/lib/contexts/vehicle-context";

// Envolver la app con VehicleProvider
<AuthProvider>
    <VehicleProvider>
        {children}
    </VehicleProvider>
</AuthProvider>
```

---

#### 5.2. Modificar Dashboard del Conductor

**Archivo:** `app/conductor/page.tsx`

```typescript
// Importar componentes
import { VehicleSelector } from "@/components/vehicle-selector";
import { VehicleDisplay } from "@/components/vehicle-display";
import { useVehicle } from "@/lib/contexts/vehicle-context";

// En el componente
const { selectedVehicle } = useVehicle();

// En el header, mostrar vehículo seleccionado
<div className="flex items-center justify-between mb-6">
    <div className="space-y-2">
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            Mapa de Estacionamientos
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl">
            Encontrá y navegá a los estacionamientos disponibles cerca tuyo
        </p>
    </div>

    {/* 🟢 NUEVO: Mostrar vehículo seleccionado */}
    <VehicleDisplay />
</div>

// En el panel izquierdo, agregar selector
<div className="w-96 bg-white border-r border-gray-200 flex-shrink-0 shadow-lg">
    <div className="p-8">
        {/* 🟢 NUEVO: Selector de vehículo */}
        <div className="mb-6">
            <VehicleSelector />
        </div>

        {/* Resto del contenido... */}
    </div>
</div>

// 🟢 MODIFICAR: Auto-seleccionar filtro según vehículo
useEffect(() => {
    if (selectedVehicle) {
        setVehicleTypeFilter(selectedVehicle.tipo);
        console.log(`🚗 Filtro automático por tipo: ${selectedVehicle.tipo}`);
    }
}, [selectedVehicle]);
```

---

#### 5.3. Modificar Página de Vehículos

**Archivo:** `app/conductor/vehiculos/page.tsx`

```typescript
import { useVehicle } from "@/lib/contexts/vehicle-context";
import { Badge } from "@/components/ui/badge";

const { selectedVehicle, setSelectedVehicle } = useVehicle();

// En la tabla, marcar el vehículo seleccionado
<TableRow key={vehicle.id} className={selectedVehicle?.patente === vehicle.patente ? 'bg-blue-50' : ''}>
    <TableCell className="font-medium">
        <div className="flex items-center gap-2">
            {vehicle.patente}
            {selectedVehicle?.patente === vehicle.patente && (
                <Badge className="bg-blue-600 text-white">Seleccionado</Badge>
            )}
        </div>
    </TableCell>
    {/* ... otras celdas ... */}
    <TableCell>
        <Button
            variant={selectedVehicle?.patente === vehicle.patente ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedVehicle(vehicle)}
        >
            {selectedVehicle?.patente === vehicle.patente ? 'Seleccionado' : 'Seleccionar'}
        </Button>
    </TableCell>
</TableRow>
```

---

## 🧪 Testing

### **Test 1: Persistencia localStorage**
1. Seleccionar vehículo
2. Recargar página (F5)
3. ✅ Verificar que el vehículo sigue seleccionado

### **Test 2: Persistencia BD**
1. Seleccionar vehículo
2. Cerrar navegador
3. Abrir en otro dispositivo (mismo usuario)
4. ✅ Verificar que el vehículo está seleccionado

### **Test 3: Cambio de Vehículo**
1. Seleccionar vehículo A
2. Verificar filtro de búsqueda = tipo A
3. Seleccionar vehículo B
4. ✅ Verificar filtro actualizado = tipo B

### **Test 4: Sin Vehículos**
1. Conductor sin vehículos registrados
2. ✅ Mostrar mensaje para agregar vehículo
3. ✅ Botón para ir a `/conductor/vehiculos`

---

## 📊 Estimación de Tiempos

| Fase | Tarea | Tiempo Estimado |
|------|-------|----------------|
| 1 | Migración BD | 30 min |
| 2 | Context + Hook | 1 hora |
| 3 | API Endpoint | 30 min |
| 4 | Componentes UI | 2 horas |
| 5 | Integración | 1 hora |
| 6 | Testing | 1 hora |
| **TOTAL** | | **6 horas** |

---

## 🔗 Próximos Pasos (Post-Implementación)

1. **Búsqueda Inteligente:**
   - Usar `selectedVehicle.tipo` para filtrar automáticamente estacionamientos
   - Mostrar solo estacionamientos con espacio para ese tipo

2. **Recomendaciones:**
   - "Estacionamientos cerca de ti para tu {tipo}"
   - Ordenar por disponibilidad + distancia

3. **Reservas:**
   - Asociar reserva al vehículo seleccionado
   - Historial de estacionamientos por vehículo

---

## 📝 Notas Importantes

### **Decisiones de Diseño:**

1. **¿Por qué localStorage + BD?**
   - localStorage: Carga instantánea al abrir app
   - BD: Sincronización entre dispositivos

2. **¿Por qué Context en lugar de Redux?**
   - Menor complejidad
   - Suficiente para este caso de uso
   - Ya hay AuthContext usando el mismo patrón

3. **¿Por qué guardar patente en lugar de ID numérico?**
   - `veh_patente` es la PK de la tabla `vehiculos`
   - Más simple y directo

---

**Fecha de Creación:** 2025-10-08
**Estimación Total:** 6 horas
**Prioridad:** Media-Alta
