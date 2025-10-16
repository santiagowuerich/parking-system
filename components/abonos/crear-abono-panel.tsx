"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, User, Car, Calendar, DollarSign, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
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
                setNombre('');
                setApellido('');
                setEmail(busqueda.includes('@') ? busqueda : '');
                setTelefono('');
                setDni(busqueda.match(/^\d{8}$/) ? busqueda : '');
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
                                    {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
                                        <Label htmlFor="dni">DNI *</Label>
                                        <Input
                                            id="dni"
                                            value={dni}
                                            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                                            placeholder="12345678"
                                            maxLength={8}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="email">Correo *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="juan@email.com"
                                        />
                                    </div>
                                </div>

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
                                    <Label htmlFor="telefono">Teléfono</Label>
                                    <Input
                                        id="telefono"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        placeholder="1234567890"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Car className="w-5 h-5" />
                                            Vehículo (manual)
                                        </CardTitle>
                                        <CardDescription>
                                            Registra al menos 1 vehículo
                                        </CardDescription>
                                    </div>
                                    {vehiculos.length < 5 && (
                                        <Button onClick={agregarVehiculo} variant="outline" size="sm">
                                            <Plus className="w-4 h-4 mr-1" />
                                            Agregar
                                        </Button>
                                    )}
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
                                                    onValueChange={(valor: any) => actualizarVehiculo(index, 'tipo', valor)}
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
                                Continuar
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
                                    <Select value={tipoAbono} onValueChange={(v: any) => setTipoAbono(v)}>
                                        <SelectTrigger id="tipoAbono">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(CONFIGURACIONES_ABONOS).map(([key, config]) => (
                                                <SelectItem key={key} value={key}>
                                                    {config.descripcion}
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
                                {creando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
                            <div className="bg-green-50 p-4 rounded-lg space-y-2 text-sm">
                                <p><strong>Conductor:</strong> {nombre} {apellido}</p>
                                <p><strong>DNI:</strong> {dni}</p>
                                <p><strong>Email:</strong> {email}</p>
                                <p><strong>Abono Nº:</strong> {abonoCreado.abono_nro}</p>
                                <p><strong>Tipo:</strong> {CONFIGURACIONES_ABONOS[tipoAbono].descripcion}</p>
                                <p><strong>Vigencia:</strong> {fechaInicio} hasta {calcularFechaFin()}</p>
                                <p><strong>Vehículos:</strong> {abonoCreado.vehiculo_ids.join(', ')}</p>
                            </div>

                            <div className="flex gap-2">
                                <Button onClick={reiniciar}>
                                    Crear Otro Abono
                                </Button>
                                <Button variant="outline" onClick={() => window.print()}>
                                    Imprimir
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
                    <CardContent className="space-y-4 text-sm">
                        {paso === 'buscar' && (
                            <div className="text-center py-8 text-gray-400">
                                <p>Busca o crea un conductor para comenzar</p>
                            </div>
                        )}

                        {paso !== 'buscar' && (
                            <>
                                <div className="pb-3 border-b">
                                    <p className="text-xs text-gray-600">Estacionamiento</p>
                                    <p className="font-semibold">{estacionamientoNombre}</p>
                                </div>

                                {(nombre || conductorExistente) && (
                                    <div className="pb-3 border-b">
                                        <p className="text-xs text-gray-600">Conductor</p>
                                        <p className="font-semibold">{nombre} {apellido}</p>
                                        {dni && <p className="text-xs text-gray-600">DNI: {dni}</p>}
                                        {email && <p className="text-xs text-gray-600">{email}</p>}
                                    </div>
                                )}

                                {vehiculos.some(v => v.patente) && (
                                    <div className="pb-3 border-b">
                                        <p className="text-xs text-gray-600 mb-2">Vehículos</p>
                                        {vehiculos.filter(v => v.patente).map((v, i) => (
                                            <p key={i} className="text-xs">
                                                {v.patente} - {v.tipo}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {(paso === 'configurar-abono' || paso === 'confirmacion') && (
                                    <>
                                        <div className="pb-3 border-b">
                                            <p className="text-xs text-gray-600">Tipo de Abono</p>
                                            <p className="font-semibold">{CONFIGURACIONES_ABONOS[tipoAbono].descripcion}</p>
                                        </div>

                                        <div className="pb-3 border-b">
                                            <p className="text-xs text-gray-600">Período</p>
                                            <p className="text-xs">{fechaInicio}</p>
                                            <p className="text-xs">{calcularFechaFin()}</p>
                                        </div>

                                        <div className="pt-3 bg-blue-50 p-3 rounded-lg">
                                            <p className="text-xs text-gray-600">Total</p>
                                            <p className="text-lg font-bold text-blue-600">
                                                ${precioTotal.toLocaleString('es-AR')}
                                            </p>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
