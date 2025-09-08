'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Save, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';

// Importar componentes
import { ZonePicker } from './components/ZonePicker';
import { PlazasGrid } from './components/PlazasGrid';
import { SelectionToolbar } from './components/SelectionToolbar';
import { ApplyTemplatePanel } from './components/ApplyTemplatePanel';
import { PresetPanel } from './components/PresetPanel';

// Tipos
interface Plaza {
    numero: number;
    estado: string;
    tipo_vehiculo: string;
    plantilla_actual: {
        plantilla_id: number;
        nombre_plantilla: string;
        catv_segmento: string;
    } | null;
    zona_id: number;
    zona_nombre: string;
}

interface Zona {
    zona_id: number;
    zona_nombre: string;
    grid: {
        rows: number;
        cols: number;
        numbering: string;
    };
}

interface Plantilla {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: string;
    caracteristicas: { [tipo: string]: string[] };
}

interface Preset {
    preset_id: number;
    preset_nombre: string;
    reglas: any[];
}

interface Action {
    tipo: 'APLICAR_PLANTILLA' | 'LIMPIAR_PLANTILLA';
    plantilla_id?: number;
    plazas: number[];
    timestamp: number;
}

const ConfiguracionAvanzadaPage: React.FC = () => {
    // Estados principales
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Datos de la zona y plazas
    const [zonaActual, setZonaActual] = useState<Zona | null>(null);
    const [plazas, setPlazas] = useState<Map<number, Plaza>>(new Map());
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);

    // Estado de selección
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

    // Estado de acciones (para undo/redo)
    const [acciones, setAcciones] = useState<Action[]>([]);
    const [indiceAccionActual, setIndiceAccionActual] = useState(-1);

    // Estados de UI
    const [plantillaSeleccionada, setPlantillaSeleccionada] = useState<number | null>(null);
    const [modoSeleccion, setModoSeleccion] = useState<'individual' | 'rango' | 'fila' | 'columna'>('individual');
    const [previewMode, setPreviewMode] = useState(false);

    // ID del estacionamiento (hardcoded por ahora)
    const estId = 1;

    // Cargar datos iniciales
    useEffect(() => {
        cargarDatosIniciales();
    }, []);

    const cargarDatosIniciales = async () => {
        try {
            setLoading(true);

            // Cargar plantillas disponibles
            const plantillasResponse = await fetch(`/api/plantillas?est_id=${estId}`);
            if (plantillasResponse.ok) {
                const plantillasData = await plantillasResponse.json();
                const plantillasValidas = (plantillasData.plantillas || [])
                    .filter((p: any) => p && p.plantilla_id && p.nombre_plantilla)
                    .map((p: any) => ({
                        plantilla_id: p.plantilla_id,
                        nombre_plantilla: p.nombre_plantilla || 'Sin nombre',
                        catv_segmento: p.catv_segmento || 'AUT',
                        caracteristicas: p.caracteristicas || {}
                    }));
                setPlantillas(plantillasValidas);
            }

            // Cargar presets disponibles
            const presetsResponse = await fetch(`/api/presets?est_id=${estId}`);
            if (presetsResponse.ok) {
                const presetsData = await presetsResponse.json();
                const presetsValidos = (presetsData.presets || [])
                    .filter((p: any) => p && p.preset_id && p.preset_nombre)
                    .map((p: any) => ({
                        preset_id: p.preset_id,
                        preset_nombre: p.preset_nombre || 'Sin nombre',
                        reglas: Array.isArray(p.reglas) ? p.reglas : []
                    }));
                setPresets(presetsValidos);
            }

        } catch (error) {
            console.error('Error cargando datos iniciales:', error);
            toast.error('Error al cargar los datos iniciales');
        } finally {
            setLoading(false);
        }
    };

    // Función para cargar plazas de una zona específica
    const cargarPlazasZona = async (zonaId: number) => {
        try {
            console.log(`🔄 Cargando plazas de zona ${zonaId}...`);
            const response = await fetch(`/api/plazas?est_id=${estId}&zona_id=${zonaId}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Datos cargados: ${data.plazas?.length || 0} plazas`);

                if (data.zona) {
                    setZonaActual(data.zona);
                }

                // Convertir array de plazas a Map
                const plazasMap = new Map<number, Plaza>();
                (data.plazas || []).forEach((plaza: Plaza) => {
                    plazasMap.set(plaza.numero, plaza);
                });

                setPlazas(plazasMap);
                setSeleccion(new Set()); // Limpiar selección
                setAcciones([]); // Limpiar acciones
                setIndiceAccionActual(-1);

                // Mostrar algunas plazas como ejemplo
                if (data.plazas && data.plazas.length > 0) {
                    const primerasPlazas = data.plazas.slice(0, 3);
                    console.log('📋 Primeras plazas cargadas:', primerasPlazas.map(p => ({
                        numero: p.numero,
                        plantilla: p.plantilla_actual ? p.plantilla_actual.nombre_plantilla : 'Sin plantilla'
                    })));
                }

                toast.success(`Zona "${data.zona?.zona_nombre}" cargada con ${data.total_plazas} plazas`);
            } else {
                throw new Error('Error al cargar plazas de la zona');
            }
        } catch (error) {
            console.error('Error cargando plazas:', error);
            toast.error('Error al cargar las plazas de la zona');
        }
    };

    // Función para aplicar plantilla a plazas seleccionadas
    const aplicarPlantilla = useCallback(async (plantillaId: number, plazasSeleccionadas: number[]) => {
        if (plazasSeleccionadas.length === 0) {
            toast.warning('No hay plazas seleccionadas');
            return;
        }

        if (!zonaActual) {
            toast.error('No hay zona seleccionada');
            return;
        }

        try {
            const accionesToApply = [{
                tipo: 'APLICAR_PLANTILLA' as const,
                plantilla_id: plantillaId,
                plazas: plazasSeleccionadas
            }];

            // Aplicar localmente para preview inmediato
            const nuevaAccion: Action = {
                tipo: 'APLICAR_PLANTILLA',
                plantilla_id: plantillaId,
                plazas: plazasSeleccionadas,
                timestamp: Date.now()
            };

            // Actualizar estado local
            setPlazas(prevPlazas => {
                const nuevasPlazas = new Map(prevPlazas);
                const plantilla = plantillas.find(p => p && p.plantilla_id === plantillaId);

                plazasSeleccionadas.forEach(plazaNum => {
                    const plazaActual = nuevasPlazas.get(plazaNum);
                    if (plazaActual) {
                        nuevasPlazas.set(plazaNum, {
                            ...plazaActual,
                            plantilla_actual: plantilla ? {
                                plantilla_id: plantilla.plantilla_id,
                                nombre_plantilla: plantilla.nombre_plantilla || 'Sin nombre',
                                catv_segmento: plantilla.catv_segmento || 'AUT'
                            } : null
                        });
                    }
                });

                return nuevasPlazas;
            });

            // Agregar acción al historial
            setAcciones(prevAcciones => {
                const nuevasAcciones = prevAcciones.slice(0, indiceAccionActual + 1);
                nuevasAcciones.push(nuevaAccion);
                return nuevasAcciones;
            });
            setIndiceAccionActual(prev => prev + 1);

            if (!previewMode) {
                // Aplicar en la base de datos
                await aplicarCambiosEnBD(accionesToApply);
            }

            toast.success(`${plazasSeleccionadas.length} plazas actualizadas`);

        } catch (error) {
            console.error('Error aplicando plantilla:', error);
            toast.error('Error al aplicar la plantilla');
        }
    }, [zonaActual, plantillas, previewMode]);

    // Función para limpiar plantillas de plazas seleccionadas
    const limpiarPlantillas = useCallback(async (plazasSeleccionadas: number[]) => {
        if (plazasSeleccionadas.length === 0) {
            toast.warning('No hay plazas seleccionadas');
            return;
        }

        if (!zonaActual) {
            toast.error('No hay zona seleccionada');
            return;
        }

        try {
            const accionesToApply = [{
                tipo: 'LIMPIAR_PLANTILLA' as const,
                plazas: plazasSeleccionadas
            }];

            // Aplicar localmente para preview inmediato
            const nuevaAccion: Action = {
                tipo: 'LIMPIAR_PLANTILLA',
                plazas: plazasSeleccionadas,
                timestamp: Date.now()
            };

            // Actualizar estado local
            setPlazas(prevPlazas => {
                const nuevasPlazas = new Map(prevPlazas);
                plazasSeleccionadas.forEach(plazaNum => {
                    const plazaActual = nuevasPlazas.get(plazaNum);
                    if (plazaActual) {
                        nuevasPlazas.set(plazaNum, {
                            ...plazaActual,
                            plantilla_actual: null
                        });
                    }
                });
                return nuevasPlazas;
            });

            // Agregar acción al historial
            setAcciones(prevAcciones => {
                const nuevasAcciones = prevAcciones.slice(0, indiceAccionActual + 1);
                nuevasAcciones.push(nuevaAccion);
                return nuevasAcciones;
            });
            setIndiceAccionActual(prev => prev + 1);

            if (!previewMode) {
                // Aplicar en la base de datos
                await aplicarCambiosEnBD(accionesToApply);
            }

            toast.success(`${plazasSeleccionadas.length} plazas limpiadas`);

        } catch (error) {
            console.error('Error limpiando plantillas:', error);
            toast.error('Error al limpiar las plantillas');
        }
    }, [zonaActual, previewMode]);

    // Función para aplicar cambios en la base de datos
    const aplicarCambiosEnBD = async (accionesToApply: any[]) => {
        if (!zonaActual) return;

        console.log('🔄 Enviando acciones a BD:', accionesToApply);

        try {
            setSaving(true);

            const requestBody = {
                est_id: estId,
                zona_id: zonaActual.zona_id,
                acciones: accionesToApply
            };

            console.log('📤 Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('/api/plazas/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log('📥 Response status:', response.status);

            const data = await response.json();
            console.log('📥 Response data:', data);

            if (!response.ok) {
                throw new Error(data.error || 'Error al aplicar cambios');
            }

            // Mostrar warnings si los hay
            if (data.warnings && data.warnings.length > 0) {
                data.warnings.forEach((warning: string) => {
                    toast.warning(warning);
                });
            }

            const totalPlazasProcesadas = accionesToApply.reduce((total, accion) => total + accion.plazas.length, 0);

            if (data.message) {
                toast.success(data.message);
            } else if (data.skipped && data.skipped > 0) {
                toast.success(`${data.updated} plazas actualizadas de ${totalPlazasProcesadas} procesadas (${data.skipped} omitidas)`);
            } else {
                toast.success(`${data.updated} plazas actualizadas de ${totalPlazasProcesadas} procesadas`);
            }

        } catch (error: any) {
            console.error('❌ Error aplicando cambios en BD:', error);
            toast.error(error.message || 'Error al guardar los cambios');
            throw error;
        } finally {
            setSaving(false);
        }
    };

    // Función para deshacer la última acción
    const deshacer = useCallback(() => {
        if (indiceAccionActual < 0) {
            toast.warning('No hay acciones para deshacer');
            return;
        }

        const accionActual = acciones[indiceAccionActual];
        const plantilla = plantillas.find(p => p.plantilla_id === accionActual.plantilla_id);

        // Revertir la acción localmente
        setPlazas(prevPlazas => {
            const nuevasPlazas = new Map(prevPlazas);

            if (accionActual.tipo === 'APLICAR_PLANTILLA') {
                // Para deshacer aplicar plantilla, limpiamos las plazas
                accionActual.plazas.forEach(plazaNum => {
                    const plazaActual = nuevasPlazas.get(plazaNum);
                    if (plazaActual) {
                        nuevasPlazas.set(plazaNum, {
                            ...plazaActual,
                            plantilla_actual: null
                        });
                    }
                });
            } else if (accionActual.tipo === 'LIMPIAR_PLANTILLA') {
                // Para deshacer limpiar plantilla, restauramos la plantilla anterior
                // Nota: Esto es simplificado, en una implementación real necesitaríamos
                // guardar el estado anterior de cada plaza
                accionActual.plazas.forEach(plazaNum => {
                    const plazaActual = nuevasPlazas.get(plazaNum);
                    if (plazaActual) {
                        // Aquí restauraríamos la plantilla anterior si la tuviéramos guardada
                    }
                });
            }

            return nuevasPlazas;
        });

        setIndiceAccionActual(prev => prev - 1);
        toast.success('Acción deshecha');
    }, [indiceAccionActual, acciones, plantillas]);

    // Función para confirmar todos los cambios
    const confirmarCambios = useCallback(async () => {
        if (acciones.length === 0) {
            toast.warning('No hay cambios para confirmar');
            return;
        }

        try {
            setSaving(true);

            // Convertir acciones del historial a formato de API
            const accionesToApply = acciones.slice(0, indiceAccionActual + 1).map(accion => ({
                tipo: accion.tipo,
                plantilla_id: accion.plantilla_id,
                plazas: accion.plazas
            }));

            await aplicarCambiosEnBD(accionesToApply);

            // Recargar datos desde el servidor para reflejar los cambios guardados
            console.log('🔄 Recargando datos desde el servidor después de guardar...');
            if (zonaActual) {
                await cargarPlazasZona(zonaActual.zona_id);
            }

            // Limpiar historial después de confirmar
            setAcciones([]);
            setIndiceAccionActual(-1);

            toast.success('Todos los cambios han sido confirmados y aplicados');

        } catch (error) {
            console.error('Error confirmando cambios:', error);
        } finally {
            setSaving(false);
        }
    }, [acciones, indiceAccionActual, zonaActual, cargarPlazasZona]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Cargando configuración avanzada...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold">
                        Configuración Avanzada de Plazas
                    </h1>
                    <p className="text-muted-foreground">
                        Gestiona las plantillas de plazas de manera visual e intuitiva
                    </p>
                </div>

                {/* Layout principal */}
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    {/* Panel izquierdo: Controles */}
                    <div className="xl:col-span-1 space-y-6">
                        <ZonePicker
                            zonaActual={zonaActual}
                            onZonaChange={cargarPlazasZona}
                            estId={estId}
                        />

                        <SelectionToolbar
                            seleccion={seleccion}
                            setSeleccion={setSeleccion}
                            modoSeleccion={modoSeleccion}
                            setModoSeleccion={setModoSeleccion}
                            zonaActual={zonaActual}
                            plazas={plazas}
                        />

                        <ApplyTemplatePanel
                            plantillas={plantillas}
                            plantillaSeleccionada={plantillaSeleccionada}
                            setPlantillaSeleccionada={setPlantillaSeleccionada}
                            onAplicarPlantilla={() => aplicarPlantilla(plantillaSeleccionada!, Array.from(seleccion))}
                            onLimpiarPlantillas={() => limpiarPlantillas(Array.from(seleccion))}
                            seleccion={seleccion}
                            previewMode={previewMode}
                            setPreviewMode={setPreviewMode}
                        />

                        <PresetPanel
                            presets={presets}
                            zonaActual={zonaActual}
                            onAplicarPreset={(presetId) => {/* Implementar */ }}
                            onCrearPreset={() => {/* Implementar */ }}
                            estId={estId}
                        />
                    </div>

                    {/* Panel derecho: Grid de plazas */}
                    <div className="xl:col-span-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>
                                        {zonaActual ? `Zona: ${zonaActual.zona_nombre}` : 'Selecciona una zona'}
                                    </span>
                                    <div className="flex gap-2">
                                        {acciones.length > 0 && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={deshacer}
                                                disabled={indiceAccionActual < 0}
                                            >
                                                <RotateCcw className="h-4 w-4 mr-2" />
                                                Deshacer
                                            </Button>
                                        )}
                                        <Button
                                            onClick={confirmarCambios}
                                            disabled={saving || acciones.length === 0}
                                            size="sm"
                                        >
                                            {saving ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <CheckCircle className="h-4 w-4 mr-2" />
                                            )}
                                            Confirmar Cambios
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription>
                                    {zonaActual ? (
                                        <>
                                            Grid: {zonaActual.grid.rows} × {zonaActual.grid.cols} plazas
                                            {seleccion.size > 0 && (
                                                <span className="ml-2 text-blue-600">
                                                    • {seleccion.size} plazas seleccionadas
                                                </span>
                                            )}
                                            {acciones.length > 0 && (
                                                <span className="ml-2 text-orange-600">
                                                    • {acciones.length} cambios pendientes
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        'Selecciona una zona para comenzar'
                                    )}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center">
                                {zonaActual ? (
                                    <PlazasGrid
                                        zona={zonaActual}
                                        plazas={plazas}
                                        seleccion={seleccion}
                                        onSeleccionChange={setSeleccion}
                                        modoSeleccion={modoSeleccion}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-96 text-muted-foreground">
                                        <div className="text-center">
                                            <div className="text-6xl mb-4">🏗️</div>
                                            <p>Selecciona una zona para ver el grid de plazas</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfiguracionAvanzadaPage;
