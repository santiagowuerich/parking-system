"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Trash2, User, Car, Calendar, DollarSign, CheckCircle, AlertCircle, Loader2, MapPin } from "lucide-react";
import {
    ConductorConVehiculos,
    VehiculoFormData,
    TipoAbono,
    CONFIGURACIONES_ABONOS,
    CrearConductorConAbonoRequest,
    CrearConductorConAbonoResponse,
    PlazaInfo
} from "@/lib/types";
import { ZonaPlazaSelector } from "./zona-plaza-selector";
import PaymentMethodSelector from "@/components/payment-method-selector";
import TransferInfoDialog from "@/components/transfer-info-dialog";

interface CrearAbonoPanelProps {
    estacionamientoId: number;
    estacionamientoNombre: string;
}

type Paso = 'datos-conductor' | 'confirmacion-pago' | 'confirmacion';

export function CrearAbonoPanel({ estacionamientoId, estacionamientoNombre }: CrearAbonoPanelProps) {
    // ========================================
    // ESTADO
    // ========================================
    const [paso, setPaso] = useState<Paso>('datos-conductor');
    const [buscando, setBuscando] = useState(false);
    const [conductorExistente, setConductorExistente] = useState<ConductorConVehiculos | null>(null);
    const [conductorEncontrado, setConductorEncontrado] = useState<boolean | null>(null); // null = no buscado, true = encontrado, false = no encontrado

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

    // Formulario de nuevo vehículo
    const [nuevoVehiculoPatente, setNuevoVehiculoPatente] = useState('');
    const [nuevoVehiculoTipo, setNuevoVehiculoTipo] = useState<'Auto' | 'Moto' | 'Camioneta'>('Auto');
    const [nuevoVehiculoMarca, setNuevoVehiculoMarca] = useState('');
    const [nuevoVehiculoModelo, setNuevoVehiculoModelo] = useState('');
    const [nuevoVehiculoColor, setNuevoVehiculoColor] = useState('');

    // Configuración del abono
    const [tipoAbono, setTipoAbono] = useState<TipoAbono>('mensual');
    const [cantidadDuracion, setCantidadDuracion] = useState<number>(1);
    const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);

    // Estado de la UI
    const [error, setError] = useState('');
    const [creando, setCreando] = useState(false);
    const [abonoCreado, setAbonoCreado] = useState<any>(null);

    // Estados para selección de plaza
    const [plazaSeleccionada, setPlazaSeleccionada] = useState<PlazaInfo | null>(null);
    const [showZonaPlazaModal, setShowZonaPlazaModal] = useState(false);

    // Estados para sistema de pagos
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [paymentData, setPaymentData] = useState<any>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<any>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);

    // ========================================
    // FUNCIONES DE BÚSQUEDA AUTOMÁTICA
    // ========================================
    const buscarConductorAutomatico = async (query: string) => {
        if (!query.trim()) {
            setConductorExistente(null);
            setConductorEncontrado(null);
            return;
        }

        setBuscando(true);

        try {
            const response = await fetch(`/api/conductor/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Conductor encontrado
                setConductorExistente(data.data);
                setConductorEncontrado(true);

                // Pre-llenar datos automáticamente
                setNombre(data.data.usu_nom);
                setApellido(data.data.usu_ape);
                setEmail(data.data.usu_email);
                setTelefono(data.data.usu_tel || '');
                setDni(data.data.usu_dni);

                // Cargar vehículos encontrados
                if (data.data.vehiculos && data.data.vehiculos.length > 0) {
                    const vehiculosFormato = data.data.vehiculos.map((v: any) => ({
                        patente: v.veh_patente || '',
                        tipo: v.catv_segmento === 'MOT' ? 'Moto' : v.catv_segmento === 'CAM' ? 'Camioneta' : 'Auto',
                        marca: v.veh_marca || '',
                        modelo: v.veh_modelo || '',
                        color: v.veh_color || ''
                    }));
                    setVehiculos(vehiculosFormato);
                } else {
                    // Si no tiene vehículos, resetear a uno vacío
                    setVehiculos([{ patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }]);
                }
            } else {
                // Conductor no encontrado
                setConductorExistente(null);
                setConductorEncontrado(false);
            }
        } catch (err) {
            console.error('Error buscando conductor:', err);
            setConductorEncontrado(null);
        } finally {
            setBuscando(false);
        }
    };

    // Debounce para la búsqueda automática
    useEffect(() => {
        const timer = setTimeout(() => {
            // Solo buscar si el DNI tiene 8 dígitos o si el email tiene formato válido
            const dniValido = dni.length === 8 && /^\d{8}$/.test(dni);
            const emailValido = email.includes('@') && email.includes('.');

            if (dniValido) {
                buscarConductorAutomatico(dni);
            } else if (emailValido) {
                buscarConductorAutomatico(email);
            } else {
                setConductorEncontrado(null);
                setConductorExistente(null);
            }
        }, 500); // 500ms de debounce

        return () => clearTimeout(timer);
    }, [dni, email]);

    // ========================================
    // FUNCIONES DE VEHÍCULOS
    // ========================================
    const agregarVehiculoDesdeFormulario = () => {
        if (!nuevoVehiculoPatente || !nuevoVehiculoMarca || !nuevoVehiculoModelo || !nuevoVehiculoColor) {
            setError('Complete todos los campos del vehículo');
            return;
        }

        const nuevoVehiculo: VehiculoFormData = {
            patente: nuevoVehiculoPatente.toUpperCase(),
            tipo: nuevoVehiculoTipo,
            marca: nuevoVehiculoMarca,
            modelo: nuevoVehiculoModelo,
            color: nuevoVehiculoColor
        };

        // Si el primer vehículo está vacío, reemplazarlo
        if (vehiculos.length === 1 && vehiculos[0].patente === '') {
            setVehiculos([nuevoVehiculo]);
        } else {
            setVehiculos([...vehiculos, nuevoVehiculo]);
        }

        // Limpiar formulario
        setNuevoVehiculoPatente('');
        setNuevoVehiculoTipo('Auto' as const);
        setNuevoVehiculoMarca('');
        setNuevoVehiculoModelo('');
        setNuevoVehiculoColor('');
        setError('');
    };

    const eliminarVehiculo = (index: number) => {
        if (vehiculos.length > 1) {
            setVehiculos(vehiculos.filter((_, i) => i !== index));
        } else {
            // Si es el último vehículo, resetear a uno vacío
            setVehiculos([{ patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }]);
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

        if (config.unidad === 'semanas') {
            fin.setDate(fin.getDate() + (cantidadDuracion * 7));
        } else { // meses
            fin.setMonth(fin.getMonth() + cantidadDuracion);
        }

        return fin.toISOString().split('T')[0];
    };

    const precioTotal = CONFIGURACIONES_ABONOS[tipoAbono].precioUnitario * cantidadDuracion;

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
    // REINICIAR FORMULARIO
    // ========================================
    const reiniciar = () => {
        setConductorExistente(null);
        setConductorEncontrado(null);
        setNombre('');
        setApellido('');
        setEmail('');
        setTelefono('');
        setDni('');
        setVehiculos([{ patente: '', tipo: 'Auto', marca: '', modelo: '', color: '' }]);
        setNuevoVehiculoPatente('');
        setNuevoVehiculoTipo('Auto' as const);
        setNuevoVehiculoMarca('');
        setNuevoVehiculoModelo('');
        setNuevoVehiculoColor('');
        setTipoAbono('mensual');
        setCantidadDuracion(1);
        setFechaInicio(new Date().toISOString().split('T')[0]);
        setError('');
        setAbonoCreado(null);
        setPlazaSeleccionada(null);
        setShowZonaPlazaModal(false);
        setShowPaymentSelector(false);
        setShowTransferDialog(false);
        setPaymentData(null);
        setSelectedPaymentMethod(null);
        setPaymentLoading(false);
        setPaso('datos-conductor');
    };

    // ========================================
    // FUNCIONES DE SELECCIÓN DE PLAZA
    // ========================================
    const handleSelectPlaza = (plaza: PlazaInfo) => {
        setPlazaSeleccionada(plaza);
        setShowZonaPlazaModal(false);
        // No cambiar de paso aquí, solo cerrar el modal
        // El flujo continuará desde donde se abrió el modal
    };

    // ========================================
    // FUNCIONES DE PAGO
    // ========================================
    const handlePaymentMethodSelect = (method: any) => {
        setSelectedPaymentMethod(method);
        setShowPaymentSelector(false);

        if (method === 'efectivo') {
            // Crear abono inmediatamente para efectivo
            crearAbonoConPago('efectivo');
        } else if (method === 'transferencia') {
            // Mostrar modal de transferencia
            setPaymentData({
                amount: precioTotal,
                method: 'transferencia',
                conductor: `${nombre} ${apellido}`,
                dni: dni
            });
            setShowTransferDialog(true);
        }
    };

    const crearAbonoConPago = async (metodoPago: string) => {
        if (!plazaSeleccionada) {
            setError('Debe seleccionar una plaza');
            return;
        }

        setCreando(true);
        setError('');

        try {
            let response;
            let requestBody;

            if (conductorExistente) {
                // CONDUCTOR YA EXISTE - Usar endpoint para conductor existente
                requestBody = {
                    conductor_id: conductorExistente.con_id, // ← CORREGIDO: era usu_id
                    vehiculos: [], // Los vehículos ya están registrados
                    abono: {
                        est_id: estacionamientoId,
                        tipoAbono,
                        fechaInicio,
                        fechaFin: calcularFechaFin(),
                        plaza: {
                            pla_numero: plazaSeleccionada.pla_numero,
                            est_id: plazaSeleccionada.est_id
                        }
                    }
                };

                response = await fetch('/api/abonos/create-for-existing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
            } else {
                // CONDUCTOR NUEVO - Usar endpoint original
                requestBody = {
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
                        fechaFin: calcularFechaFin(),
                        plaza: {
                            pla_numero: plazaSeleccionada.pla_numero,
                            est_id: plazaSeleccionada.est_id
                        }
                    }
                };

                console.log('📦 Datos enviados a create-conductor:', JSON.stringify(requestBody, null, 2));
                response = await fetch('/api/abonos/create-conductor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
            }

            const data = await response.json();

            if (data.success && data.data) {
                setAbonoCreado({
                    ...data.data,
                    metodoPago: metodoPago
                });
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
    // RENDERIZADO
    // ========================================
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ============ COLUMNA IZQUIERDA: FORMULARIO ============ */}
            <div className="lg:col-span-2 space-y-6">

                {/* PASO 1: DATOS DEL CONDUCTOR (con búsqueda automática) */}
                {paso === 'datos-conductor' && (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    Datos del Conductor
                                </CardTitle>
                                <CardDescription>
                                    Cargá los datos del conductor. El sistema verificará si ya existe y, de ser así, cargará sus vehículos automáticamente.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="dni">DNI *</Label>
                                        <Input
                                            id="dni"
                                            value={dni}
                                            onChange={(e) => {
                                                setDni(e.target.value.replace(/\D/g, ''));
                                                // Resetear búsqueda cuando cambia manualmente
                                                if (!conductorExistente) {
                                                    setConductorEncontrado(null);
                                                }
                                            }}
                                            maxLength={8}
                                            disabled={conductorExistente !== null}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="email">Correo *</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                setEmail(e.target.value);
                                                // Resetear búsqueda cuando cambia manualmente
                                                if (!conductorExistente) {
                                                    setConductorEncontrado(null);
                                                }
                                            }}
                                            disabled={conductorExistente !== null}
                                        />
                                    </div>
                                </div>

                                {/* Mensaje de búsqueda */}
                                {buscando && (
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                                        <AlertDescription className="text-blue-800">
                                            Buscando conductor...
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Mensaje: Conductor encontrado */}
                                {!buscando && conductorEncontrado === true && (
                                    <Alert className="bg-green-50 border-green-200">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <AlertDescription className="text-green-800">
                                            <strong>Conductor Encontrado - {nombre} {apellido}</strong>
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Mensaje: Conductor no encontrado */}
                                {!buscando && conductorEncontrado === false && (
                                    <Alert className="bg-orange-50 border-orange-200">
                                        <AlertCircle className="h-4 w-4 text-orange-600" />
                                        <AlertDescription className="text-orange-800">
                                            Conductor no encontrado. Se creará un nuevo registro.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="nombre">Nombre *</Label>
                                        <Input
                                            id="nombre"
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            disabled={conductorExistente !== null}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="apellido">Apellido *</Label>
                                        <Input
                                            id="apellido"
                                            value={apellido}
                                            onChange={(e) => setApellido(e.target.value)}
                                            disabled={conductorExistente !== null}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="telefono">Teléfono</Label>
                                    <Input
                                        id="telefono"
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        disabled={conductorExistente !== null}
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Car className="w-5 h-5" />
                                    Vehículo
                                </CardTitle>
                                <CardDescription>
                                    Registra al menos 1 vehículo
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Formulario para agregar vehículo */}
                                <div className="p-4 border rounded-lg space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Patente *</Label>
                                            <Input
                                                value={nuevoVehiculoPatente}
                                                onChange={(e) => setNuevoVehiculoPatente(e.target.value.toUpperCase())}
                                            />
                                        </div>
                                        <div>
                                            <Label>Tipo *</Label>
                                            <Select value={nuevoVehiculoTipo} onValueChange={(value: 'Auto' | 'Moto' | 'Camioneta') => setNuevoVehiculoTipo(value)}>
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
                                                value={nuevoVehiculoMarca}
                                                onChange={(e) => setNuevoVehiculoMarca(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Modelo *</Label>
                                            <Input
                                                value={nuevoVehiculoModelo}
                                                onChange={(e) => setNuevoVehiculoModelo(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Color *</Label>
                                            <Input
                                                value={nuevoVehiculoColor}
                                                onChange={(e) => setNuevoVehiculoColor(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            onClick={agregarVehiculoDesdeFormulario}
                                            variant="outline"
                                            size="sm"
                                            disabled={vehiculos.length >= 5 && !(vehiculos.length === 1 && vehiculos[0].patente === '')}
                                        >
                                            <Plus className="w-4 h-4 mr-1" />
                                            Agregar
                                        </Button>
                                    </div>
                                </div>

                                {/* Lista de vehículos agregados */}
                                {vehiculos.length > 0 && vehiculos[0].patente !== '' && (
                                    <div className="space-y-2">
                                        {vehiculos.map((vehiculo, index) => (
                                            <div key={index} className="p-3 bg-gray-50 border rounded-lg flex justify-between items-center">
                                                <div className="text-sm">
                                                    <p className="font-semibold">{vehiculo.patente} • {vehiculo.tipo} • {vehiculo.marca} {vehiculo.modelo} • {vehiculo.color}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => eliminarVehiculo(index)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-500" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Selección de plaza */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5" />
                                    Plaza
                                </CardTitle>
                                <CardDescription>
                                    Selecciona la plaza para este abono
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {plazaSeleccionada ? (
                                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="text-sm font-semibold text-blue-900">Plaza seleccionada</p>
                                                <p className="text-sm text-blue-800 mt-1">Zona {plazaSeleccionada.zona || 'A'} - Nº {plazaSeleccionada.pla_numero}</p>
                                                <p className="text-xs text-blue-600 mt-1">Tipo: {plazaSeleccionada.catv_segmento}</p>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setShowZonaPlazaModal(true)}>
                                                Cambiar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <Button onClick={() => setShowZonaPlazaModal(true)} className="w-full">
                                        <MapPin className="w-4 h-4 mr-2" />
                                        Seleccionar Plaza
                                    </Button>
                                )}
                            </CardContent>
                        </Card>

                        {/* Configuración del abono */}
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="tipoAbono">Tipo de abono y duración</Label>
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
                                        <Label htmlFor="cantidadDuracion">
                                            Cantidad ({CONFIGURACIONES_ABONOS[tipoAbono].unidad})
                                        </Label>
                                        <Input
                                            id="cantidadDuracion"
                                            type="number"
                                            min="1"
                                            max="52"
                                            value={cantidadDuracion}
                                            onChange={(e) => setCantidadDuracion(Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </div>
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

                                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                                    <p className="text-sm text-gray-600">
                                        <strong>Duración:</strong> {cantidadDuracion} {CONFIGURACIONES_ABONOS[tipoAbono].unidad}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                        <strong>Fecha de fin:</strong> {calcularFechaFin()}
                                    </p>
                                    <p className="text-lg font-bold text-blue-600">
                                        Total: ${precioTotal.toLocaleString('es-AR')}
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
                            <Button variant="outline" onClick={reiniciar}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => {
                                    // Validar que haya al menos un vehículo con datos
                                    if (!vehiculos[0]?.patente) {
                                        setError('Debes agregar al menos un vehículo');
                                        return;
                                    }
                                    // Validar que haya una plaza seleccionada
                                    if (!plazaSeleccionada) {
                                        setError('Debes seleccionar una plaza');
                                        return;
                                    }
                                    // Validar formulario completo
                                    const errorValidacion = validarFormulario();
                                    if (errorValidacion) {
                                        setError(errorValidacion);
                                        return;
                                    }
                                    // Ir directo a confirmación de pago
                                    setError('');
                                    setPaso('confirmacion-pago');
                                }}
                                disabled={!plazaSeleccionada || !vehiculos[0]?.patente}
                            >
                                Continuar a Pago
                            </Button>
                        </div>
                    </>
                )}

                {/* PASO 2: CONFIRMACIÓN DE PAGO */}
                {paso === 'confirmacion-pago' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                Confirmación de Pago
                            </CardTitle>
                            <CardDescription>
                                Selecciona el método de pago para el abono
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Resumen del abono */}
                            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                                <p><strong>Conductor:</strong> {nombre} {apellido}</p>
                                <p><strong>DNI:</strong> {dni}</p>
                                <p><strong>Email:</strong> {email}</p>
                                <p><strong>Tipo de Abono:</strong> {CONFIGURACIONES_ABONOS[tipoAbono].descripcion}</p>
                                <p><strong>Vigencia:</strong> {fechaInicio} hasta {calcularFechaFin()}</p>
                                <p><strong>Plaza:</strong> {plazaSeleccionada?.pla_numero}</p>
                                <p><strong>Total:</strong> ${precioTotal.toLocaleString('es-AR')}</p>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setPaso('datos-conductor')}>
                                    Atrás
                                </Button>
                                <Button onClick={() => setShowPaymentSelector(true)} disabled={creando}>
                                    {creando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {creando ? 'Procesando...' : 'Seleccionar Método de Pago'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* PASO 6: CONFIRMACIÓN */}
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
                                <p><strong>Plaza:</strong> {plazaSeleccionada?.pla_numero}</p>
                                <p><strong>Método de Pago:</strong> {abonoCreado.metodoPago}</p>
                                <p><strong>Total:</strong> ${precioTotal.toLocaleString('es-AR')}</p>

                                {/* Solo mostrar credenciales si es un CONDUCTOR NUEVO */}
                                {!conductorExistente && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-800">
                                            <strong>🔑 Credenciales de acceso:</strong><br />
                                            El conductor puede iniciar sesión con:<br />
                                            Email: {email}<br />
                                            Contraseña inicial: <strong>{dni}</strong>
                                        </p>
                                    </div>
                                )}
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
                        {!nombre && !conductorExistente && (
                            <div className="text-center py-8 text-gray-400">
                                <p>Busca o crea un conductor para comenzar</p>
                            </div>
                        )}

                        {(nombre || conductorExistente) && (
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

                                {plazaSeleccionada && (
                                    <div className="pb-3 border-b">
                                        <p className="text-xs text-gray-600">Plaza</p>
                                        <p className="font-semibold">Nº {plazaSeleccionada.pla_numero}</p>
                                        <p className="text-xs text-gray-600">Zona {plazaSeleccionada.zona || 'A'}</p>
                                    </div>
                                )}

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
                    </CardContent>
                </Card>
            </div>

            {/* ============ MODALES ============ */}

            {/* Modal de selección de zona y plaza */}
            <ZonaPlazaSelector
                isOpen={showZonaPlazaModal}
                estacionamientoId={estacionamientoId}
                estacionamientoNombre={estacionamientoNombre}
                onSelectPlaza={handleSelectPlaza}
                onCancel={() => setShowZonaPlazaModal(false)}
            />

            {/* Modal de selección de método de pago */}
            <PaymentMethodSelector
                isOpen={showPaymentSelector}
                onClose={() => setShowPaymentSelector(false)}
                onSelectMethod={handlePaymentMethodSelect}
                paymentData={{
                    amount: precioTotal,
                    vehicleLicensePlate: vehiculos[0]?.patente || 'ABONO',
                    paymentId: 'abono-' + Date.now().toString(),
                    duration: CONFIGURACIONES_ABONOS[tipoAbono].descripcion
                } as any}
                loading={paymentLoading}
                paymentSettings={{
                    efectivo: { enabled: true },
                    transfer: { enabled: true, cbu: '0170020510000001234567', alias: 'PARKING.EJEMPLO' },
                    mercadopago: { enabled: false, accessToken: 'test', publicKey: 'test' }
                }}
            />

            {/* Modal de transferencia */}
            <TransferInfoDialog
                isOpen={showTransferDialog}
                onClose={() => setShowTransferDialog(false)}
                onConfirmTransfer={async () => {
                    setPaymentLoading(true);
                    try {
                        await crearAbonoConPago('transferencia');
                        setShowTransferDialog(false);
                    } catch (error) {
                        console.error('Error confirmando transferencia:', error);
                        setError('Error al confirmar transferencia');
                    } finally {
                        setPaymentLoading(false);
                    }
                }}
                paymentData={{
                    amount: precioTotal,
                    vehicleLicensePlate: vehiculos[0]?.patente || 'ABONO',
                    paymentId: 'abono-' + Date.now().toString(),
                    duration: CONFIGURACIONES_ABONOS[tipoAbono].descripcion
                } as any}
                transferConfig={{
                    cbu: '0170020510000001234567',
                    alias: 'PARKING.EJEMPLO',
                    accountHolder: 'Estacionamiento Ejemplo S.A.',
                    bank: 'Banco Ejemplo'
                }}
                loading={paymentLoading}
            />
        </div>
    );
}
