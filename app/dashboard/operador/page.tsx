"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, ArrowRight, Plus, Search } from "lucide-react";
import { ListaReservasOperador } from "@/components/reservas/lista-reservas-operador";
import { BuscarReservaDialog } from "@/components/reservas/buscar-reserva-dialog";
import IngresoModal from "@/components/ingreso-modal";
import VehicleSelectorModal from "@/components/vehicle-selector-modal";
import { toast } from "@/components/ui/use-toast";
import { createBrowserClient } from "@supabase/ssr";
import type { VehicleType, VehicleEntryData, Vehicle, PaymentMethod, PaymentData } from "@/lib/types";
import type { PaymentStatus } from "@/lib/types/payment";
import PaymentMethodSelector from "@/components/payment-method-selector";
import TransferInfoDialog from "@/components/transfer-info-dialog";
import QRPaymentDialog from "@/components/qr-payment-dialog";
import { generatePaymentId, formatCurrency } from "@/lib/utils/payment-utils";
import { formatDuration } from "@/lib/utils";
import { calculateParkingFee } from "@/lib/tariff-calculator";
import { useTurnos } from "@/lib/hooks/use-turnos";
import { TurnoGuard } from "@/components/turno-guard";
import dayjs from "dayjs";
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Componente de reloj pequeño
const Clock = () => {
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        const updateTime = () => {
            const now = dayjs().tz('America/Argentina/Buenos_Aires');
            setCurrentTime(now.format('HH:mm:ss'));
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-lg border">
            <span className="text-sm font-medium text-gray-700">🇦🇷</span>
            <span className="text-sm font-mono text-gray-900">{currentTime}</span>
        </div>
    );
};

