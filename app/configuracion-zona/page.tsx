'use client';


import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, Car, Bike, Truck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useUserRole } from '@/lib/use-user-role';
import { useZoneManagement } from '@/lib/hooks/use-zone-management';

// Tipos para la API
interface Zona {
    id: number;
    nombre: string;
    est_id: number;
}

interface ConfiguracionZona {
    est_id: number;
    zona_nombre: string;
    // Opción 1: cantidad total de plazas
    cantidad_plazas?: number;
    // Opción 2: filas y columnas
    filas?: number;
    columnas?: number;
    numeracion: {
        modo: 'reiniciar' | 'continuar';
    };
}

// Componente que usa useSearchParams
const SearchParamsProvider: React.FC<{ setZonaParametro: (zona: string | null) => void }> = ({ setZonaParametro }) => {
    const searchParams = useSearchParams();

    React.useEffect(() => {
        setZonaParametro(searchParams?.get('zona') || null);
    }, [searchParams, setZonaParametro]);

    return null;
};

const ConfiguracionZonaPage: React.FC = () => {
    const router = useRouter();
    const { estId, user, setEstId } = useAuth();
    const { isOwner, loading: roleLoading } = useUserRole();
    const { checkZoneExists, loadZoneInfo, configureZoneComplete } = useZoneManagement(estId);

    // Verificar si el usuario es owner, si no, redirigir
    if (!roleLoading && user && !isOwner) {
        console.log('🚫 Usuario no es owner, redirigiendo...');
        router.push('/dashboard');
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-gray-600">Redirigiendo...</div>
                </div>
            </div>
        );
    }

    // Mostrar loading mientras se verifica el rol
    if (roleLoading || !user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
                    <div className="text-lg text-gray-600">Verificando permisos...</div>
                </div>
            </div>
        );
    }
    const [zonaNombre, setZonaNombre] = useState<string>('');
    const [cantidadPlazas, setCantidadPlazas] = useState<number>(0);
    const [filas, setFilas] = useState<number>(0);
    const [columnas, setColumnas] = useState<number>(0);
    const [totalEditable, setTotalEditable] = useState<number>(0);
    // Numeración siempre comienza desde 1 para cada zona
    const [previsualizacion, setPrevisualizacion] = useState<number[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Estados para los dialogs
    const [errorDialogOpen, setErrorDialogOpen] = useState<boolean>(false);
    const [errorTitle, setErrorTitle] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');

    // Estados para el dialog de confirmación
    const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
    const [confirmData, setConfirmData] = useState<any>(null);

    // Estado para controlar si usar filas/columnas o cantidad directa
    const [usarLayout, setUsarLayout] = useState<boolean>(false);

    // Estado para zonas existentes
    const [zonasExistentes, setZonasExistentes] = useState<string[]>([]);
    const [zonasDetalladas, setZonasDetalladas] = useState<any[]>([]);
    const [cargandoZonas, setCargandoZonas] = useState<boolean>(false);
    const [zonaDuplicada, setZonaDuplicada] = useState<boolean>(false);

    // Obtener el parámetro de zona de la URL
    const [zonaParametro, setZonaParametro] = React.useState<string | null>(null);

    // Estado para controlar si mostrar el formulario de creación/edición
    const [mostrarFormulario, setMostrarFormulario] = useState<boolean>(false);
    const [modoEdicion, setModoEdicion] = useState<boolean>(false);

    // Sincronización simple: mantener totalEditable actualizado
    React.useEffect(() => {
        if (cantidadPlazas > 0) {
            setTotalEditable(cantidadPlazas);
        }
    }, [cantidadPlazas]);

    // Cargar configuración de zona existente si viene por parámetro
    React.useEffect(() => {
        if (zonaParametro && estId) {
            setModoEdicion(true);
            setMostrarFormulario(true);
            cargarInformacionZona(zonaParametro);
        }
    }, [zonaParametro, estId, loadZoneInfo]);

    // Cargar zonas existentes cuando el estId esté disponible
    React.useEffect(() => {
        if (estId) {
            cargarZonasExistentes();
        }
    }, [estId]);

    // Verificar zona en tiempo real cuando cambie el nombre
    React.useEffect(() => {
        verificarZonaTiempoReal(zonaNombre);
    }, [zonaNombre, zonasExistentes]);

    // Función para cargar zonas existentes con detalles
    const cargarZonasExistentes = async () => {
        if (!estId) return;

        try {
            setCargandoZonas(true);
            const response = await fetch(`/api/zonas?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                const zonas = data.zonas || [];
                const nombresZonas = zonas.map((zona: any) => zona.zona_nombre);
                setZonasExistentes(nombresZonas);

                // Cargar detalles de cada zona
                const zonasConDetalles = await Promise.all(
                    zonas.map(async (zona: any) => {
                        try {
                            // Consultar directamente a la base de datos para obtener plazas de esta zona
                            const plazasResponse = await fetch(`/api/plazas?est_id=${estId}&zona_id=${zona.zona_id}`);
                            if (plazasResponse.ok) {
                                const plazasData = await plazasResponse.json();
                                const plazas = plazasData.plazas || [];

                                // Filtrar por tipo usando tipo_vehiculo (que viene del API)
                                const plazasAuto = plazas.filter((p: any) => p.tipo_vehiculo === 'AUT').length;
                                const plazasMoto = plazas.filter((p: any) => p.tipo_vehiculo === 'MOT').length;
                                const plazasCamioneta = plazas.filter((p: any) => p.tipo_vehiculo === 'CAM').length;

                                console.log(`📊 Zona ${zona.zona_nombre}:`, {
                                    total: plazas.length,
                                    AUT: plazasAuto,
                                    MOT: plazasMoto,
                                    CAM: plazasCamioneta,
                                    primeraPlaza: plazas[0] // Para debug
                                });

                                return {
                                    ...zona,
                                    total_plazas: plazas.length,
                                    plazas_auto: plazasAuto,
                                    plazas_moto: plazasMoto,
                                    plazas_camioneta: plazasCamioneta,
                                };
                            }
                            return { ...zona, total_plazas: 0, plazas_auto: 0, plazas_moto: 0, plazas_camioneta: 0 };
                        } catch (error) {
                            console.error(`Error cargando detalles de zona ${zona.zona_nombre}:`, error);
                            return { ...zona, total_plazas: 0, plazas_auto: 0, plazas_moto: 0, plazas_camioneta: 0 };
                        }
                    })
                );

                setZonasDetalladas(zonasConDetalles);
                console.log('📋 Zonas con detalles cargadas:', zonasConDetalles);
            }
        } catch (error) {
            console.error('Error cargando zonas existentes:', error);
        } finally {
            setCargandoZonas(false);
        }
    };

    // Función para verificar si una zona ya existe (usando hook)
    const verificarZonaExistente = async (nombreZona: string): Promise<boolean> => {
        return await checkZoneExists(nombreZona);
    };

    // Función para verificar zona en tiempo real
    const verificarZonaTiempoReal = (nombre: string) => {
        // No validar si estamos en modo edición (se permite el mismo nombre)
        if (modoEdicion) {
            setZonaDuplicada(false);
            return false;
        }

        const nombreTrim = nombre.trim();
        const existe = zonasExistentes.includes(nombreTrim);
        setZonaDuplicada(existe && nombreTrim !== '');
        return existe;
    };

    // Función para refrescar el estacionamiento
    const refreshEstacionamiento = async () => {
        try {
            console.log('🔄 Refrescando estacionamiento...');
            const response = await fetch('/api/auth/get-parking-id');

            if (response.ok) {
                const data = await response.json();
                if (data.has_parking && data.est_id) {
                    console.log(`✅ Nuevo estacionamiento encontrado: ${data.est_id}`);
                    setEstId(data.est_id);
                    if (typeof window !== 'undefined') {
                        localStorage.setItem('parking_est_id', String(data.est_id));
                    }
                    toast.success(`Estacionamiento actualizado: ${data.est_nombre}`);
                } else {
                    toast.error('No se encontró ningún estacionamiento para tu cuenta');
                }
            } else {
                toast.error('Error al refrescar el estacionamiento');
            }
        } catch (error) {
            console.error('Error refrescando estacionamiento:', error);
            toast.error('Error al refrescar el estacionamiento');
        }
    };


    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
                    <p className="text-gray-600">Debes iniciar sesión para acceder a esta página.</p>
                </div>
            </div>
        );
    }

    if (!estId) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Estacionamiento No Configurado</h2>
                    <p className="text-gray-600 mb-4">No se encontró un estacionamiento configurado para tu cuenta.</p>

                    <div className="bg-gray-100 p-4 rounded-lg mb-4 text-left max-w-md">
                        <p className="text-sm text-gray-700 mb-1"><strong>Usuario:</strong> {user?.email}</p>
                        <p className="text-sm text-gray-700 mb-1"><strong>ID del estacionamiento:</strong> {estId || 'No disponible'}</p>
                        <p className="text-sm text-gray-700"><strong>Estado:</strong> Sin estacionamiento asignado</p>
                    </div>

                    <div className="space-y-2">
                        <Button onClick={refreshEstacionamiento} className="mr-2">
                            <Loader2 className="mr-2 h-4 w-4" />
                            Refrescar Estacionamiento
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/dashboard')}>
                            Ir al Dashboard
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Función para mostrar errores con dialog
    const showErrorDialog = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setErrorDialogOpen(true);
    };

    // Función para mostrar confirmación con dialog
    const showConfirmDialog = (data: any) => {
        setConfirmData(data);
        setConfirmDialogOpen(true);
    };

    // Función para enviar los datos a la API
    const enviarDatos = async (data?: any) => {
        try {
            setLoading(true);

            console.log('🔍 Debug - enviarDatos:', {
                estId,
                user: user?.email,
                zonaNombre,
                usarLayout,
                filas,
                columnas,
                cantidadPlazas
            });

            if (!estId) {
                throw new Error('No se ha seleccionado un estacionamiento válido');
            }

            // Verificar si la zona ya existe antes de intentar crearla
            if (await verificarZonaExistente(zonaNombre.trim())) {
                throw new Error(`La zona "${zonaNombre.trim()}" ya existe en este estacionamiento. Por favor elige un nombre diferente.`);
            }

            const configuracion: ConfiguracionZona = {
                est_id: estId,
                zona_nombre: zonaNombre.trim(),
                // Numeración siempre comienza desde 1
                numeracion: {
                    modo: 'reiniciar'
                }
            };

            // Agregar cantidad o filas/columnas según el modo
            if (usarLayout) {
                configuracion.filas = filas;
                configuracion.columnas = columnas;
            } else {
                configuracion.cantidad_plazas = cantidadPlazas;
            }

            const responseData = await configureZoneComplete(configuracion);

            toast.success(responseData.message || "Zona creada exitosamente");

            // Redirigir al dashboard
            router.push('/dashboard');

        } catch (error: any) {
            console.error('Error creando zona:', error);
            toast.error(error.message || "No se pudo crear la zona");
        } finally {
            setLoading(false);
        }
    };

    // Función para manejar la confirmación
    const handleConfirm = () => {
        setConfirmDialogOpen(false);
        if (confirmData) {
            // Continuar con el envío después de la confirmación
            enviarDatos();
        }
    };

    // Función para manejar la cancelación
    const handleCancelConfirm = () => {
        setConfirmDialogOpen(false);
        setConfirmData(null);
    };



    const cargarInformacionZona = async (zonaNombre: string) => {
        try {
            setLoading(true);
            console.log(`🔍 Cargando información de zona "${zonaNombre}"`);

            const zona = await loadZoneInfo(zonaNombre);

            // Pre-llenar el formulario con la información existente
            setZonaNombre(zona.zona_nombre);
            setCantidadPlazas(zona.total_plazas);
            setTotalEditable(zona.total_plazas);

            // Si se detectó un layout, activarlo
            if (zona.filas_detectadas > 1) {
                setUsarLayout(true);
                setFilas(zona.filas_detectadas);
                setColumnas(zona.columnas_detectadas);
            }

            console.log(`✅ Información cargada: ${zona.total_plazas} plazas, ${zona.filas_detectadas}x${zona.columnas_detectadas} layout`);
            console.log('📊 Estadísticas:', zona.estadisticas);

            // Generar previsualización automáticamente
            const numeroInicio = 1;
            const numeroFin = numeroInicio + zona.total_plazas - 1;
            const plazasArray: number[] = [];
            for (let i = numeroInicio; i <= numeroFin; i++) {
                plazasArray.push(i);
            }
            setPrevisualizacion(plazasArray);

            // Mostrar mensaje informativo
            toast.success(`Información cargada: Zona "${zonaNombre}" tiene ${zona.total_plazas} plazas configuradas`);
        } catch (error) {
            console.error('❌ Error cargando zona:', error);
            toast.error("Error al cargar la información de la zona");
        } finally {
            setLoading(false);
        }
    };

    // Función para encontrar la mejor distribución de filas/columnas
    const encontrarMejorDistribucion = (total: number, proporcionObjetivo?: number) => {
        let mejorFilas = 1;
        let mejorColumnas = total;
        let menorDiferencia = Math.abs(proporcionObjetivo ? proporcionObjetivo - 1 : 1 - total);

        // Si tenemos una proporción objetivo, intentar mantenerla
        if (proporcionObjetivo) {
            const fIdeal = Math.round(Math.sqrt(total / proporcionObjetivo));
            const cIdeal = Math.round(total / fIdeal);

            if (fIdeal > 0 && cIdeal > 0 && fIdeal * cIdeal === total) {
                return { filas: fIdeal, columnas: cIdeal };
            }
        }

        // Buscar la mejor distribución
        for (let f = 1; f <= Math.sqrt(total); f++) {
            if (total % f === 0) {
                const c = total / f;
                const proporcionActual = f / c;
                const diferencia = Math.abs(proporcionObjetivo ? proporcionObjetivo - proporcionActual : proporcionActual - 1);

                if (diferencia < menorDiferencia) {
                    menorDiferencia = diferencia;
                    mejorFilas = f;
                    mejorColumnas = c;
                }
            }
        }

        return { filas: mejorFilas, columnas: mejorColumnas };
    };

    // Función de previsualización
    const generarPrevisualizacion = () => {
        // Validar nombre de zona
        if (!zonaNombre.trim()) {
            showErrorDialog(
                "Nombre de zona requerido",
                "Por favor ingresa un nombre válido para la zona antes de generar la previsualización."
            );
            return;
        }

        // Validar que se tenga una cantidad válida
        let cantidadFinal = totalEditable;

        if (!cantidadFinal || cantidadFinal <= 0) {
            showErrorDialog(
                "Cantidad inválida",
                "Por favor ingresa una cantidad válida de plazas mayor a cero."
            );
            return;
        }

        // En modo layout, validar que tenga filas y columnas configuradas
        if (usarLayout && (!filas || !columnas || filas <= 0 || columnas <= 0)) {
            showErrorDialog(
                "Configuración incompleta",
                "En modo layout, debes configurar tanto filas como columnas con valores mayores a cero."
            );
            return;
        }

        // Validar la consistencia entre el layout y el total de plazas
        if (usarLayout && filas > 0 && columnas > 0) {
            const layoutTeorico = filas * columnas;

            // ERROR: Si el layout es más pequeño que el total de plazas
            if (layoutTeorico < cantidadFinal) {
                showErrorDialog(
                    "Error de Configuración",
                    `El total de plazas (${cantidadFinal}) es mayor que la capacidad del layout (${layoutTeorico}). No puedes crear más plazas de las que caben en la grilla de ${filas}×${columnas}.`
                );
                return; // Detenemos la función aquí
            }

            // Información: Si el usuario configura menos plazas de las que caben
            if (cantidadFinal < layoutTeorico) {
                toast.info(`Configuraste ${cantidadFinal} plazas para un layout de ${filas}×${columnas} (${layoutTeorico} plazas). Se crearán exactamente ${cantidadFinal} plazas.`, {
                    duration: 6000,
                });
            }
        }

        // Numeración siempre comienza desde 1 para cada zona
        const numeroInicio = 1;

        const numeroFin = numeroInicio + cantidadFinal - 1;
        const plazasArray: number[] = [];

        for (let i = numeroInicio; i <= numeroFin; i++) {
            plazasArray.push(i);
        }

        setPrevisualizacion(plazasArray);

        const layoutInfo = usarLayout ? ` (${filas}x${columnas})` : '';
        toast.info(`Previsualización: ${cantidadFinal} plazas${layoutInfo} (${numeroInicio}-${numeroFin})`);
    };

    // Función de envío (simplificada)
    const handleContinuar = async () => {
        if (!zonaNombre.trim()) {
            showErrorDialog(
                "Nombre de zona requerido",
                "Por favor ingresa un nombre válido para la zona antes de continuar."
            );
            return;
        }

        // Verificar si la zona ya existe
        if (zonaDuplicada) {
            showErrorDialog(
                "Zona duplicada",
                `La zona "${zonaNombre.trim()}" ya existe en este estacionamiento. Por favor elige un nombre diferente.`
            );
            return;
        }

        // Validar cantidad de plazas
        let cantidadFinal = totalEditable;

        if (!cantidadFinal || cantidadFinal <= 0) {
            showErrorDialog(
                "Cantidad inválida",
                "Por favor ingresa una cantidad válida de plazas mayor a cero."
            );
            return;
        }

        // En modo layout, validar que tenga filas y columnas configuradas
        if (usarLayout && (!filas || !columnas || filas <= 0 || columnas <= 0)) {
            showErrorDialog(
                "Configuración incompleta",
                "En modo layout, debes configurar tanto filas como columnas con valores mayores a cero."
            );
            return;
        }

        // Validar la consistencia entre el layout y el total de plazas
        if (usarLayout && filas > 0 && columnas > 0) {
            const layoutTeorico = filas * columnas;

            // ERROR: Si el layout es más pequeño que el total de plazas
            if (layoutTeorico < cantidadFinal) {
                showErrorDialog(
                    "Error de Configuración",
                    `El total de plazas (${cantidadFinal}) es mayor que la capacidad del layout (${layoutTeorico}). No puedes crear más plazas de las que caben en la grilla de ${filas}×${columnas}.`
                );
                return;
            }

            // Información: Si el usuario configura menos plazas de las que caben
            if (cantidadFinal < layoutTeorico) {
                showConfirmDialog({
                    filas,
                    columnas,
                    layoutTeorico,
                    cantidadFinal,
                    zonaNombre
                });
                return; // Esperar confirmación del usuario
            }
        }

        // En modo edición, verificar si se está reduciendo el tamaño de la zona
        if (modoEdicion) {
            const zonaActual = zonasDetalladas.find(z => z.zona_nombre === zonaNombre);
            if (zonaActual && zonaActual.total_plazas > cantidadFinal) {
                // Estamos reduciendo el tamaño de la zona
                const plazasAEliminar = zonaActual.total_plazas - cantidadFinal;
                console.log(`⚠️ Reduciendo zona de ${zonaActual.total_plazas} a ${cantidadFinal} plazas (se eliminarán ${plazasAEliminar} plazas)`);

                // Validar que las plazas a eliminar estén desocupadas
                try {
                    setLoading(true);

                    // Obtener el zona_id de la zona actual
                    const zonasResponse = await fetch(`/api/zonas?est_id=${estId}`);
                    if (!zonasResponse.ok) {
                        throw new Error('Error al obtener información de zonas');
                    }
                    const zonasData = await zonasResponse.json();
                    const zonaInfo = zonasData.zonas.find((z: any) => z.zona_nombre === zonaNombre);

                    if (!zonaInfo) {
                        throw new Error('No se encontró la información de la zona');
                    }

                    // Obtener todas las plazas de la zona
                    const plazasResponse = await fetch(`/api/plazas?est_id=${estId}&zona_id=${zonaInfo.zona_id}`);
                    if (!plazasResponse.ok) {
                        throw new Error('Error al obtener las plazas de la zona');
                    }
                    const plazasData = await plazasResponse.json();
                    const plazas = plazasData.plazas || [];

                    // Ordenar las plazas por número (asumiendo que tienen un campo pla_num)
                    plazas.sort((a: any, b: any) => {
                        const numA = parseInt(a.pla_num) || 0;
                        const numB = parseInt(b.pla_num) || 0;
                        return numA - numB;
                    });

                    // Las plazas a eliminar serían las últimas (desde cantidadFinal+1 hasta el final)
                    const plazasParaEliminar = plazas.slice(cantidadFinal);

                    console.log('📋 Plazas a eliminar:', plazasParaEliminar.map((p: any) => ({
                        num: p.pla_num,
                        estado: p.pla_estado
                    })));

                    // Verificar si alguna de las plazas a eliminar está ocupada
                    const plazasOcupadas = plazasParaEliminar.filter((p: any) =>
                        p.pla_estado !== 'Libre' && p.pla_estado !== 'libre'
                    );

                    if (plazasOcupadas.length > 0) {
                        const numerosOcupados = plazasOcupadas.map((p: any) => p.pla_num).join(', ');
                        setLoading(false);
                        showErrorDialog(
                            "No se puede reducir el tamaño de la zona",
                            `No puedes reducir la zona a ${cantidadFinal} plazas porque las siguientes plazas están ocupadas y serían eliminadas: ${numerosOcupados}. Por favor, libera estas plazas antes de continuar.`
                        );
                        return;
                    }

                    console.log('✅ Todas las plazas a eliminar están desocupadas, se puede proceder');
                    setLoading(false);
                } catch (error: any) {
                    setLoading(false);
                    console.error('❌ Error validando plazas:', error);
                    showErrorDialog(
                        "Error de validación",
                        `No se pudo validar el estado de las plazas: ${error.message}`
                    );
                    return;
                }
            }
        }

        // Numeración siempre comienza desde 1, no se requiere zona de origen

        // Si todas las validaciones pasan, enviar los datos
        enviarDatos();
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
            <Suspense fallback={null}>
                <SearchParamsProvider setZonaParametro={setZonaParametro} />
            </Suspense>
            <div className="p-6 space-y-6">
                <div className="mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">
                            Gestión de Zonas
                        </h1>
                        <p className="text-gray-600 dark:text-zinc-400 mt-1">
                            Administra las zonas de estacionamiento y sus plazas
                        </p>
                    </div>
                    {!mostrarFormulario && (
                        <Button
                            onClick={() => {
                                setMostrarFormulario(true);
                                setModoEdicion(false);
                                // Limpiar formulario
                                setZonaNombre('');
                                setCantidadPlazas(0);
                                setFilas(0);
                                setColumnas(0);
                                setUsarLayout(false);
                                setPrevisualizacion([]);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                            Crear Nueva Zona
                        </Button>
                    )}
                </div>

                {/* Lista de zonas existentes */}
                {!mostrarFormulario && (
                    <Card className="dark:bg-zinc-900 dark:border-zinc-800 mb-6">
                        <CardHeader>
                            <CardTitle className="dark:text-zinc-100">Zonas Existentes</CardTitle>
                            <CardDescription className="dark:text-zinc-400">
                                {cargandoZonas ? 'Cargando zonas...' : 'Administra las zonas configuradas actualmente'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {cargandoZonas ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                        <span>Cargando zonas...</span>
                                    </div>
                                </div>
                            ) : zonasDetalladas.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 dark:text-zinc-400">No hay zonas configuradas aún.</p>
                                    <p className="text-sm text-gray-400 dark:text-zinc-500 mt-2">Haz clic en "Crear Nueva Zona" para comenzar.</p>
                                </div>
                            ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {zonasDetalladas.map((zona) => (
                                    <Card key={zona.zona_nombre} className="dark:bg-zinc-800/50 dark:border-zinc-700 hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <h3 className="font-semibold text-lg text-gray-900 dark:text-zinc-100">{zona.zona_nombre}</h3>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setMostrarFormulario(true);
                                                        setModoEdicion(true);
                                                        cargarInformacionZona(zona.zona_nombre);
                                                    }}
                                                >
                                                    Modificar
                                                </Button>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-600 dark:text-zinc-400">Total de plazas</span>
                                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{zona.total_plazas}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                                        <Car className="w-4 h-4" />
                                                        <span>Autos</span>
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{zona.plazas_auto}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                                        <Bike className="w-4 h-4" />
                                                        <span>Motos</span>
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{zona.plazas_moto}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                                                        <Truck className="w-4 h-4" />
                                                        <span>Camionetas</span>
                                                    </div>
                                                    <span className="font-medium text-gray-900 dark:text-zinc-100">{zona.plazas_camioneta}</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Dialog Modal para creación/edición */}
                <Dialog open={mostrarFormulario} onOpenChange={setMostrarFormulario}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="text-2xl">
                                {modoEdicion ? `Modificar Zona: ${zonaNombre}` : 'Crear Nueva Zona'}
                            </DialogTitle>
                            <DialogDescription>
                                {modoEdicion ? 'Modifica la configuración de la zona existente' : 'Define una nueva zona y configura sus plazas'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Nombre de la zona */}
                            <div className="space-y-2">
                                <Label htmlFor="zona-nombre">
                                    Nombre de la zona
                                    {cargandoZonas && <span className="text-xs text-gray-500 ml-2">(Cargando zonas...)</span>}
                                </Label>
                                <Input
                                    id="zona-nombre"
                                    placeholder="Ej: Zona Norte, Zona VIP, etc."
                                    value={zonaNombre}
                                    onChange={(e) => setZonaNombre(e.target.value)}
                                    className={zonaDuplicada ? "border-red-500 focus:border-red-500" : ""}
                                    disabled={modoEdicion}
                                />

                                {/* Mensaje de error si la zona está duplicada */}
                                {zonaDuplicada && (
                                    <div className="text-sm text-red-600 flex items-center gap-1">
                                        <AlertTriangle className="h-4 w-4" />
                                        Esta zona ya existe. Por favor elige un nombre diferente.
                                    </div>
                                )}
                            </div>

                                {/* Switch para modo de configuración */}
                                <div className="flex items-center justify-between space-x-2">
                                    <div>
                                        <Label htmlFor="usar-layout">Configurar layout de filas y columnas</Label>
                                        <p className="text-xs text-muted-foreground">
                                            Activa para definir filas y columnas específicas
                                        </p>
                                    </div>
                                    <Switch
                                        id="usar-layout"
                                        checked={usarLayout}
                                        onCheckedChange={setUsarLayout}
                                    />
                                </div>

                                {/* Campos de filas y columnas (solo cuando usarLayout está activado) */}
                                {usarLayout && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="filas">
                                                Número de filas
                                                {filas > 0 && <span className="text-sm text-muted-foreground ml-2">({filas} filas)</span>}
                                            </Label>
                                            <Input
                                                id="filas"
                                                type="number"
                                                min="1"
                                                placeholder="Ej: 4"
                                                value={filas || ''}
                                                onChange={(e) => setFilas(parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="columnas">
                                                Número de columnas
                                                {columnas > 0 && <span className="text-sm text-muted-foreground ml-2">({columnas} columnas)</span>}
                                            </Label>
                                            <Input
                                                id="columnas"
                                                type="number"
                                                min="1"
                                                placeholder="Ej: 10"
                                                value={columnas || ''}
                                                onChange={(e) => setColumnas(parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Campo cantidad de plazas (siempre visible y editable) */}
                                <div className="space-y-2">
                                    <Label htmlFor="cantidad-plazas">
                                        Cantidad total de plazas
                                        {usarLayout && filas > 0 && columnas > 0 && (
                                            <span className="text-sm text-muted-foreground ml-2">
                                                (configurado para layout: {filas} × {columnas})
                                            </span>
                                        )}
                                    </Label>
                                    <Input
                                        id="cantidad-plazas"
                                        type="number"
                                        min="1"
                                        placeholder="Ej: 35"
                                        value={cantidadPlazas || ''}
                                        onChange={(e) => {
                                            const nuevoValor = parseInt(e.target.value) || 0;
                                            setCantidadPlazas(nuevoValor);
                                            setTotalEditable(nuevoValor);
                                        }}
                                    />
                                    {usarLayout && filas > 0 && columnas > 0 && cantidadPlazas > 0 && (
                                        <div className="text-xs space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400">
                                                Layout configurado: {filas} filas × {columnas} columnas = {filas * columnas} plazas
                                            </p>
                                            <p className="text-green-600 dark:text-green-400">
                                                Total configurado: {cantidadPlazas} plazas
                                            </p>
                                            {cantidadPlazas !== filas * columnas && (
                                                <div className={`mt-2 p-2 border rounded ${cantidadPlazas > filas * columnas
                                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                                    : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                                                    }`}>
                                                    <p className={`font-medium ${cantidadPlazas > filas * columnas
                                                        ? 'text-red-700 dark:text-red-400'
                                                        : 'text-orange-700 dark:text-orange-400'
                                                        }`}>
                                                        {cantidadPlazas > filas * columnas ? 'Error' : 'Configuración personalizada'}
                                                    </p>
                                                    <p className={`text-xs ${cantidadPlazas > filas * columnas
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-orange-600 dark:text-orange-400'
                                                        }`}>
                                                        El total ({cantidadPlazas}) es {cantidadPlazas < filas * columnas ? 'menor' : 'mayor'} que el layout ({filas * columnas})
                                                    </p>
                                                    {cantidadPlazas > filas * columnas && (
                                                        <p className="text-red-600 dark:text-red-400 text-xs font-medium mt-1">
                                                            Reduce el total o aumenta las filas/columnas
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Información adicional solo cuando no hay layout configurado */}
                                {usarLayout && (filas === 0 || columnas === 0) && (
                                    <div className="text-sm text-gray-600 dark:text-zinc-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                                        Configura filas y columnas para definir el layout de plazas
                                    </div>
                                )}


                                {/* Información de numeración */}
                                <div className="text-sm text-gray-600 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-gray-200 dark:border-zinc-700">
                                    <p className="font-medium text-gray-900 dark:text-zinc-100 mb-1">
                                        Numeración automática
                                    </p>
                                    <p>
                                        Cada zona comienza desde el número 1. Las plazas de diferentes zonas pueden tener los mismos números.
                                    </p>
                                </div>

                            {/* Previsualización */}
                            {previsualizacion.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Previsualización ({previsualizacion.length} plazas)</Label>
                                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-200 dark:border-zinc-700">
                                        <div
                                            className="grid gap-2"
                                            style={{
                                                gridTemplateColumns: `repeat(${usarLayout && columnas > 0 ? columnas : Math.min(10, previsualizacion.length)}, minmax(0, 1fr))`
                                            }}
                                        >
                                            {previsualizacion.map((numero) => (
                                                <div
                                                    key={numero}
                                                    className="aspect-square bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-md flex items-center justify-center text-xs font-medium text-green-800 dark:text-green-300"
                                                >
                                                    {numero}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Botones */}
                            <div className="flex gap-3 pt-4 border-t dark:border-zinc-700">
                                <Button
                                    variant="outline"
                                    onClick={generarPrevisualizacion}
                                    disabled={!zonaNombre.trim() || !cantidadPlazas}
                                    className="flex-1"
                                >
                                    Generar previsualización
                                </Button>
                                <Button
                                    onClick={handleContinuar}
                                    disabled={loading || !zonaNombre.trim() || !cantidadPlazas || zonaDuplicada}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                                >
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {modoEdicion ? 'Guardar Cambios' : 'Crear Zona'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Dialog de error */}
                <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                {errorTitle}
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-left">
                                {errorMessage}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogAction
                                onClick={() => setErrorDialogOpen(false)}
                                className="bg-red-500 hover:bg-red-600"
                            >
                                Entendido
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Dialog de confirmación */}
                <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                    <AlertDialogContent className="max-w-md">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Confirmar Configuración
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-left space-y-2">
                                {confirmData && (
                                    <div className="space-y-2">
                                        <div className="bg-blue-50 p-3 rounded-lg">
                                            <p className="font-medium text-blue-800">📐 Layout Configurado:</p>
                                            <p className="text-blue-700">{confirmData.filas} filas × {confirmData.columnas} columnas = {confirmData.layoutTeorico} plazas</p>
                                        </div>

                                        <div className="bg-green-50 p-3 rounded-lg">
                                            <p className="font-medium text-green-800">🎯 Total Solicitado:</p>
                                            <p className="text-green-700">{confirmData.cantidadFinal} plazas</p>
                                        </div>

                                        <div className="bg-orange-50 p-3 rounded-lg">
                                            <p className="font-medium text-orange-800">⚠️ Diferencia:</p>
                                            <p className="text-orange-700">
                                                Solo se crearán {confirmData.cantidadFinal} plazas en lugar de las {confirmData.layoutTeorico} que caben en el layout.
                                            </p>
                                        </div>

                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            <p className="font-medium text-gray-800">🏷️ Zona:</p>
                                            <p className="text-gray-700">"{confirmData.zonaNombre}"</p>
                                            <p className="text-gray-700 text-sm">Numeración: automática desde 1</p>
                                        </div>
                                    </div>
                                )}

                                <p className="text-sm text-gray-600 mt-4">
                                    ¿Confirmas que quieres proceder con esta configuración?
                                </p>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogAction
                                onClick={handleCancelConfirm}
                                className="border-gray-300 bg-white hover:bg-gray-50"
                            >
                                Cancelar
                            </AlertDialogAction>
                            <AlertDialogAction
                                onClick={handleConfirm}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Confirmar y Crear
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

// Wrapper con Suspense para SSR
export default function ConfiguracionZonaPageWrapper() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-lg text-gray-600">Cargando configuración de zona...</div>
                </div>
            </div>
        }>
            <ConfiguracionZonaPage />
        </Suspense>
    );
}

