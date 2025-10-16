<!-- 26a4f5ce-b7f2-4b12-8b3a-ee4a5b2d8fdf 8e9e41d3-f2bf-4317-9c9c-e66b8f3ba1f9 -->
# Plan de Implementación: Funcionalidad de Playero para Crear Abonos

## Resumen Ejecutivo

Implementar un sistema completo de gestión de abonos donde el playero puede crear conductores nuevos y asignarles abonos de estacionamiento. El sistema incluye búsqueda de conductores existentes, creación de nuevos conductores con vehículos, y generación de abonos con diferentes tipos y duraciones.

---

## Arquitectura del Sistema

### Flujo General de Datos

```
Usuario Playero → Página de Creación de Abonos → Buscar Conductor
                                                 ↓
                                    ¿Conductor existe?
                                    ↙              ↘
                               SÍ                  NO
                               ↓                    ↓
                    Cargar datos existentes    Crear nuevo conductor
                    + vehículos                + crear vehículo(s)
                               ↓                    ↓
                               └──────────┬─────────┘
                                          ↓
                                   Configurar abono
                                   (tipo, duración)
                                          ↓
                                   API: POST /api/abonos/create-conductor
                                          ↓
                                   Transacción DB:
                                   1. Crear/validar usuario
                                   2. Crear/validar conductor
                                   3. Crear vehículo(s)
                                   4. Crear abonado
                                   5. Crear abono
                                          ↓
                                   Respuesta exitosa
                                          ↓
                                   Mostrar confirmación
                                   + Imprimir ticket
```

---

## 1. Estructura de Base de Datos

### Tablas Involucradas

#### 1.1 Tabla `usuario`
```sql
-- Datos del usuario en el sistema
CREATE TABLE usuario (
  usu_id SERIAL PRIMARY KEY,
  usu_nom VARCHAR NOT NULL,
  usu_ape VARCHAR NOT NULL,
  usu_email VARCHAR UNIQUE NOT NULL,
  usu_tel VARCHAR,
  usu_dni VARCHAR UNIQUE NOT NULL,
  usu_fechareg TIMESTAMP DEFAULT NOW(),
  usu_estado VARCHAR DEFAULT 'activo',
  auth_user_id UUID -- FK a auth.users (Supabase Auth)
);
```

#### 1.2 Tabla `conductores`
```sql
-- Relación 1:1 con usuario
CREATE TABLE conductores (
  con_id INTEGER PRIMARY KEY,
  FOREIGN KEY (con_id) REFERENCES usuario(usu_id)
);
```

#### 1.3 Tabla `vehiculos`
```sql
-- Vehículos registrados por conductor
CREATE TABLE vehiculos (
  veh_patente TEXT PRIMARY KEY,
  con_id INTEGER NOT NULL,
  catv_segmento CHAR(3) NOT NULL, -- 'AUT', 'MOT', 'CAM'
  veh_marca VARCHAR,
  veh_modelo VARCHAR,
  veh_color VARCHAR,
  FOREIGN KEY (con_id) REFERENCES conductores(con_id),
  FOREIGN KEY (catv_segmento) REFERENCES cat_vehiculo(catv_segmento)
);
```

#### 1.4 Tabla `abonado`
```sql
-- Datos de abonados (puede ser diferente al conductor)
CREATE TABLE abonado (
  abon_id SERIAL PRIMARY KEY,
  con_id INTEGER,
  abon_dni VARCHAR NOT NULL,
  abon_nombre VARCHAR NOT NULL,
  abon_apellido VARCHAR NOT NULL,
  FOREIGN KEY (con_id) REFERENCES conductores(con_id)
);
```

#### 1.5 Tabla `abonos`
```sql
-- Abonos activos/históricos
CREATE TABLE abonos (
  abo_nro SERIAL NOT NULL,
  est_id INTEGER NOT NULL,
  abon_id INTEGER NOT NULL,
  abo_fecha_inicio TIMESTAMP NOT NULL,
  abo_fecha_fin TIMESTAMP NOT NULL,
  pag_nro INTEGER,
  abo_tipoabono VARCHAR, -- 'mensual', 'trimestral', 'semestral', 'anual'
  PRIMARY KEY (abo_nro, est_id),
  FOREIGN KEY (est_id) REFERENCES estacionamientos(est_id),
  FOREIGN KEY (abon_id) REFERENCES abonado(abon_id),
  FOREIGN KEY (pag_nro) REFERENCES pagos(pag_nro)
);
```

### Relaciones

```
usuario (1) ←→ (1) conductores
conductores (1) ←→ (N) vehiculos
conductores (1) ←→ (1) abonado
abonado (1) ←→ (N) abonos
estacionamientos (1) ←→ (N) abonos
```

---

## 2. Tipos TypeScript

### Archivo: `lib/types.ts` (agregar)

```typescript
// ============================================
// TIPOS PARA ABONOS
// ============================================

export type TipoAbono = 'mensual' | 'trimestral' | 'semestral' | 'anual';
export type UnidadDuracion = 'dias' | 'meses' | 'años';

export interface Conductor {
  con_id: number;
  usu_nom: string;
  usu_ape: string;
  usu_email: string;
  usu_tel?: string;
  usu_dni: string;
  usu_fechareg: string;
  usu_estado: string;
}

export interface ConductorConVehiculos extends Conductor {
  vehiculos: VehiculoDB[];
}

export interface VehiculoDB {
  veh_patente: string;
  con_id: number;
  catv_segmento: 'AUT' | 'MOT' | 'CAM';
  veh_marca: string;
  veh_modelo: string;
  veh_color: string;
}

export interface VehiculoFormData {
  patente: string;
  tipo: 'Auto' | 'Moto' | 'Camioneta';
  marca: string;
  modelo: string;
  color: string;
}

export interface Abonado {
  abon_id: number;
  con_id: number;
  abon_dni: string;
  abon_nombre: string;
  abon_apellido: string;
}

export interface Abono {
  abo_nro: number;
  est_id: number;
  abon_id: number;
  abo_fecha_inicio: string;
  abo_fecha_fin: string;
  pag_nro?: number;
  abo_tipoabono: TipoAbono;
}

export interface AbonoConDetalles extends Abono {
  abonado: Abonado;
  estacionamiento: {
    est_nombre: string;
    est_direc: string;
  };
}

// ============================================
// TIPOS PARA FORMULARIOS
// ============================================

export interface CrearConductorFormData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  vehiculos: VehiculoFormData[];
}

export interface CrearAbonoFormData {
  tipoAbono: TipoAbono;
  duracion: number;
  unidad: UnidadDuracion;
  fechaInicio?: string; // ISO string, default: hoy
}

export interface CrearConductorConAbonoRequest {
  // Datos del conductor
  conductor: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    dni: string;
  };
  // Vehículos (mínimo 1 requerido)
  vehiculos: VehiculoFormData[];
  // Datos del abono
  abono: {
    est_id: number;
    tipoAbono: TipoAbono;
    fechaInicio: string;
    fechaFin: string;
  };
}

export interface CrearAbonoExistenteRequest {
  con_id: number;
  est_id: number;
  tipoAbono: TipoAbono;
  fechaInicio: string;
  fechaFin: string;
}

// ============================================
// TIPOS PARA RESPUESTAS DE API
// ============================================

export interface CrearConductorConAbonoResponse {
  success: boolean;
  data?: {
    usuario_id: number;
    conductor_id: number;
    vehiculo_ids: string[]; // patentes
    abonado_id: number;
    abono_nro: number;
    abono: AbonoConDetalles;
  };
  error?: string;
}

export interface BuscarConductorResponse {
  success: boolean;
  data?: ConductorConVehiculos;
  error?: string;
}

// ============================================
// TIPOS PARA CONFIGURACIÓN DE ABONOS
// ============================================

export interface ConfiguracionAbono {
  tipo: TipoAbono;
  duracionMeses: number;
  precioBase: number; // Puede venir de una tabla de tarifas
  descripcion: string;
}

export const CONFIGURACIONES_ABONOS: Record<TipoAbono, ConfiguracionAbono> = {
  mensual: {
    tipo: 'mensual',
    duracionMeses: 1,
    precioBase: 5000,
    descripcion: 'Abono válido por 1 mes'
  },
  trimestral: {
    tipo: 'trimestral',
    duracionMeses: 3,
    precioBase: 13500, // 10% descuento
    descripcion: 'Abono válido por 3 meses'
  },
  semestral: {
    tipo: 'semestral',
    duracionMeses: 6,
    precioBase: 25500, // 15% descuento
    descripcion: 'Abono válido por 6 meses'
  },
  anual: {
    tipo: 'anual',
    duracionMeses: 12,
    precioBase: 48000, // 20% descuento
    descripcion: 'Abono válido por 1 año'
  }
};
```

---

## 3. API Endpoints

### 3.1 Archivo: `app/api/abonos/create-conductor/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CrearConductorConAbonoRequest, CrearConductorConAbonoResponse } from "@/lib/types";

/**
 * POST /api/abonos/create-conductor
 *
 * Crea un nuevo conductor con sus vehículos y un abono asociado.
 * Solo accesible por playeros.
 *
 * @body CrearConductorConAbonoRequest
 * @returns CrearConductorConAbonoResponse
 */
export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    async get(name: string) {
                        const cookie = await cookieStore.get(name);
                        return cookie?.value;
                    },
                },
            }
        );

        // ========================================
        // 1. VALIDAR AUTENTICACIÓN Y ROL
        // ========================================
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // Verificar que el usuario sea playero
        const { data: playeroData, error: playeroError } = await supabase
            .from('playeros')
            .select('play_id')
            .eq('play_id', user.id)
            .single();

        if (playeroError || !playeroData) {
            return NextResponse.json(
                { success: false, error: "Solo playeros pueden crear abonos" },
                { status: 403 }
            );
        }

        // ========================================
        // 2. VALIDAR REQUEST BODY
        // ========================================
        const body: CrearConductorConAbonoRequest = await request.json();

        // Validar datos del conductor
        if (!body.conductor || !body.conductor.nombre || !body.conductor.apellido ||
            !body.conductor.email || !body.conductor.dni) {
            return NextResponse.json(
                { success: false, error: "Datos del conductor incompletos" },
                { status: 400 }
            );
        }

        // Validar vehículos (mínimo 1)
        if (!body.vehiculos || body.vehiculos.length === 0) {
            return NextResponse.json(
                { success: false, error: "Debe registrar al menos 1 vehículo" },
                { status: 400 }
            );
        }

        // Validar cada vehículo
        for (const veh of body.vehiculos) {
            if (!veh.patente || !veh.tipo || !veh.marca || !veh.modelo || !veh.color) {
                return NextResponse.json(
                    { success: false, error: "Datos de vehículo incompletos" },
                    { status: 400 }
                );
            }
        }

        // Validar datos del abono
        if (!body.abono || !body.abono.est_id || !body.abono.tipoAbono ||
            !body.abono.fechaInicio || !body.abono.fechaFin) {
            return NextResponse.json(
                { success: false, error: "Datos del abono incompletos" },
                { status: 400 }
            );
        }

        // ========================================
        // 3. VALIDAR DNI Y EMAIL ÚNICOS
        // ========================================
        const { data: usuarioExistente } = await supabase
            .from('usuario')
            .select('usu_id, usu_dni, usu_email')
            .or(`usu_dni.eq.${body.conductor.dni},usu_email.eq.${body.conductor.email}`)
            .single();

        if (usuarioExistente) {
            if (usuarioExistente.usu_dni === body.conductor.dni) {
                return NextResponse.json(
                    { success: false, error: "El DNI ya está registrado" },
                    { status: 409 }
                );
            }
            if (usuarioExistente.usu_email === body.conductor.email) {
                return NextResponse.json(
                    { success: false, error: "El email ya está registrado" },
                    { status: 409 }
                );
            }
        }

        // ========================================
        // 4. VALIDAR PATENTES ÚNICAS
        // ========================================
        const patentes = body.vehiculos.map(v => v.patente.toUpperCase());
        const { data: vehiculosExistentes } = await supabase
            .from('vehiculos')
            .select('veh_patente')
            .in('veh_patente', patentes);

        if (vehiculosExistentes && vehiculosExistentes.length > 0) {
            const patentesExistentes = vehiculosExistentes.map((v: any) => v.veh_patente);
            return NextResponse.json(
                {
                    success: false,
                    error: `Las siguientes patentes ya están registradas: ${patentesExistentes.join(', ')}`
                },
                { status: 409 }
            );
        }

        // ========================================
        // 5. CREAR USUARIO EN TABLA USUARIO
        // ========================================
        const { data: nuevoUsuario, error: errorUsuario } = await supabase
            .from('usuario')
            .insert({
                usu_nom: body.conductor.nombre,
                usu_ape: body.conductor.apellido,
                usu_email: body.conductor.email,
                usu_tel: body.conductor.telefono || null,
                usu_dni: body.conductor.dni,
                usu_fechareg: new Date().toISOString(),
                usu_estado: 'activo',
                // NO crear auth_user_id aquí (el conductor no tiene cuenta de login todavía)
            })
            .select('usu_id')
            .single();

        if (errorUsuario || !nuevoUsuario) {
            console.error('Error creando usuario:', errorUsuario);
            return NextResponse.json(
                { success: false, error: `Error creando usuario: ${errorUsuario?.message}` },
                { status: 500 }
            );
        }

        const usuarioId = nuevoUsuario.usu_id;

        // ========================================
        // 6. CREAR REGISTRO EN TABLA CONDUCTORES
        // ========================================
        const { error: errorConductor } = await supabase
            .from('conductores')
            .insert({
                con_id: usuarioId
            });

        if (errorConductor) {
            console.error('Error creando conductor:', errorConductor);
            // Rollback: eliminar usuario
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando conductor: ${errorConductor.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 7. CREAR VEHÍCULOS
        // ========================================
        const tipoMapping: Record<string, string> = {
            'Auto': 'AUT',
            'Moto': 'MOT',
            'Camioneta': 'CAM'
        };

        const vehiculosParaInsertar = body.vehiculos.map(v => ({
            veh_patente: v.patente.toUpperCase(),
            con_id: usuarioId,
            catv_segmento: tipoMapping[v.tipo] || 'AUT',
            veh_marca: v.marca,
            veh_modelo: v.modelo,
            veh_color: v.color
        }));

        const { data: vehiculosCreados, error: errorVehiculos } = await supabase
            .from('vehiculos')
            .insert(vehiculosParaInsertar)
            .select('veh_patente');

        if (errorVehiculos || !vehiculosCreados) {
            console.error('Error creando vehículos:', errorVehiculos);
            // Rollback: eliminar conductor y usuario
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando vehículos: ${errorVehiculos?.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 8. CREAR REGISTRO EN TABLA ABONADO
        // ========================================
        const { data: nuevoAbonado, error: errorAbonado } = await supabase
            .from('abonado')
            .insert({
                con_id: usuarioId,
                abon_dni: body.conductor.dni,
                abon_nombre: body.conductor.nombre,
                abon_apellido: body.conductor.apellido
            })
            .select('abon_id')
            .single();

        if (errorAbonado || !nuevoAbonado) {
            console.error('Error creando abonado:', errorAbonado);
            // Rollback: eliminar vehículos, conductor y usuario
            await supabase.from('vehiculos').delete().eq('con_id', usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando abonado: ${errorAbonado?.message}` },
                { status: 500 }
            );
        }

        const abonadoId = nuevoAbonado.abon_id;

        // ========================================
        // 9. CREAR ABONO
        // ========================================
        const { data: nuevoAbono, error: errorAbono } = await supabase
            .from('abonos')
            .insert({
                est_id: body.abono.est_id,
                abon_id: abonadoId,
                abo_fecha_inicio: body.abono.fechaInicio,
                abo_fecha_fin: body.abono.fechaFin,
                abo_tipoabono: body.abono.tipoAbono,
                pag_nro: null // Sin pago por ahora
            })
            .select(`
                abo_nro,
                est_id,
                abon_id,
                abo_fecha_inicio,
                abo_fecha_fin,
                abo_tipoabono
            `)
            .single();

        if (errorAbono || !nuevoAbono) {
            console.error('Error creando abono:', errorAbono);
            // Rollback completo
            await supabase.from('abonado').delete().eq('abon_id', abonadoId);
            await supabase.from('vehiculos').delete().eq('con_id', usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando abono: ${errorAbono?.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 10. OBTENER DATOS COMPLETOS DEL ABONO CREADO
        // ========================================
        const { data: abonoCompleto, error: errorAbonoCompleto } = await supabase
            .from('abonos')
            .select(`
                abo_nro,
                est_id,
                abon_id,
                abo_fecha_inicio,
                abo_fecha_fin,
                abo_tipoabono,
                abonado (
                    abon_id,
                    abon_dni,
                    abon_nombre,
                    abon_apellido,
                    con_id
                ),
                estacionamientos (
                    est_nombre,
                    est_direc
                )
            `)
            .eq('abo_nro', nuevoAbono.abo_nro)
            .eq('est_id', body.abono.est_id)
            .single();

        if (errorAbonoCompleto) {
            console.error('Error obteniendo abono completo:', errorAbonoCompleto);
        }

        // ========================================
        // 11. RESPUESTA EXITOSA
        // ========================================
        const response: CrearConductorConAbonoResponse = {
            success: true,
            data: {
                usuario_id: usuarioId,
                conductor_id: usuarioId,
                vehiculo_ids: vehiculosCreados.map((v: any) => v.veh_patente),
                abonado_id: abonadoId,
                abono_nro: nuevoAbono.abo_nro,
                abono: abonoCompleto || nuevoAbono
            }
        };

        return NextResponse.json(response, { status: 201 });

    } catch (error) {
        console.error('Error en /api/abonos/create-conductor POST:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
```

### 3.2 Archivo: `app/api/conductor/search/route.ts` (nuevo)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { BuscarConductorResponse } from "@/lib/types";

/**
 * GET /api/conductor/search?query=xxx
 *
 * Busca un conductor por email o DNI.
 * Solo accesible por playeros.
 *
 * @query string - Email o DNI del conductor
 * @returns BuscarConductorResponse
 */
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    async get(name: string) {
                        const cookie = await cookieStore.get(name);
                        return cookie?.value;
                    },
                },
            }
        );

        // Validar autenticación
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // Obtener query parameter
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('query');

        if (!query) {
            return NextResponse.json(
                { success: false, error: "Parámetro 'query' requerido" },
                { status: 400 }
            );
        }

        // Buscar conductor por email o DNI
        const { data: conductorData, error } = await supabase
            .from('conductores')
            .select(`
                con_id,
                usuario!inner (
                    usu_id,
                    usu_nom,
                    usu_ape,
                    usu_email,
                    usu_tel,
                    usu_dni,
                    usu_fechareg,
                    usu_estado
                ),
                vehiculos (
                    veh_patente,
                    catv_segmento,
                    veh_marca,
                    veh_modelo,
                    veh_color
                )
            `)
            .or(`usuario.usu_email.eq.${query},usuario.usu_dni.eq.${query}`)
            .single();

        if (error || !conductorData) {
            return NextResponse.json(
                { success: false, error: "Conductor no encontrado" },
                { status: 404 }
            );
        }

        // Formatear respuesta
        const response: BuscarConductorResponse = {
            success: true,
            data: {
                con_id: conductorData.con_id,
                usu_nom: (conductorData.usuario as any).usu_nom,
                usu_ape: (conductorData.usuario as any).usu_ape,
                usu_email: (conductorData.usuario as any).usu_email,
                usu_tel: (conductorData.usuario as any).usu_tel,
                usu_dni: (conductorData.usuario as any).usu_dni,
                usu_fechareg: (conductorData.usuario as any).usu_fechareg,
                usu_estado: (conductorData.usuario as any).usu_estado,
                vehiculos: conductorData.vehiculos || []
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('Error en /api/conductor/search GET:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
```

---

## 4. Componentes Frontend

### 4.1 Archivo: `components/abonos/crear-abono-panel.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, User, Car, Calendar, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import {
    ConductorConVehiculos,
    VehiculoFormData,
    TipoAbono,
    CONFIGURACIONES_ABONOS,
    CrearConductorConAbonoRequest,
    CrearConductorConAbonoResponse
} from "@/lib/types";

interface CrearAbonoPanelProps {
    estacionamientoId: number;
    estacionamientoNombre: string;
}

type Paso = 'buscar' | 'datos-conductor' | 'configurar-abono' | 'confirmacion';

export function CrearAbonoPanel({ estacionamientoId, estacionamientoNombre }: CrearAbonoPanelProps) {
    // ========================================
    // ESTADO
    // ========================================
    const [paso, setPaso] = useState<Paso>('buscar');
    const [busqueda, setBusqueda] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [conductorExistente, setConductorExistente] = useState<ConductorConVehiculos | null>(null);

    // Datos del nuevo conductor
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [dni, setDni] = useState('');

    // Vehículos
    const [vehiculos, setVehiculos] = useState<VehiculoFormData[]>([
        { patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }
    ]);

    // Configuración del abono
    const [tipoAbono, setTipoAbono] = useState<TipoAbono>('mensual');
    const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

    // Estado de la UI
    const [error, setError] = useState('');
    const [creando, setCreando] = useState(false);
    const [abonoCreado, setAbonoCreado] = useState<any>(null);

    // ========================================
    // FUNCIONES DE BÚSQUEDA
    // ========================================
    const buscarConductor = async () => {
        if (!busqueda.trim()) {
            setError('Ingrese un email o DNI');
            return;
        }

        setBuscando(true);
        setError('');

        try {
            const response = await fetch(`/api/conductor/search?query=${encodeURIComponent(busqueda)}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Conductor encontrado
                setConductorExistente(data.data);
                setPaso('configurar-abono');

                // Pre-llenar datos para vista previa
                setNombre(data.data.usu_nom);
                setApellido(data.data.usu_ape);
                setEmail(data.data.usu_email);
                setTelefono(data.data.usu_tel || '');
                setDni(data.data.usu_dni);
            } else {
                // Conductor no encontrado - ir a formulario de creación
                setConductorExistente(null);
                setPaso('datos-conductor');
            }
        } catch (err) {
            console.error('Error buscando conductor:', err);
            setError('Error al buscar conductor');
        } finally {
            setBuscando(false);
        }
    };

    // ========================================
    // FUNCIONES DE VEHÍCULOS
    // ========================================
    const agregarVehiculo = () => {
        setVehiculos([...vehiculos, { patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }]);
    };

    const eliminarVehiculo = (index: number) => {
        if (vehiculos.length > 1) {
            setVehiculos(vehiculos.filter((_, i) => i !== index));
        }
    };

    const actualizarVehiculo = (index: number, campo: keyof VehiculoFormData, valor: string) => {
        const nuevosVehiculos = [...vehiculos];
        (nuevosVehiculos[index] as any)[campo] = valor;
        setVehiculos(nuevosVehiculos);
    };

    // ========================================
    // CÁLCULOS
    // ========================================
    const calcularFechaFin = (): string => {
        const config = CONFIGURACIONES_ABONOS[tipoAbono];
        const inicio = new Date(fechaInicio);
        const fin = new Date(inicio);
        fin.setMonth(fin.getMonth() + config.duracionMeses);
        return fin.toISOString().split('T')[0];
    };

    const precioTotal = CONFIGURACIONES_ABONOS[tipoAbono].precioBase;

    // ========================================
    // VALIDACIONES
    // ========================================
    const validarFormulario = (): string | null => {
        if (!nombre.trim()) return 'El nombre es requerido';
        if (!apellido.trim()) return 'El apellido es requerido';
        if (!email.trim()) return 'El email es requerido';
        if (!dni.trim()) return 'El DNI es requerido';

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return 'Email inválido';

        // Validar DNI (8 dígitos)
        if (!/^\d{8}$/.test(dni)) return 'DNI debe tener 8 dígitos';

        // Validar vehículos
        for (let i = 0; i < vehiculos.length; i++) {
            const veh = vehiculos[i];
            if (!veh.patente.trim()) return `Patente del vehículo ${i + 1} es requerida`;
            if (!veh.marca.trim()) return `Marca del vehículo ${i + 1} es requerida`;
            if (!veh.modelo.trim()) return `Modelo del vehículo ${i + 1} es requerido`;
            if (!veh.color.trim()) return `Color del vehículo ${i + 1} es requerido`;

            // Validar formato de patente (ejemplo: ABC123 o AB123CD)
            if (!/^[A-Z]{2,3}\d{3}[A-Z]{0,2}$/i.test(veh.patente)) {
                return `Formato de patente inválido para vehículo ${i + 1}`;
            }
        }

        return null;
    };

    // ========================================
    // CREAR ABONO
    // ========================================
    const crearAbono = async () => {
        // Validar formulario
        const errorValidacion = validarFormulario();
        if (errorValidacion) {
            setError(errorValidacion);
            return;
        }

        setCreando(true);
        setError('');

        try {
            const requestBody: CrearConductorConAbonoRequest = {
                conductor: {
                    nombre,
                    apellido,
                    email,
                    telefono,
                    dni
                },
                vehiculos: vehiculos.map(v => ({
                    ...v,
                    patente: v.patente.toUpperCase()
                })),
                abono: {
                    est_id: estacionamientoId,
                    tipoAbono,
                    fechaInicio,
                    fechaFin: calcularFechaFin()
                }
            };

            const response = await fetch('/api/abonos/create-conductor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data: CrearConductorConAbonoResponse = await response.json();

            if (data.success && data.data) {
                setAbonoCreado(data.data);
                setPaso('confirmacion');
            } else {
                setError(data.error || 'Error al crear abono');
            }
        } catch (err) {
            console.error('Error creando abono:', err);
            setError('Error al crear abono');
        } finally {
            setCreando(false);
        }
    };

    // ========================================
    // REINICIAR FORMULARIO
    // ========================================
    const reiniciar = () => {
        setBusqueda('');
        setConductorExistente(null);
        setNombre('');
        setApellido('');
        setEmail('');
        setTelefono('');
        setDni('');
        setVehiculos([{ patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }]);
        setTipoAbono('mensual');
        setFechaInicio(new Date().toISOString().split('T')[0]);
        setError('');
        setAbonoCreado(null);
        setPaso('buscar');
    };

    // ========================================
    // RENDERIZADO
    // ========================================
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ============ COLUMNA IZQUIERDA: FORMULARIO ============ */}
            <div className="lg:col-span-2 space-y-6">

                {/* PASO 1: BÚSQUEDA */}
                {paso === 'buscar' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                Buscar Conductor
                            </CardTitle>
                            <CardDescription>
                                Busca un conductor existente por email o DNI
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Email o DNI"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && buscarConductor()}
                                />
                                <Button onClick={buscarConductor} disabled={buscando}>
                                    {buscando ? 'Buscando...' : 'Buscar'}
                                </Button>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* PASO 2: DATOS DEL CONDUCTOR */}
                {paso === 'datos-conductor' && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    Datos del Conductor
                                </CardTitle>
                                <CardDescription>
                                    Ingresa los datos del nuevo conductor
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="nombre">Nombre *</Label>
                                        <Input
                                            id="nombre"
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            placeholder="Juan"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="apellido">Apellido *</Label>
                                        <Input
                                            id="apellido"
                                            value={apellido}
                                            onChange={(e) => setApellido(e.target.value)}
                                            placeholder="Pérez"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="juan.perez@email.com"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="telefono">Teléfono</Label>
                                        <Input
                                            id="telefono"
                                            value={telefono}
                                            onChange={(e) => setTelefono(e.target.value)}
                                            placeholder="1234567890"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="dni">DNI *</Label>
                                        <Input
                                            id="dni"
                                            value={dni}
                                            onChange={(e) => setDni(e.target.value)}
                                            placeholder="12345678"
                                            maxLength={8}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Car className="w-5 h-5" />
                                            Vehículos
                                        </CardTitle>
                                        <CardDescription>
                                            Registra al menos 1 vehículo
                                        </CardDescription>
                                    </div>
                                    <Button onClick={agregarVehiculo} variant="outline" size="sm">
                                        <Plus className="w-4 h-4 mr-1" />
                                        Agregar
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {vehiculos.map((vehiculo, index) => (
                                    <div key={index} className="p-4 border rounded-lg space-y-3">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-semibold">Vehículo {index + 1}</h4>
                                            {vehiculos.length > 1 && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => eliminarVehiculo(index)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Patente *</Label>
                                                <Input
                                                    value={vehiculo.patente}
                                                    onChange={(e) => actualizarVehiculo(index, 'patente', e.target.value.toUpperCase())}
                                                    placeholder="ABC123"
                                                />
                                            </div>
                                            <div>
                                                <Label>Tipo *</Label>
                                                <Select
                                                    value={vehiculo.tipo}
                                                    onValueChange={(valor) => actualizarVehiculo(index, 'tipo', valor)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Auto">Auto</SelectItem>
                                                        <SelectItem value="Moto">Moto</SelectItem>
                                                        <SelectItem value="Camioneta">Camioneta</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <Label>Marca *</Label>
                                                <Input
                                                    value={vehiculo.marca}
                                                    onChange={(e) => actualizarVehiculo(index, 'marca', e.target.value)}
                                                    placeholder="Toyota"
                                                />
                                            </div>
                                            <div>
                                                <Label>Modelo *</Label>
                                                <Input
                                                    value={vehiculo.modelo}
                                                    onChange={(e) => actualizarVehiculo(index, 'modelo', e.target.value)}
                                                    placeholder="Corolla"
                                                />
                                            </div>
                                            <div>
                                                <Label>Color *</Label>
                                                <Input
                                                    value={vehiculo.color}
                                                    onChange={(e) => actualizarVehiculo(index, 'color', e.target.value)}
                                                    placeholder="Rojo"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={reiniciar}>
                                Cancelar
                            </Button>
                            <Button onClick={() => setPaso('configurar-abono')}>
                                Continuar a Configuración
                            </Button>
                        </div>
                    </>
                )}

                {/* PASO 3: CONFIGURAR ABONO */}
                {paso === 'configurar-abono' && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5" />
                                    Configuración del Abono
                                </CardTitle>
                                <CardDescription>
                                    Selecciona el tipo y duración del abono
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="tipoAbono">Tipo de Abono</Label>
                                    <Select value={tipoAbono} onValueChange={(v) => setTipoAbono(v as TipoAbono)}>
                                        <SelectTrigger id="tipoAbono">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CONFIGURACIONES_ABONOS).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    {config.descripcion} - ${config.precioBase}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="fechaInicio">Fecha de Inicio</Label>
                                    <Input
                                        id="fechaInicio"
                                        type="date"
                                        value={fechaInicio}
                                        onChange={(e) => setFechaInicio(e.target.value)}
                                    />
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-sm text-gray-600">
                                        <strong>Fecha de fin:</strong> {calcularFechaFin()}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setPaso(conductorExistente ? 'buscar' : 'datos-conductor')}>
                                Atrás
                            </Button>
                            <Button onClick={crearAbono} disabled={creando}>
                                {creando ? 'Creando...' : 'Crear Abono'}
                            </Button>
                        </div>
                    </>
                )}

                {/* PASO 4: CONFIRMACIÓN */}
                {paso === 'confirmacion' && abonoCreado && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-600">
                                <CheckCircle className="w-6 h-6" />
                                Abono Creado Exitosamente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-green-50 p-4 rounded-lg space-y-2">
                                <p><strong>Conductor:</strong> {nombre} {apellido}</p>
                                <p><strong>DNI:</strong> {dni}</p>
                                <p><strong>Abono Nº:</strong> {abonoCreado.abono_nro}</p>
                                <p><strong>Tipo:</strong> {tipoAbono}</p>
                                <p><strong>Vigencia:</strong> {fechaInicio} hasta {calcularFechaFin()}</p>
                                <p><strong>Vehículos registrados:</strong> {abonoCreado.vehiculo_ids.join(', ')}</p>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={reiniciar}>
                                    Crear Otro Abono
                                </Button>
                                <Button variant="outline" onClick={() => window.print()}>
                                    Imprimir Ticket
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ============ COLUMNA DERECHA: RESUMEN ============ */}
            <div className="lg:col-span-1">
                <Card className="sticky top-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            Resumen
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {paso !== 'buscar' && (
                            <>
                                <div className="pb-3 border-b">
                                    <p className="text-sm text-gray-600">Estacionamiento</p>
                                    <p className="font-semibold">{estacionamientoNombre}</p>
                                </div>

                                {(nombre || conductorExistente) && (
                                    <div className="pb-3 border-b">
                                        <p className="text-sm text-gray-600">Conductor</p>
                                        <p className="font-semibold">
                                            {conductorExistente ? `${conductorExistente.usu_nom} ${conductorExistente.usu_ape}` : `${nombre} ${apellido}`}
                                        </p>
                                        {dni && <p className="text-sm">DNI: {dni}</p>}
                                    </div>
                                )}

                                {vehiculos.some(v => v.patente) && (
                                    <div className="pb-3 border-b">
                                        <p className="text-sm text-gray-600 mb-2">Vehículos</p>
                                        {vehiculos.filter(v => v.patente).map((v, i) => (
                                            <p key={i} className="text-sm">
                                                {v.patente} - {v.tipo}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {paso === 'configurar-abono' || paso === 'confirmacion' ? (
                                    <>
                                        <div className="pb-3 border-b">
                                            <p className="text-sm text-gray-600">Tipo de Abono</p>
                                            <p className="font-semibold">{CONFIGURACIONES_ABONOS[tipoAbono].descripcion}</p>
                                        </div>

                                        <div className="pb-3 border-b">
                                            <p className="text-sm text-gray-600">Período</p>
                                            <p className="text-sm">{fechaInicio}</p>
                                            <p className="text-sm">{calcularFechaFin()}</p>
                                        </div>

                                        <div className="pt-3 bg-blue-50 p-4 rounded-lg">
                                            <p className="text-sm text-gray-600">Total</p>
                                            <p className="text-2xl font-bold text-blue-600">
                                                ${precioTotal.toLocaleString('es-AR')}
                                            </p>
                                        </div>
                                    </>
                                ) : null}
                            </>
                        )}

                        {paso === 'buscar' && (
                            <div className="text-center py-8 text-gray-400">
                                <p className="text-sm">Busca o crea un conductor para comenzar</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
```

### 4.2 Archivo: `app/dashboard/crear-abono/page.tsx`

```typescript
"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { CrearAbonoPanel } from "@/components/abonos/crear-abono-panel";
import { useUserRole } from "@/lib/use-user-role";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function CrearAbonoPage() {
    const { isEmployee, loading: roleLoading } = useUserRole();
    const [estacionamientoId, setEstacionamientoId] = useState<number | null>(null);
    const [estacionamientoNombre, setEstacionamientoNombre] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Obtener estacionamiento del playero
        const fetchEstacionamiento = async () => {
            try {
                const response = await fetch('/api/playero/estacionamiento');
                const data = await response.json();

                if (data.success && data.estacionamiento) {
                    setEstacionamientoId(data.estacionamiento.est_id);
                    setEstacionamientoNombre(data.estacionamiento.est_nombre);
                } else {
                    setError('No se pudo obtener el estacionamiento asignado');
                }
            } catch (err) {
                console.error('Error fetching estacionamiento:', err);
                setError('Error al cargar datos');
            } finally {
                setLoading(false);
            }
        };

        if (isEmployee && !roleLoading) {
            fetchEstacionamiento();
        }
    }, [isEmployee, roleLoading]);

    // Verificar acceso
    if (!isEmployee && !roleLoading) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center">
                    <Alert variant="destructive" className="max-w-md">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            No tienes permisos para acceder a esta página.
                        </AlertDescription>
                    </Alert>
                </div>
            </DashboardLayout>
        );
    }

    if (loading || roleLoading) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center">
                    <p className="text-gray-600">Cargando...</p>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !estacionamientoId) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center">
                    <Alert variant="destructive" className="max-w-md">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error || 'No se pudo cargar la información del estacionamiento'}
                        </AlertDescription>
                    </Alert>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="border-b bg-card">
                    <div className="px-6 py-4">
                        <h1 className="text-2xl font-bold text-gray-900">Crear Abono</h1>
                        <p className="text-gray-600 mt-1">
                            Registra nuevos conductores y crea abonos de estacionamiento
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <CrearAbonoPanel
                        estacionamientoId={estacionamientoId}
                        estacionamientoNombre={estacionamientoNombre}
                    />
                </div>
            </div>
        </DashboardLayout>
    );
}
```

---

## 5. Validaciones y Reglas de Negocio

### 5.1 Validaciones de Datos

```typescript
// lib/validations/abonos.ts

export class ValidacionAbonos {

    static validarEmail(email: string): boolean {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    static validarDNI(dni: string): boolean {
        // DNI argentino: 8 dígitos
        return /^\d{8}$/.test(dni);
    }

    static validarPatente(patente: string): boolean {
        // Patente Argentina:
        // Vieja: ABC123
        // Nueva: AB123CD
        const patenteVieja = /^[A-Z]{3}\d{3}$/i;
        const patenteNueva = /^[A-Z]{2}\d{3}[A-Z]{2}$/i;
        return patenteVieja.test(patente) || patenteNueva.test(patente);
    }

    static validarTelefono(telefono: string): boolean {
        // Teléfono argentino: 10 dígitos (con código de área)
        return /^\d{10}$/.test(telefono.replace(/\s/g, ''));
    }

    static calcularFechaFin(fechaInicio: string, tipoAbono: TipoAbono): string {
        const inicio = new Date(fechaInicio);
        const config = CONFIGURACIONES_ABONOS[tipoAbono];
        const fin = new Date(inicio);
        fin.setMonth(fin.getMonth() + config.duracionMeses);
        return fin.toISOString();
    }

    static validarFechasAbono(fechaInicio: string, fechaFin: string): boolean {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const hoy = new Date();

        // Fecha de inicio no puede ser anterior a hoy
        if (inicio < hoy) return false;

        // Fecha de fin debe ser posterior a fecha de inicio
        if (fin <= inicio) return false;

        return true;
    }
}
```

### 5.2 Reglas de Negocio

1. **Conductor**:
   - Email único en el sistema
   - DNI único en el sistema
   - Debe tener al menos 1 vehículo registrado

2. **Vehículo**:
   - Patente única en el sistema
   - Debe pertenecer a un conductor

3. **Abono**:
   - Solo puede ser creado por un playero
   - Debe estar asociado a un estacionamiento
   - Fecha de inicio no puede ser anterior a hoy
   - Fecha de fin debe ser calculada según tipo de abono

4. **Pagos** (futura implementación):
   - Crear registro de pago al crear abono
   - Asociar método de pago
   - Generar comprobante

---

## 6. Flujo de Trabajo Detallado

### Caso 1: Crear conductor nuevo con abono

```
1. Playero ingresa a /dashboard/crear-abono
2. Busca conductor por email o DNI → No encontrado
3. Sistema muestra formulario de creación
4. Playero completa:
   - Datos del conductor (nombre, apellido, email, telefono, DNI)
   - Vehículos (mínimo 1): patente, tipo, marca, modelo, color
5. Playero configura abono:
   - Tipo: mensual/trimestral/semestral/anual
   - Fecha de inicio
6. Sistema calcula fecha de fin automáticamente
7. Playero revisa resumen en panel derecho
8. Playero confirma creación
9. API valida todos los datos
10. API crea en transacción:
    a. Usuario en tabla usuario
    b. Conductor en tabla conductores
    c. Vehículo(s) en tabla vehiculos
    d. Abonado en tabla abonado
    e. Abono en tabla abonos
11. Sistema muestra confirmación con datos del abono
12. Opción de imprimir ticket
```

### Caso 2: Crear abono para conductor existente

```
1. Playero ingresa a /dashboard/crear-abono
2. Busca conductor por email o DNI → Encontrado
3. Sistema carga datos del conductor y vehículos existentes
4. Playero va directamente a configuración de abono
5. Selecciona tipo y fecha de inicio
6. Sistema calcula fecha de fin
7. Playero confirma
8. API crea solo:
   a. Abonado (si no existe)
   b. Abono
9. Confirmación y ticket
```

---

## 7. Tests y Casos de Prueba

### 7.1 Tests Unitarios

```typescript
// tests/unit/validaciones.test.ts

import { ValidacionAbonos } from '@/lib/validations/abonos';

describe('ValidacionAbonos', () => {

    test('validarEmail - válido', () => {
        expect(ValidacionAbonos.validarEmail('test@example.com')).toBe(true);
    });

    test('validarEmail - inválido', () => {
        expect(ValidacionAbonos.validarEmail('test@')).toBe(false);
        expect(ValidacionAbonos.validarEmail('test')).toBe(false);
    });

    test('validarDNI - válido', () => {
        expect(ValidacionAbonos.validarDNI('12345678')).toBe(true);
    });

    test('validarDNI - inválido', () => {
        expect(ValidacionAbonos.validarDNI('1234567')).toBe(false); // 7 dígitos
        expect(ValidacionAbonos.validarDNI('123456789')).toBe(false); // 9 dígitos
    });

    test('validarPatente - válida vieja', () => {
        expect(ValidacionAbonos.validarPatente('ABC123')).toBe(true);
    });

    test('validarPatente - válida nueva', () => {
        expect(ValidacionAbonos.validarPatente('AB123CD')).toBe(true);
    });

    test('validarPatente - inválida', () => {
        expect(ValidacionAbonos.validarPatente('A12345')).toBe(false);
    });
});
```

### 7.2 Tests de Integración

```typescript
// tests/integration/abonos.test.ts

describe('POST /api/abonos/create-conductor', () => {

    test('Crear conductor con abono - éxito', async () => {
        const request = {
            conductor: {
                nombre: 'Juan',
                apellido: 'Pérez',
                email: 'juan.perez@test.com',
                telefono: '1234567890',
                dni: '12345678'
            },
            vehiculos: [{
                patente: 'ABC123',
                tipo: 'Auto',
                marca: 'Toyota',
                modelo: 'Corolla',
                color: 'Rojo'
            }],
            abono: {
                est_id: 1,
                tipoAbono: 'mensual',
                fechaInicio: '2025-01-15',
                fechaFin: '2025-02-15'
            }
        };

        const response = await fetch('/api/abonos/create-conductor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.data.usuario_id).toBeDefined();
        expect(data.data.abono_nro).toBeDefined();
    });

    test('Crear conductor - email duplicado', async () => {
        // Primero crear un conductor
        // ...

        // Intentar crear otro con mismo email
        const request = {
            conductor: {
                nombre: 'Pedro',
                apellido: 'González',
                email: 'juan.perez@test.com', // Email duplicado
                telefono: '9876543210',
                dni: '87654321'
            },
            // ... resto de datos
        };

        const response = await fetch('/api/abonos/create-conductor', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request)
        });

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toContain('email');
    });
});
```

---

## 8. Archivos a Crear/Modificar

### Nuevos Archivos

```
app/
  api/
    abonos/
      create-conductor/
        route.ts                          # Endpoint principal
    conductor/
      search/
        route.ts                          # Búsqueda de conductores
  dashboard/
    crear-abono/
      page.tsx                            # Página principal

components/
  abonos/
    crear-abono-panel.tsx                 # Componente principal

lib/
  validations/
    abonos.ts                             # Validaciones

tests/
  unit/
    validaciones.test.ts
  integration/
    abonos.test.ts
```

### Archivos Modificados

```
lib/types.ts                              # Agregar tipos de abonos
```

---

## 9. Dependencias y Configuración

### Dependencias NPM (ya instaladas)

```json
{
  "@supabase/ssr": "latest",
  "next": "latest",
  "react": "latest",
  "lucide-react": "latest"
}
```

### Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 10. Próximos Pasos (Post-MVP)

1. **Integración de Pagos**:
   - Registrar pago al crear abono
   - Generar comprobante
   - Integrar con MercadoPago

2. **Gestión de Abonos**:
   - Visualizar abonos activos
   - Renovar abonos
   - Cancelar abonos
   - Historial de abonos

3. **Notificaciones**:
   - Email de bienvenida al conductor
   - Recordatorio de vencimiento
   - Confirmación de renovación

4. **Reportes**:
   - Abonos por período
   - Ingresos por abonos
   - Conductores activos

5. **Mejoras UX**:
   - Autocompletado de datos
   - Escaneo de DNI/patente
   - Firma digital

---

## 11. Cronograma de Implementación

| Fase | Tareas | Tiempo Estimado |
|------|--------|-----------------|
| 1 | Tipos TypeScript + Validaciones | 2 horas |
| 2 | API Endpoint: create-conductor | 4 horas |
| 3 | API Endpoint: search conductor | 1 hora |
| 4 | Componente: CrearAbonoPanel | 6 horas |
| 5 | Página: crear-abono | 2 horas |
| 6 | Tests unitarios | 2 horas |
| 7 | Tests de integración | 3 horas |
| 8 | Ajustes y debugging | 2 horas |
| **Total** | | **22 horas** |

---

## 12. Checklist de Implementación

- [ ] Crear tipos TypeScript en `lib/types.ts`
- [ ] Crear validaciones en `lib/validations/abonos.ts`
- [ ] Crear endpoint POST `/api/abonos/create-conductor`
- [ ] Crear endpoint GET `/api/conductor/search`
- [ ] Crear componente `CrearAbonoPanel`
- [ ] Crear página `/dashboard/crear-abono`
- [ ] Implementar flujo de búsqueda de conductores
- [ ] Implementar formulario de creación de conductor
- [ ] Implementar formulario de vehículos (agregar/eliminar)
- [ ] Implementar configuración de abonos
- [ ] Implementar panel de resumen
- [ ] Implementar validaciones frontend
- [ ] Implementar manejo de errores
- [ ] Implementar confirmación exitosa
- [ ] Agregar botón de imprimir ticket
- [ ] Escribir tests unitarios
- [ ] Escribir tests de integración
- [ ] Realizar pruebas manuales completas
- [ ] Documentar código
- [ ] Code review
- [ ] Deploy a staging
- [ ] QA testing
- [ ] Deploy a producción

---

## 13. Notas Adicionales

### Seguridad

- Validar rol de playero en todos los endpoints
- Sanitizar inputs antes de insertar en DB
- Usar transacciones para operaciones múltiples
- Implementar rate limiting en endpoints

### Performance

- Usar índices en columnas de búsqueda (email, DNI, patente)
- Paginar resultados si hay muchos conductores
- Cachear configuraciones de abonos

### Accesibilidad

- Labels en todos los inputs
- Mensajes de error claros
- Soporte para navegación por teclado
- Contraste de colores adecuado

### Internacionalización

- Por ahora solo español (Argentina)
- Preparar estructura para futura i18n
- Usar formato de fechas local (DD/MM/YYYY)
- Usar formato de moneda local ($ARS)