export default function OperadorPage() {
    const { user, estId, parkedVehicles, parkingCapacity, fetchUserData, refreshParkedVehicles, refreshCapacity } = useAuth();
    const { canOperateParking, loading: roleLoading } = useUserRole();
    const { puedeOperar, isEmployee } = useTurnos();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ingreso');

    // Estados para reservas
    const [buscarReservaOpen, setBuscarReservaOpen] = useState(false);
    const [vistaActual, setVistaActual] = useState<'ingresos' | 'reservas'>('ingresos');

    // Estados para los modales
    const [showIngresoModal, setShowIngresoModal] = useState(false);
    const [showVehicleSelectorModal, setShowVehicleSelectorModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [availableTariffs, setAvailableTariffs] = useState<any[]>([]);
    const [availablePlazas, setAvailablePlazas] = useState<any[]>([]);

    // Estados para egreso
    const [selectedVehicleForExit, setSelectedVehicleForExit] = useState<Vehicle | null>(null);
    const [vehiclesList, setVehiclesList] = useState<Vehicle[]>([]);
    const [processingExit, setProcessingExit] = useState<string | null>(null);

    // Estados para el sistema de pagos
    const [showPaymentSelector, setShowPaymentSelector] = useState(false);
    const [showTransferDialog, setShowTransferDialog] = useState(false);
    const [showQRDialog, setShowQRDialog] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [qrPaymentStatus, setQRPaymentStatus] = useState<PaymentStatus>('pendiente');
    const [qrData, setQrData] = useState<{ qrCode: string, qrCodeImage: string, preferenceId: string } | null>(null);

    // Configuración de métodos de pago
    const [paymentSettings, setPaymentSettings] = useState<any>(null);

    // Estados para filtros de tabla
    const [filterPlate, setFilterPlate] = useState<string>("");
    const [filterVehicleType, setFilterVehicleType] = useState<VehicleType | 'Todos'>("Todos");

    // Verificar permisos
    useEffect(() => {
        if (!roleLoading && !canOperateParking) {
            const timeoutId = setTimeout(() => {
                router.push('/dashboard');
            }, 2000); // Debounce extendido de 2 segundos

            return () => clearTimeout(timeoutId);
        }
    }, [canOperateParking, roleLoading, router]);

    // Cargar datos del usuario y estacionamiento cuando estén disponibles
    useEffect(() => {
        if (user?.id && estId && !roleLoading) {
            fetchUserData();
        }
    }, [user?.id, estId, roleLoading, fetchUserData]);

    useEffect(() => {
        if (user && estId) {
            setLoading(false);
        }
    }, [user, estId]);

    // Cargar lista de vehículos estacionados
    useEffect(() => {
        if (parkedVehicles) {
            setVehiclesList(parkedVehicles);
        }
    }, [parkedVehicles]);

    // Cargar configuración de métodos de pago
    useEffect(() => {
        if (!estId) return;

        const loadPaymentSettings = async () => {
            try {
                console.log('💳 Cargando configuración de pagos...');

                // Cargar métodos habilitados del estacionamiento
                const response = await fetch(`/api/payment/methods?est_id=${estId}`);
                let methodsData: { methods?: Array<{ method: string; enabled: boolean }> } = { methods: [] };

                if (response.ok) {
                    methodsData = await response.json();
                    console.log('✅ Métodos de pago cargados:', methodsData.methods);
                }

                // Cargar configuración del estacionamiento (API keys, datos bancarios)
                const userResponse = await fetch(`/api/estacionamiento/configuraciones?est_id=${estId}`);
                let userSettings: {
                    mercadopagoApiKey?: string;
                    bankAccountCbu?: string;
                    bankAccountAlias?: string;
                } = {};

                if (userResponse.ok) {
                    userSettings = await userResponse.json();
                    console.log('✅ Configuración del estacionamiento cargada:', {
                        hasMercadoPago: !!userSettings.mercadopagoApiKey,
                        hasBankData: !!(userSettings.bankAccountCbu && userSettings.bankAccountAlias)
                    });
                }

                // Convertir el formato del endpoint al formato esperado por getAvailablePaymentMethods
                const efectivoEnabled = methodsData.methods?.find((m: any) => m.method === 'Efectivo')?.enabled ?? false;
                const transferenciaEnabled = methodsData.methods?.find((m: any) => m.method === 'Transferencia')?.enabled ?? false;
                const qrEnabled = methodsData.methods?.find((m: any) => m.method === 'QR')?.enabled ?? false;
                const linkPagoEnabled = methodsData.methods?.find((m: any) => m.method === 'Link de Pago')?.enabled ?? false;
                const mercadopagoEnabled = qrEnabled || linkPagoEnabled;

                const settings: any = {
                    efectivo: { enabled: efectivoEnabled },
                    transfer: {
                        enabled: transferenciaEnabled,
                        cbu: userSettings.bankAccountCbu || '',
                        alias: userSettings.bankAccountAlias || ''
                    },
                    mercadopago: {
                        enabled: mercadopagoEnabled,
                        accessToken: userSettings.mercadopagoApiKey || '',
                        publicKey: userSettings.mercadopagoApiKey || ''
                    }
                };

                console.log('🔧 Configuración final de pagos:', {
                    efectivo: settings.efectivo.enabled,
                    transferencia: settings.transfer.enabled && !!(settings.transfer.cbu && settings.transfer.alias),
                    'qr/link_pago': settings.mercadopago.enabled && !!settings.mercadopago.accessToken
                });

                setPaymentSettings(settings);
            } catch (error) {
                console.error('❌ Error al cargar configuración de pagos:', error);
                // Configuración por defecto (solo efectivo habilitado)
                setPaymentSettings({
                    efectivo: { enabled: true },
                    transfer: { enabled: false, cbu: '', alias: '' },
                    mercadopago: { enabled: false, accessToken: '', publicKey: '' }
                });
            }
        };

        loadPaymentSettings();
    }, [estId]);

    // Calcular espacios disponibles
    const getAvailableSpaces = () => {
        if (!parkingCapacity || !parkedVehicles) {
            return {
                total: { capacity: 0, occupied: 0 }
            };
        }

        return {
            total: {
                capacity: parkingCapacity.Auto + parkingCapacity.Moto + parkingCapacity.Camioneta,
                occupied: parkedVehicles.length
            }
        };
    };

    const availableSpaces = getAvailableSpaces();
    const totalAvailable = availableSpaces.total.capacity - availableSpaces.total.occupied;

    // Función para cargar tarifas desde la API o usar genéricas como fallback
    const loadTariffs = async () => {
        if (!estId) {
            console.warn('⚠️ [TARIFAS] No hay est_id, usando tarifas genéricas');
            const tariffs = [
                { tar_id: 1, tar_nombre: 'Hora', tar_precio_hora: 200 },
                { tar_id: 2, tar_nombre: 'Día', tar_precio_hora: 1500 },
                { tar_id: 3, tar_nombre: 'Semana', tar_precio_hora: 8000 },
                { tar_id: 4, tar_nombre: 'Mensual', tar_precio_hora: 25000 }
            ];
            setAvailableTariffs(tariffs);
            return tariffs;
        }

        try {
            console.log(`🔄 [TARIFAS] Consultando /api/tarifas?est_id=${estId}`);
            const response = await fetch(`/api/tarifas?est_id=${estId}`);
            const data = await response.json();

            console.log(`📥 [TARIFAS] Respuesta del API:`, {
                success: data.success,
                totalPlantillas: data.tarifas?.length || 0,
                plantillas: data.tarifas?.map((p: any) => ({
                    id: p.plantilla_id,
                    nombre: p.nombre_plantilla,
                    tiposTarifa: Object.keys(p.tarifas || {})
                }))
            });

            // Si no hay plantillas, usar tarifas genéricas
            if (!data.tarifas || data.tarifas.length === 0) {
                console.log('⚙️ [TARIFAS] No hay plantillas, usando tarifas genéricas hardcodeadas');
                const tariffs = [
                    { tar_id: 1, tar_nombre: 'Hora', tar_precio_hora: 200 },
                    { tar_id: 2, tar_nombre: 'Día', tar_precio_hora: 1500 },
                    { tar_id: 3, tar_nombre: 'Semana', tar_precio_hora: 8000 },
                    { tar_id: 4, tar_nombre: 'Mensual', tar_precio_hora: 25000 }
                ];
                setAvailableTariffs(tariffs);
                return tariffs;
            }

            // Usar tarifas de la primera plantilla disponible
            const primeraPlantilla = data.tarifas[0];
            console.log(`✅ [TARIFAS] Usando tarifas de plantilla: ${primeraPlantilla.nombre_plantilla} (ID: ${primeraPlantilla.plantilla_id})`);

            const tariffs = Object.entries(primeraPlantilla.tarifas).map(([tipo, data]: [string, any]) => ({
                tar_id: parseInt(tipo),
                tar_nombre: mapTariffTypeToName(parseInt(tipo)),
                tar_precio_hora: data.precio
            }));

            console.log(`✅ [TARIFAS] Tarifas cargadas:`, tariffs);
            setAvailableTariffs(tariffs);
            return tariffs;
        } catch (error) {
            console.error('❌ [TARIFAS] Error loading tariffs:', error);
            // Fallback a tarifas genéricas
            console.log('⚙️ [TARIFAS] Usando tarifas genéricas por error');
            const tariffs = [
                { tar_id: 1, tar_nombre: 'Hora', tar_precio_hora: 200 },
                { tar_id: 2, tar_nombre: 'Día', tar_precio_hora: 1500 },
                { tar_id: 3, tar_nombre: 'Semana', tar_precio_hora: 8000 },
                { tar_id: 4, tar_nombre: 'Mensual', tar_precio_hora: 25000 }
            ];
            setAvailableTariffs(tariffs);
            return tariffs;
        }
    };

    // Función para mapear tipos de tarifa numéricos a nombres descriptivos
    const mapTariffTypeToName = (tipoTarifa: number): string => {
        switch (tipoTarifa) {
            case 1: return 'Hora'
            case 2: return 'Día'
            case 3: return 'Semana'
            case 4: return 'Mensual'
            default: return `Tipo ${tipoTarifa}`
        }
    };

    // Función para registrar entrada de vehículo
    const registerEntry = async (vehicleData: VehicleEntryData) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar entrada sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const payload: VehicleEntryData = {
                ...vehicleData,
                license_plate: vehicleData.license_plate.toUpperCase(),
            };

            const plazasData = availablePlazas.length > 0 ? availablePlazas : await loadAvailablePlazas();
            const plazaSeleccionada = payload.pla_numero != null
                ? plazasData.find((plaza: any) => plaza.pla_numero === payload.pla_numero) || null
                : null;

            const abonoInfo = plazaSeleccionada?.abono || null;
            const patentesAbono = (abonoInfo?.vehiculos || [])
                .map(v => v.veh_patente?.toUpperCase())
                .filter((patente): patente is string => Boolean(patente));

            const esAbono = Boolean(payload.isAbono || abonoInfo);

            if (esAbono) {
                if (!abonoInfo) {
                    toast({
                        variant: "destructive",
                        title: "Abono no encontrado",
                        description: "La plaza seleccionada no tiene un abono activo."
                    });
                    return;
                }

                if (!patentesAbono.includes(payload.license_plate)) {
                    toast({
                        variant: "destructive",
                        title: "Vehículo no autorizado",
                        description: `La patente ${payload.license_plate} no pertenece al abono asignado a esta plaza.`
                    });
                    return;
                }

                payload.isAbono = true;
                payload.abono_nro = abonoInfo.abo_nro;
                payload.duracion_tipo = 'abono';
                payload.precio_acordado = 0;
            } else {
                payload.isAbono = false;
                payload.abono_nro = undefined;
            }

            // Mapeo de tipos de vehículo del frontend a códigos de BD
            const vehicleTypeMapping = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            let dbVehicleType = vehicleTypeMapping[payload.type as keyof typeof vehicleTypeMapping] || 'AUT';

            if (payload.isAbono && abonoInfo?.vehiculos) {
                const vehiculoAsociado = abonoInfo.vehiculos.find(
                    v => v.veh_patente?.toUpperCase() === payload.license_plate
                );

                if (vehiculoAsociado?.catv_segmento) {
                    dbVehicleType = vehiculoAsociado.catv_segmento;
                    payload.type = vehiculoAsociado.catv_segmento === 'MOT'
                        ? 'Moto'
                        : vehiculoAsociado.catv_segmento === 'CAM'
                            ? 'Camioneta'
                            : 'Auto';
                }
            }

            // Verificar si el vehículo ya existe, si no, crearlo
            const { data: existingVehicle, error: vehicleCheckError } = await supabase
                .from('vehiculos')
                .select('veh_patente')
                .eq('veh_patente', payload.license_plate)
                .single();

            if (vehicleCheckError && vehicleCheckError.code !== 'PGRST116') {
                throw vehicleCheckError;
            }

            if (!existingVehicle) {
                const { error: createVehicleError } = await supabase
                    .from('vehiculos')
                    .insert({
                        veh_patente: payload.license_plate,
                        catv_segmento: dbVehicleType
                    });

                if (createVehicleError) throw createVehicleError;
            }

            let fechaLimite: Date | null = null;
            if (payload.duracion_tipo && payload.duracion_tipo !== 'hora' && payload.duracion_tipo !== 'abono') {
                const now = new Date();
                switch (payload.duracion_tipo) {
                    case 'dia':
                        fechaLimite = new Date(now.getTime() + (24 * 60 * 60 * 1000));
                        break;
                    case 'semana':
                        fechaLimite = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
                        break;
                    case 'mes':
                        fechaLimite = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
                        break;
                }
            }

            const entryTime = dayjs().tz('America/Argentina/Buenos_Aires').toISOString();
            const { error: ocupacionError } = await supabase
                .from('ocupacion')
                .insert({
                    est_id: estId,
                    veh_patente: payload.license_plate,
                    ocu_fh_entrada: entryTime,
                    pla_numero: payload.pla_numero,
                    ocu_duracion_tipo: payload.duracion_tipo || 'hora',
                    ocu_precio_acordado: payload.precio_acordado || 0,
                    ocu_fecha_limite: fechaLimite ? fechaLimite.toISOString() : null
                });

            if (ocupacionError) {
                console.error('Error al registrar ocupación:', ocupacionError);
                throw new Error(`Error al registrar ocupación: ${ocupacionError.message}`);
            }

            if (payload.pla_numero) {
                const nuevoEstado = payload.isAbono ? 'Abonado' : 'Ocupada';
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: nuevoEstado })
                    .eq('pla_numero', payload.pla_numero)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error actualizando estado de plaza:', plazaUpdateError);
                }
            }

            await refreshParkedVehicles();
            await refreshCapacity();

            toast({
                title: "Entrada registrada",
                description: payload.isAbono
                    ? `Vehículo abonado ${payload.license_plate} ingresó correctamente`
                    : `${payload.license_plate} ha sido registrado exitosamente`
            });
        } catch (error) {
            console.error("Error al registrar entrada:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo registrar la entrada del vehículo"
            });
        }
    };

    // Función para cargar plazas disponibles
    const loadAvailablePlazas = async () => {
        if (!estId) return [];

        try {
            const response = await fetch(`/api/plazas/dashboard?est_id=${estId}`);
            if (!response.ok) {
                console.error('Error loading available plazas:', response.statusText);
                return [];
            }

            const result = await response.json();
            if (result.success) {
                setAvailablePlazas(result.plazasCompletas || []);
                console.log('Plazas disponibles cargadas:', result.plazasCompletas?.length || 0);
                return result.plazasCompletas || [];
            } else {
                console.error('Error en respuesta al cargar plazas:', result.error);
                return [];
            }
        } catch (error) {
            console.error('Error loading available plazas:', error);
            return [];
        }
    };

    // Función para cargar tarifas de una plantilla específica
    const loadTariffsForPlantilla = useCallback(async (plantillaId: number | null) => {
        // Solo cargar si el modal está abierto
        if (!showIngresoModal) {
            return [];
        }

        if (!estId) {
            return [];
        }

        if (!plantillaId || plantillaId === 0) {
            return loadTariffs();
        }

        try {
            const response = await fetch(`/api/tarifas?est_id=${estId}`);
            const data = await response.json();

            if (!data.tarifas || data.tarifas.length === 0) {
                return loadTariffs();
            }

            // Buscar la plantilla específica
            const plantilla = data.tarifas.find((p: any) => p.plantilla_id === plantillaId);

            if (!plantilla) {
                return loadTariffs();
            }

            const tariffs = Object.entries(plantilla.tarifas).map(([tipo, data]: [string, any]) => ({
                tar_id: parseInt(tipo),
                tar_nombre: mapTariffTypeToName(parseInt(tipo)),
                tar_precio_hora: data.precio
            }));

            setAvailableTariffs(tariffs);
            return tariffs;
        } catch (error) {
            console.error('Error loading tariffs for plantilla:', error);
            return loadTariffs();
        }
    }, [estId, showIngresoModal]);

    // Función para abrir modal de ingreso
    const handleOpenIngresoModal = async () => {
        // No cargar tarifas aquí, se cargarán cuando se seleccione la plaza
        setAvailableTariffs([]); // Resetear tarifas
        await loadAvailablePlazas();
        setShowIngresoModal(true);
    };

    // Función para manejar confirmación de ingreso
    const handleConfirmIngreso = async (data: {
        license_plate: string
        type: VehicleType
        plaza_number: number
        modality: string
        agreed_price: number
        isAbono?: boolean
        abono_nro?: number
    }) => {
        setModalLoading(true);
        try {
            await registerEntry({
                license_plate: data.license_plate,
                type: data.type,
                pla_numero: data.plaza_number,
                duracion_tipo: data.modality.toLowerCase(),
                precio_acordado: data.agreed_price,
                isAbono: Boolean(data.isAbono),
                abono_nro: data.abono_nro
            });

            toast({
                title: "Entrada registrada",
                description: `Vehículo ${data.license_plate} registrado en plaza ${data.plaza_number}`
            });
            setShowIngresoModal(false);

            // Recargar plazas disponibles después del registro
            await loadAvailablePlazas();
        } catch (error) {
            console.error('Error registering entry:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al registrar ingreso"
            });
        } finally {
            setModalLoading(false);
        }
    };

    // Función para abrir modal de egreso
    const handleOpenEgresoModal = () => {
        if (vehiclesList.length === 0) {
            toast({
                variant: "destructive",
                title: "Sin vehículos",
                description: "No hay vehículos estacionados para dar salida"
            });
            return;
        }

        // Si hay solo un vehículo, ir directo al sistema de pagos
        if (vehiclesList.length === 1) {
            handleExit(vehiclesList[0].license_plate);
        } else {
            // Si hay múltiples vehículos, mostrar selector
            setShowVehicleSelectorModal(true);
        }
    };

    // Función para manejar selección de vehículo del selector
    const handleVehicleSelection = (vehicle: Vehicle) => {
        setSelectedVehicleForExit(vehicle);
        setShowVehicleSelectorModal(false);
        // Ir directo al sistema de pagos
        handleExit(vehicle.license_plate);
    };

    // Iniciar proceso de salida (calcular tarifa y mostrar selector de pago)
    const handleExit = async (licensePlate: string) => {
        if (!estId || !user?.id) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se puede registrar salida sin estacionamiento seleccionado"
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const plazasData = availablePlazas.length > 0 ? availablePlazas : await loadAvailablePlazas();

            const { data: ocupacion, error: ocupacionError } = await supabase
                .from('vw_ocupacion_actual')
                .select('*')
                .eq('license_plate', licensePlate)
                .eq('est_id', estId)
                .single();

            if (ocupacionError || !ocupacion) {
                throw new Error("Vehículo no encontrado o ya ha salido");
            }

            const plazaInfo = plazasData.find((plaza: any) => plaza.pla_numero === ocupacion.plaza_number);
            const esVehiculoAbonado = plazaInfo?.abono?.vehiculos?.some(
                (vehiculo: any) => vehiculo.veh_patente?.toUpperCase() === licensePlate.toUpperCase()
            ) ?? false;

            if (esVehiculoAbonado) {
                await finalizeSubscriptionExit({
                    licensePlate,
                    entryTime: ocupacion.entry_time,
                    plazaNumber: ocupacion.plaza_number
                });

                toast({
                    title: "Egreso abonado",
                    description: `Vehículo ${licensePlate} egresó sin cargo`
                });

                await refreshParkedVehicles();
                await refreshCapacity();
                return;
            }

            // NUEVO: Verificar si tiene reserva
            let feeData;
            if (ocupacion.res_codigo && ocupacion.ocu_fecha_limite) {
                console.log('🎫 Egreso con reserva detectado:', ocupacion.res_codigo);

                const salidaReal = dayjs().tz('America/Argentina/Buenos_Aires');
                const finReserva = dayjs(ocupacion.ocu_fecha_limite).tz('America/Argentina/Buenos_Aires');

                if (salidaReal.isAfter(finReserva)) {
                    // Calcular solo tiempo excedido
                    feeData = await calculateParkingFee(
                        {
                            entry_time: ocupacion.ocu_fecha_limite, // Desde fin de reserva
                            plaza_number: ocupacion.plaza_number,
                            ocu_duracion_tipo: 'hora',
                            ocu_precio_acordado: 0
                        },
                        estId
                    );

                    console.log('💰 Cargo adicional por tiempo excedido:', feeData.fee);

                    // Continuar con el flujo normal de pago
                    const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');

                    const paymentInfo: PaymentData = {
                        vehicleLicensePlate: licensePlate,
                        amount: feeData.fee,
                        calculatedFee: feeData.calculatedFee,
                        agreedFee: feeData.agreedPrice > 0 ? feeData.agreedPrice : undefined,
                        entryTime: ocupacion.ocu_fecha_limite, // Desde fin de reserva
                        exitTime: exitTime.toISOString(),
                        duration: feeData.durationMs,
                        method: 'efectivo',
                        estId: estId,
                        plazaNumber: ocupacion.plaza_number,
                        zone: plazaInfo?.pla_zona || 'Zona General',
                        tariffType: feeData.tariffType,
                        precioBase: feeData.precioBase,
                        durationUnits: feeData.durationUnits,
                        isSubscription: false,
                        subscriptionNumber: plazaInfo?.abono?.abo_nro
                    };

                    setPaymentData(paymentInfo);
                    setShowPaymentSelector(true);

                    console.log('💰 Cargo por exceso de tiempo de reserva:', {
                        vehicle: licensePlate,
                        tiempoExcedido: formatDuration(feeData.durationMs),
                        amount: formatCurrency(feeData.fee)
                    });

                    return;
                } else {
                    // Salió antes: sin cargo adicional
                    console.log('✅ Salió antes del fin de reserva, sin cargo adicional');

                    // Egreso directo sin pago
                    await finalizeSubscriptionExit({
                        licensePlate,
                        entryTime: ocupacion.entry_time,
                        plazaNumber: ocupacion.plaza_number
                    });

                    toast({
                        title: "Egreso completado",
                        description: `Reserva prepagada. Sin cargo adicional.`
                    });

                    await refreshParkedVehicles();
                    await refreshCapacity();
                    return;
                }
            } else {
                // Lógica normal sin reserva
                feeData = await calculateParkingFee(
                    {
                        entry_time: ocupacion.entry_time,
                        plaza_number: ocupacion.plaza_number,
                        ocu_duracion_tipo: ocupacion.ocu_duracion_tipo || 'hora',
                        ocu_precio_acordado: ocupacion.ocu_precio_acordado || 0
                    },
                    estId
                );
            }

            const exitTime = dayjs().tz('America/Argentina/Buenos_Aires');

            const paymentInfo: PaymentData = {
                vehicleLicensePlate: licensePlate,
                amount: feeData.fee,
                calculatedFee: feeData.calculatedFee,
                agreedFee: feeData.agreedPrice > 0 ? feeData.agreedPrice : undefined,
                entryTime: ocupacion.entry_time,
                exitTime: exitTime.toISOString(),
                duration: feeData.durationMs,
                method: 'efectivo',
                estId: estId,
                plazaNumber: ocupacion.plaza_number,
                zone: plazaInfo?.pla_zona || 'Zona General',
                tariffType: feeData.tariffType,
                precioBase: feeData.precioBase,
                durationUnits: feeData.durationUnits,
                isSubscription: false,
                subscriptionNumber: plazaInfo?.abono?.abo_nro
            };

            setPaymentData(paymentInfo);
            setShowPaymentSelector(true);

            console.log('💰 Iniciando proceso de pago:', {
                vehicle: licensePlate,
                plaza: ocupacion.plaza_number,
                plantilla: feeData.plantillaNombre,
                tipo: feeData.tariffType,
                unidades: feeData.durationUnits,
                amount: formatCurrency(feeData.fee),
                duration: formatDuration(feeData.durationMs)
            });

        } catch (error) {
            console.error("Error al calcular tarifa:", error);
            toast({
                variant: "destructive",
                title: "Error al calcular tarifa",
                description: error instanceof Error ? error.message : "No se pudo calcular la tarifa del vehículo"
            });
        }
    };

    // Manejar selección de método de pago
    const handlePaymentMethodSelect = async (method: PaymentMethod) => {
        if (!paymentData) return;

        setSelectedPaymentMethod(method);
        setPaymentLoading(true);

        try {
            // Actualizar método en los datos de pago
            const updatedPaymentData = { ...paymentData, method };
            setPaymentData(updatedPaymentData);

            console.log(`💳 Método seleccionado: ${method}`);

            // Procesar según el método seleccionado
            switch (method) {
                case 'efectivo':
                    await processEffectivoPago(updatedPaymentData);
                    break;
                case 'transferencia':
                    await processTransferenciaPago(updatedPaymentData);
                    break;
                case 'qr':
                    await processQRPago(updatedPaymentData);
                    break;
                case 'link_pago':
                    await processLinkPago(updatedPaymentData);
                    break;
                default:
                    throw new Error(`Método de pago no implementado: ${method}`);
            }
        } catch (error) {
            console.error(`Error procesando pago ${method}:`, error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo procesar el método de pago seleccionado"
            });
        } finally {
            setPaymentLoading(false);
        }
    };

    // Procesar pago en efectivo (inmediato)
    const processEffectivoPago = async (data: PaymentData) => {
        await finalizeVehicleExit(data);
        setShowPaymentSelector(false);

        toast({
            title: "Pago en efectivo",
            description: `Cobrar ${formatCurrency(data.amount)} al cliente`
        });
    };

    // Procesar pago por transferencia
    const processTransferenciaPago = async (data: PaymentData) => {
        setShowPaymentSelector(false);
        setShowTransferDialog(true);
        console.log('📄 Mostrando información de transferencia');
    };

    // Procesar pago con QR
    const processQRPago = async (data: PaymentData) => {
        try {
            console.log('📱 Generando código QR para pago...');

            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo',
                    paymentType: 'qr',
                    userId: user?.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Error de Mercado Pago:", errorData);
                throw new Error(errorData.error || "Error al generar el QR de Mercado Pago");
            }

            const { qr_code, init_point, id: preferenceId } = await response.json();

            if (qr_code || init_point) {
                const qrDialogData = {
                    qrCode: qr_code || init_point,
                    qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr_code || init_point)}`,
                    preferenceId: preferenceId
                };

                // Cerrar el selector de pagos y mostrar el modal QR
                setShowPaymentSelector(false);
                setQrData(qrDialogData);
                setShowQRDialog(true);

                toast({
                    title: "Código QR generado",
                    description: "Muestre el código QR al cliente para que realice el pago"
                });
            } else {
                throw new Error("No se pudo generar el código QR");
            }

            console.log('✅ Código QR generado exitosamente');

        } catch (error) {
            console.error('❌ Error generando código QR:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el código QR. Intenta con otro método de pago."
            });
            // Mantener el selector de métodos abierto para que puedan elegir otro método
        }
    };

    // Procesar pago con link
    const processLinkPago = async (data: PaymentData) => {
        setShowPaymentSelector(false);

        try {
            console.log('🔗 Generando link de pago...');

            const response = await fetch("/api/payment/mercadopago", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licensePlate: data.vehicleLicensePlate,
                    fee: data.amount,
                    vehicleType: 'Vehículo',
                    paymentType: 'regular',
                    userId: user?.id
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al generar el link de pago");
            }

            const { init_point } = await response.json();
            window.open(init_point, '_blank');

            console.log('✅ Link de pago generado exitosamente');

        } catch (error) {
            console.error('❌ Error generando link de pago:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo generar el link de pago. Intenta con otro método."
            });
            setShowPaymentSelector(true);
        }
    };

    // Finalizar salida del vehículo (actualizar DB)
    const finalizeSubscriptionExit = async ({
        licensePlate,
        entryTime,
        plazaNumber
    }: {
        licensePlate: string;
        entryTime: string;
        plazaNumber?: number | null;
    }) => {
        if (!estId || !user?.id) return;

        const supabase = createBrowserClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const exitTimestamp = dayjs().tz('America/Argentina/Buenos_Aires').toISOString();

        const { error: updateError } = await supabase
            .from('ocupacion')
            .update({
                ocu_fh_salida: exitTimestamp
            })
            .eq('est_id', estId)
            .eq('veh_patente', licensePlate)
            .eq('ocu_fh_entrada', entryTime)
            .is('ocu_fh_salida', null);

        if (updateError) {
            throw updateError;
        }

        if (plazaNumber) {
            const { error: plazaUpdateError } = await supabase
                .from('plazas')
                .update({ pla_estado: 'Abonado' })
                .eq('pla_numero', plazaNumber)
                .eq('est_id', estId);

            if (plazaUpdateError) {
                console.warn('Error restaurando estado de plaza abonada:', plazaUpdateError);
            }
        }

        await refreshParkedVehicles();
        await refreshCapacity();
    };

    const finalizeVehicleExit = async (data: PaymentData) => {
        if (!estId || !user?.id) return;

        if (data.isSubscription) {
            await finalizeSubscriptionExit({
                licensePlate: data.vehicleLicensePlate,
                entryTime: data.entryTime,
                plazaNumber: data.plazaNumber
            });
            return;
        }

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // 1. Registrar el pago en la tabla pagos
            const normalizedMethod = data.method === 'efectivo' ? 'Efectivo' :
                data.method === 'tarjeta' ? 'Tarjeta' :
                    data.method === 'app' ? 'MercadoPago' :
                        data.method === 'transferencia' ? 'Transferencia' : 'Efectivo';

            const { data: payment, error: paymentError } = await supabase
                .from('pagos')
                .insert([{
                    pag_monto: data.amount,
                    pag_h_fh: dayjs().tz('America/Argentina/Buenos_Aires').toISOString(),
                    est_id: estId,
                    mepa_metodo: normalizedMethod,
                    veh_patente: data.vehicleLicensePlate,
                }])
                .select()
                .single();

            if (paymentError) {
                console.error('Error registrando pago:', paymentError);
                throw new Error(`Error al registrar el pago: ${paymentError.message}`);
            }

            console.log('✅ Pago registrado:', payment);

            // 2. Actualizar la ocupación marcando la salida y enlazando el pago
            const { error: updateError } = await supabase
                .from('ocupacion')
                .update({
                    ocu_fh_salida: data.exitTime,
                    pag_nro: payment.pag_nro
                })
                .eq('est_id', estId)
                .eq('veh_patente', data.vehicleLicensePlate)
                .eq('ocu_fh_entrada', data.entryTime)
                .is('ocu_fh_salida', null);

            if (updateError) throw updateError;

            // Si había una plaza asignada, liberarla
            if (data.plazaNumber) {
                const { error: plazaUpdateError } = await supabase
                    .from('plazas')
                    .update({ pla_estado: 'Libre' })
                    .eq('pla_numero', data.plazaNumber)
                    .eq('est_id', estId);

                if (plazaUpdateError) {
                    console.warn('Error liberando plaza:', plazaUpdateError);
                }
            }

            // Actualizar datos en la UI
            await refreshParkedVehicles();
            await refreshCapacity();

            console.log('✅ Salida del vehículo finalizada:', {
                vehicle: data.vehicleLicensePlate,
                method: data.method,
                amount: formatCurrency(data.amount)
            });

        } catch (error) {
            console.error("Error finalizando salida:", error);
            throw error;
        }
    };

    // Cerrar modales de pago
    const closePaymentModals = () => {
        setShowPaymentSelector(false);
        setShowTransferDialog(false);
        setShowQRDialog(false);
        setPaymentData(null);
        setSelectedPaymentMethod(null);
        setPaymentLoading(false);
        setQrData(null);
        setQRPaymentStatus('pending');
    };


    // Función para cerrar modales
    const handleCloseModals = () => {
        setShowIngresoModal(false);
        setShowVehicleSelectorModal(false);
        setSelectedVehicleForExit(null);
        setModalLoading(false);
        closePaymentModals();
    };

    if (loading || roleLoading) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="p-6">
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
                                    <p className="text-gray-600">Cargando panel de operador...</p>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    if (!estId) {
        return (
            <div className="flex h-screen bg-background">
                <DashboardSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-auto">
                        <div className="p-6">
                            <div className="text-center py-12">
                                <h2 className="text-2xl font-bold text-gray-900 mb-4">Panel de Operador</h2>
                                <p className="text-gray-600 mb-6">
                                    Selecciona un estacionamiento para acceder al panel de operador
                                </p>
                                <Button onClick={() => router.push('/dashboard/parking')}>
                                    Ir a Mis Estacionamientos
                                </Button>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background">
            <DashboardSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-auto">
                    <div className="min-h-screen bg-white">
                        {/* Main Content */}
                        <div className="max-w-7xl mx-auto px-6 py-16">
                            <TurnoGuard showAlert={true} redirectButton={true}>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">

                                    {/* Tarjeta de Ingreso */}
                                    <div
                                        className="bg-gradient-to-br from-green-100 to-green-200 rounded-3xl p-8 border-2 border-green-300 cursor-pointer hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center min-h-[400px]"
                                        onClick={handleOpenIngresoModal}
                                    >
                                        {/* Círculo con flecha */}
                                        <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mb-8">
                                            <ArrowLeft className="w-8 h-8 text-white" />
                                        </div>

                                        {/* Título */}
                                        <h2 className="text-4xl font-bold text-green-800 mb-4">INGRESO</h2>

                                        {/* Descripción */}
                                        <p className="text-green-700 text-center mb-8 text-lg">
                                            Registrar entrada de vehículo
                                        </p>

                                        {/* Badge con información */}
                                        <div className="bg-green-600 text-white px-6 py-3 rounded-full font-medium">
                                            {totalAvailable} espacios disponibles
                                        </div>
                                    </div>

                                    {/* Tarjeta de Egreso */}
                                    <div
                                        className="bg-gradient-to-br from-red-100 to-red-200 rounded-3xl p-8 border-2 border-red-300 cursor-pointer hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center min-h-[400px]"
                                        onClick={handleOpenEgresoModal}
                                    >
                                        {/* Círculo con flecha */}
                                        <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mb-8">
                                            <ArrowRight className="w-8 h-8 text-white" />
                                        </div>

                                        {/* Título */}
                                        <h2 className="text-4xl font-bold text-red-800 mb-4">EGRESO</h2>

                                        {/* Descripción */}
                                        <p className="text-red-700 text-center mb-8 text-lg">
                                            Registrar salida de vehículo
                                        </p>

                                        {/* Badge con información */}
                                        <div className="bg-red-600 text-white px-6 py-3 rounded-full font-medium">
                                            {availableSpaces.total.occupied} vehículos estacionados
                                        </div>
                                    </div>

                                </div>
                            </TurnoGuard>
                        </div>
                    </div>

                    {/* Modal de Ingreso */}
                    <IngresoModal
                        plaza={null} // Ya no es necesario porque se selecciona dinámicamente
                        isOpen={showIngresoModal}
                        onClose={handleCloseModals}
                        onConfirm={handleConfirmIngreso}
                        loading={modalLoading}
                        tarifas={availableTariffs}
                        availablePlazas={availablePlazas}
                        onPlazaChange={loadTariffsForPlantilla}
                    />

                    {/* Modal de Selección de Vehículos */}
                    <VehicleSelectorModal
                        vehicles={vehiclesList}
                        isOpen={showVehicleSelectorModal}
                        onClose={handleCloseModals}
                        onSelectVehicle={handleVehicleSelection}
                    />

                    {/* Modales del sistema de pagos */}
                    <PaymentMethodSelector
                        isOpen={showPaymentSelector}
                        onClose={closePaymentModals}
                        onSelectMethod={handlePaymentMethodSelect}
                        paymentData={paymentData}
                        loading={paymentLoading}
                        paymentSettings={paymentSettings}
                    />

                    <TransferInfoDialog
                        isOpen={showTransferDialog}
                        onClose={closePaymentModals}
                        onConfirmTransfer={async () => {
                            if (!paymentData) return;

                            setPaymentLoading(true);
                            try {
                                console.log('💰 Operador confirmó recepción de transferencia:', {
                                    vehicle: paymentData.vehicleLicensePlate,
                                    amount: formatCurrency(paymentData.amount),
                                    operator: user?.email
                                });

                                toast({
                                    title: "Transferencia confirmada",
                                    description: `Pago de ${formatCurrency(paymentData.amount)} confirmado por el operador`
                                });

                                await finalizeVehicleExit(paymentData);
                                closePaymentModals();
                            } catch (error) {
                                console.error('Error confirmando transferencia:', error);
                                toast({
                                    variant: "destructive",
                                    title: "Error",
                                    description: "No se pudo confirmar la transferencia"
                                });
                            } finally {
                                setPaymentLoading(false);
                            }
                        }}
                        paymentData={{
                            amount: paymentData?.amount || 0,
                            vehicleLicensePlate: paymentData?.vehicleLicensePlate || '',
                            paymentId: generatePaymentId(),
                            duration: paymentData ? formatDuration(paymentData.duration) : ''
                        }}
                        transferConfig={{
                            cbu: '0170020510000001234567',
                            alias: 'PARKING.EJEMPLO',
                            accountHolder: 'Estacionamiento Ejemplo S.A.',
                            bank: 'Banco Ejemplo'
                        }}
                        loading={paymentLoading}
                    />

                    <QRPaymentDialog
                        isOpen={showQRDialog}
                        onClose={closePaymentModals}
                        onPaymentComplete={async () => {
                            if (paymentData) {
                                await finalizeVehicleExit(paymentData);
                                toast({
                                    title: "Pago confirmado",
                                    description: "El vehículo puede salir"
                                });
                            }
                            setShowQRDialog(false);
                            setShowPaymentSelector(false);
                        }}
                        paymentData={{
                            amount: paymentData?.amount || 0,
                            vehicleLicensePlate: paymentData?.vehicleLicensePlate || '',
                            paymentId: qrData?.preferenceId || generatePaymentId(),
                            duration: paymentData ? formatDuration(paymentData.duration) : '',
                            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
                        }}
                        qrData={qrData || {
                            qrCode: '',
                            qrCodeImage: '',
                            preferenceId: ''
                        }}
                        paymentStatus={qrPaymentStatus}
                        loading={paymentLoading}
                    />

                    {/* Vista de Reservas */}
                    {vistaActual === 'reservas' && estId && (
                        <div className="fixed inset-0 bg-white z-50 overflow-auto">
                            <div className="max-w-7xl mx-auto px-6 py-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h1 className="text-3xl font-bold text-gray-900">Gestión de Reservas</h1>
                                        <p className="text-gray-600 mt-1">Administra las reservas del estacionamiento</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => setVistaActual('ingresos')}
                                        >
                                            Volver a Ingresos
                                        </Button>
                                        <Button
                                            onClick={() => setBuscarReservaOpen(true)}
                                            className="bg-blue-600 hover:bg-blue-700"
                                        >
                                            <Search className="w-4 h-4 mr-2" />
                                            Buscar Reserva
                                        </Button>
                                    </div>
                                </div>

                                <ListaReservasOperador
                                    estId={estId}
                                    onConfirmarLlegada={(reserva) => {
                                        toast({
                                            title: "Llegada confirmada",
                                            description: `La reserva ${reserva.res_codigo} ha sido activada`,
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Dialog de búsqueda de reserva */}
                    {estId && (
                        <BuscarReservaDialog
                            isOpen={buscarReservaOpen}
                            onClose={() => setBuscarReservaOpen(false)}
                            estId={estId}
                            modoAutomatico={true}
                            onConfirmarLlegada={(reserva) => {
                                toast({
                                    title: "Llegada confirmada",
                                    description: `La reserva ${reserva.res_codigo} ha sido activada`,
                                });
                            }}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}
