'use client';


import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
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
    const { checkZoneExists, loadZoneInfo, configureZoneComplete } = useZoneManagement(estId);

    // Estados del formulario
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
    const [cargandoZonas, setCargandoZonas] = useState<boolean>(false);
    const [zonaDuplicada, setZonaDuplicada] = useState<boolean>(false);

    // Obtener el parámetro de zona de la URL
    const [zonaParametro, setZonaParametro] = React.useState<string | null>(null);

    // Sincronización simple: mantener totalEditable actualizado
    React.useEffect(() => {
        if (cantidadPlazas > 0) {
            setTotalEditable(cantidadPlazas);
        }
    }, [cantidadPlazas]);

    // Cargar configuración de zona existente si viene por parámetro
    React.useEffect(() => {
        if (zonaParametro && estId) {
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

    // Función para cargar zonas existentes
    const cargarZonasExistentes = async () => {
        if (!estId) return;

        try {
            setCargandoZonas(true);
            const response = await fetch(`/api/zonas?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                const nombresZonas = data.zonas?.map((zona: any) => zona.zona_nombre) || [];
                setZonasExistentes(nombresZonas);
                console.log('📋 Zonas existentes cargadas:', nombresZonas);
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

        // Numeración siempre comienza desde 1, no se requiere zona de origen

        // Si todas las validaciones pasan, enviar los datos
        enviarDatos();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Suspense fallback={null}>
                <SearchParamsProvider setZonaParametro={setZonaParametro} />
            </Suspense>
            <div className="p-6 space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">
                        Configuración de Zona {zonaParametro ? `- ${zonaParametro}` : ''}
                    </h1>
                    <p className="text-muted-foreground">
                        {zonaParametro
                            ? `Configura plazas adicionales para la zona "${zonaParametro}"`
                            : 'Define una nueva zona de estacionamiento y genera automáticamente sus plazas'
                        }
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Formulario - Columna Izquierda */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información de la Zona</CardTitle>
                                <CardDescription>
                                    Completa los datos para crear la nueva zona
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
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
                                    />

                                    {/* Mensaje de error si la zona está duplicada */}
                                    {zonaDuplicada && (
                                        <div className="text-sm text-red-600 flex items-center gap-1">
                                            <AlertTriangle className="h-4 w-4" />
                                            Esta zona ya existe. Por favor elige un nombre diferente.
                                        </div>
                                    )}

                                    {/* Lista de zonas existentes */}
                                    {zonasExistentes.length > 0 && (
                                        <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                                            <strong>Zonas existentes:</strong> {zonasExistentes.join(', ')}
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
                                            <p className="text-blue-600">
                                                📐 Layout configurado: {filas} filas × {columnas} columnas = {filas * columnas} plazas
                                            </p>
                                            <p className="text-green-600">
                                                🎯 Total configurado: {cantidadPlazas} plazas
                                            </p>
                                            {cantidadPlazas !== filas * columnas && (
                                                <div className={`mt-2 p-2 border rounded ${cantidadPlazas > filas * columnas
                                                    ? 'bg-red-50 border-red-200'
                                                    : 'bg-orange-50 border-orange-200'
                                                    }`}>
                                                    <p className={`font-medium ${cantidadPlazas > filas * columnas
                                                        ? 'text-red-700'
                                                        : 'text-orange-700'
                                                        }`}>
                                                        {cantidadPlazas > filas * columnas ? '🚨 Error' : '⚠️ Configuración personalizada'}
                                                    </p>
                                                    <p className={`text-xs ${cantidadPlazas > filas * columnas
                                                        ? 'text-red-600'
                                                        : 'text-orange-600'
                                                        }`}>
                                                        El total ({cantidadPlazas}) es {cantidadPlazas < filas * columnas ? 'menor' : 'mayor'} que el layout ({filas * columnas})
                                                    </p>
                                                    {cantidadPlazas > filas * columnas && (
                                                        <p className="text-red-600 text-xs font-medium mt-1">
                                                            💡 Reduce el total o aumenta las filas/columnas
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Información adicional solo cuando no hay layout configurado */}
                                {usarLayout && (filas === 0 || columnas === 0) && (
                                    <div className="text-sm text-muted-foreground">
                                        💡 Configura filas y columnas para definir el layout de plazas
                                    </div>
                                )}


                                {/* Información de numeración */}
                                <div className="space-y-2">
                                    <Label>Información de numeración</Label>
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                        <p className="text-sm text-blue-800">
                                            <span className="font-medium">🔢 Numeración automática:</span> Cada zona comienza desde el número 1
                                        </p>
                                        <p className="text-sm text-blue-700 mt-1">
                                            Las plazas de diferentes zonas pueden tener los mismos números
                                        </p>
                                    </div>
                                </div>

                                {/* Botones */}
                                <div className="flex gap-3 pt-4">
                                    <Button
                                        variant="outline"
                                        onClick={generarPrevisualizacion}
                                        disabled={!zonaNombre.trim() || !cantidadPlazas}
                                    >
                                        Generar previsualización
                                    </Button>
                                    <Button
                                        onClick={handleContinuar}
                                        disabled={loading || !zonaNombre.trim() || !cantidadPlazas || zonaDuplicada}
                                    >
                                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Continuar
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Previsualización - Columna Derecha */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Previsualización de la zona</CardTitle>
                                <CardDescription>
                                    {previsualizacion.length > 0
                                        ? `${previsualizacion.length} plazas generadas`
                                        : 'Genera una previsualización para ver las plazas'
                                    }
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {previsualizacion.length > 0 ? (
                                    <div
                                        className="grid gap-2"
                                        style={{
                                            gridTemplateColumns: `repeat(${usarLayout && columnas > 0 ? columnas : 5}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {previsualizacion.map((numero) => (
                                            <div
                                                key={numero}
                                                className="aspect-square bg-green-100 border border-green-300 rounded-md flex items-center justify-center text-sm font-medium text-green-800 hover:bg-green-200 transition-colors"
                                            >
                                                {numero}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-64 text-muted-foreground">
                                        <div className="text-center">
                                            <div className="text-4xl mb-2">👁️</div>
                                            <p>Haz clic en "Generar previsualización"</p>
                                            <p className="text-sm">para ver cómo quedarán las plazas</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

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

