"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Edit, Trash2, Plus, DollarSign, CircleDollarSign } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCaracteristicas } from "@/lib/hooks/use-caracteristicas";
import type { Caracteristica, Plantilla, PlantillaForm } from "@/lib/types";
import { DuplicateTemplateDialog } from "@/components/duplicate-template-dialog";

interface TariffPrices {
    hora: string;
    dia: string;
    mes: string;
    semana: string;
}

export default function GestionPlantillasPage() {
    const { estId } = useAuth();
    const [saving, setSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState<'plantilla' | 'tarifas'>('plantilla');
    const [savedPlantillaId, setSavedPlantillaId] = useState<number | null>(null);
    const [isStandaloneTarifas, setIsStandaloneTarifas] = useState(false);

    // Estados para tarifas
    const [loadingTarifas, setLoadingTarifas] = useState(false);
    const [prices, setPrices] = useState<TariffPrices>({
        hora: '',
        dia: '',
        mes: '',
        semana: ''
    });

    // Estados para los datos
    const { caracteristicas: allCaracteristicas, loading: loadingCaracteristicas } = useCaracteristicas();
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
    const [loadingPlantillas, setLoadingPlantillas] = useState(false);

    // Estado de carga general
    const loading = loadingCaracteristicas || loadingPlantillas;

    // useCallback para evitar doble montaje
    const loadInitialDataCallback = useCallback(async () => {
        if (!estId || loadingCaracteristicas) return;

        try {
            setLoadingPlantillas(true);

            const plantillasRes = await fetch(`/api/plantillas?est_id=${estId}`);

            if (!plantillasRes.ok) {
                throw new Error('Error al cargar plantillas');
            }
            const plantillasData = await plantillasRes.json();
            setPlantillas(plantillasData.plantillas || []);

        } catch (error: any) {
            console.error('Error cargando datos iniciales:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al cargar los datos"
            });
        } finally {
            setLoadingPlantillas(false);
        }
    }, [estId, loadingCaracteristicas]);

    // Carga inicial de datos
    useEffect(() => {
        loadInitialDataCallback();
    }, [loadInitialDataCallback]);

    // Estado para el formulario
    const [currentTemplate, setCurrentTemplate] = useState<PlantillaForm>({
        nombre_plantilla: '',
        catv_segmento: 'AUT',
        caracteristica_ids: []
    });

    // Estado para el diálogo de duplicados
    const [duplicateDialog, setDuplicateDialog] = useState<{
        isOpen: boolean;
        type: 'name' | 'config';
        existingTemplate: { plantilla_id: number; nombre_plantilla: string };
        newTemplateName: string;
    }>({
        isOpen: false,
        type: 'name',
        existingTemplate: { plantilla_id: 0, nombre_plantilla: '' },
        newTemplateName: ''
    });

    const loadPlantillas = async () => {
        if (!estId) return;

        const plantillasRes = await fetch(`/api/plantillas?est_id=${estId}`);
        if (!plantillasRes.ok) {
            throw new Error('Error al cargar plantillas');
        }
        const plantillasData = await plantillasRes.json();
        setPlantillas(plantillasData.plantillas || []);
    };

    // Cargar tarifas existentes
    const loadExistingTarifas = async (plantillaId: number) => {
        if (!estId) return;

        try {
            setLoadingTarifas(true);
            const response = await fetch(`/api/tarifas?est_id=${estId}`);

            if (!response.ok) {
                throw new Error('Error al cargar precios existentes');
            }

            const data = await response.json();
            const plantillaData = data.tarifas?.find((p: any) => p.plantilla_id === plantillaId);

            if (plantillaData?.tarifas) {
                setPrices({
                    hora: plantillaData.tarifas['1']?.precio?.toString() || '',
                    dia: plantillaData.tarifas['2']?.precio?.toString() || '',
                    mes: plantillaData.tarifas['3']?.precio?.toString() || '',
                    semana: plantillaData.tarifas['4']?.precio?.toString() || ''
                });
            } else {
                // Resetear si no hay tarifas
                setPrices({ hora: '', dia: '', mes: '', semana: '' });
            }
        } catch (error: any) {
            console.error('Error cargando precios:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron cargar los precios existentes"
            });
        } finally {
            setLoadingTarifas(false);
        }
    };

    // Funciones para manejar el formulario
    const resetForm = () => {
        setCurrentTemplate({
            nombre_plantilla: '',
            catv_segmento: 'AUT',
            caracteristica_ids: []
        });
        setPrices({ hora: '', dia: '', mes: '', semana: '' });
        setModalStep('plantilla');
        setSavedPlantillaId(null);
        setIsStandaloneTarifas(false);
    };

    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    // Prepara el estado del formulario para reusar en los flujos de edición
    const prepareTemplateForEditing = (template: Plantilla, targetStep: 'plantilla' | 'tarifas') => {
        // Convertir las características agrupadas a una lista de IDs
        const caracteristicaIds: number[] = [];
        Object.values(template.caracteristicas).forEach(caracteristicas => {
            caracteristicas.forEach(valor => {
                const caracteristica = allCaracteristicas.find(c => c.valor === valor);
                if (caracteristica) {
                    caracteristicaIds.push(caracteristica.caracteristica_id);
                }
            });
        });

        setCurrentTemplate({
            plantilla_id: template.plantilla_id,
            nombre_plantilla: template.nombre_plantilla,
            catv_segmento: template.catv_segmento,
            caracteristica_ids: caracteristicaIds
        });
        setSavedPlantillaId(template.plantilla_id);

        // Cargar tarifas existentes si está editando
        if (template.plantilla_id && targetStep === 'tarifas') {
            loadExistingTarifas(template.plantilla_id);
        }

        setIsStandaloneTarifas(targetStep === 'tarifas');
        setModalStep(targetStep);
        setIsModalOpen(true);
    };

    const handleEditTemplate = (template: Plantilla) => {
        prepareTemplateForEditing(template, 'plantilla');
    };

    const handleEditTarifas = (template: Plantilla) => {
        prepareTemplateForEditing(template, 'tarifas');
    };

    const handleDeleteTemplate = async (plantillaId: number) => {
        if (!confirm('¿Estás seguro de que quieres eliminar esta plantilla?')) {
            return;
        }

        try {
            const response = await fetch('/api/plantillas', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plantilla_id: plantillaId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al eliminar plantilla');
            }

            toast({
                title: "Éxito",
                description: "Plantilla eliminada correctamente"
            });

            await loadPlantillas();

        } catch (error: any) {
            console.error('Error eliminando plantilla:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al eliminar plantilla"
            });
        }
    };

    const handleSavePlantilla = async () => {
        if (!currentTemplate.nombre_plantilla.trim()) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "El nombre de la plantilla es obligatorio"
            });
            return;
        }

        if (!estId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo determinar el estacionamiento"
            });
            return;
        }

        try {
            setSaving(true);

            const method = currentTemplate.plantilla_id ? 'PUT' : 'POST';
            const body = {
                ...(currentTemplate.plantilla_id && { plantilla_id: currentTemplate.plantilla_id }),
                est_id: estId,
                nombre_plantilla: currentTemplate.nombre_plantilla,
                catv_segmento: currentTemplate.catv_segmento,
                caracteristica_ids: currentTemplate.caracteristica_ids
            };

            const response = await fetch('/api/plantillas', {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json();

                if (response.status === 409 && errorData.error_code) {
                    setDuplicateDialog({
                        isOpen: true,
                        type: errorData.error_code === 'DUPLICATE_NAME' ? 'name' : 'config',
                        existingTemplate: errorData.existing_template,
                        newTemplateName: currentTemplate.nombre_plantilla
                    });
                    return;
                }

                throw new Error(errorData.error || 'Error al guardar plantilla');
            }

            const data = await response.json();

            // La API retorna { plantilla: {...} } en POST y { success: true, plantilla_id: X } en PUT
            // Necesitamos manejar ambos casos
            const isEditing = Boolean(currentTemplate.plantilla_id);
            let plantillaId: number;

            if (isEditing) {
                // Caso de UPDATE (PUT)
                plantillaId = data.plantilla_id || currentTemplate.plantilla_id;
            } else {
                // Caso de CREATE (POST) - la respuesta es { plantilla: { plantilla_id: X, ... } }
                plantillaId = data.plantilla?.plantilla_id || data.plantilla_id;
            }

            // Debug: verificar qué devuelve la API
            console.log('Respuesta API plantilla:', data);
            console.log('ID de plantilla obtenido:', plantillaId);

            if (!plantillaId) {
                console.error('No se pudo determinar el plantilla_id');
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No se pudo obtener el ID de la plantilla creada/actualizada"
                });
                return;
            }

            toast({
                title: "Éxito",
                description: currentTemplate.plantilla_id
                    ? "Plantilla actualizada correctamente"
                    : "Plantilla creada correctamente"
            });

            if (isEditing) {
                await loadPlantillas();
                setIsModalOpen(false);
                resetForm();
                return;
            }

            // Guardar el ID de la nueva plantilla para el paso de tarifas
            setSavedPlantillaId(plantillaId);
            setIsStandaloneTarifas(false);

            // Cargar tarifas existentes para la nueva plantilla
            await loadExistingTarifas(plantillaId);

            setModalStep('tarifas');

        } catch (error: any) {
            console.error('Error guardando plantilla:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al guardar plantilla"
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePriceChange = (field: keyof TariffPrices, value: string) => {
        // Solo permitir números y un punto decimal
        const regex = /^\d*\.?\d*$/;
        if (regex.test(value) || value === '') {
            setPrices(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const handleSaveTarifas = async () => {
        if (!savedPlantillaId || !estId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo determinar la plantilla"
            });
            return;
        }

        try {
            setSaving(true);

            // Preparar los datos para enviar
            const tarifas = [];

            // Hora (tipo 1)
            if (prices.hora) {
                tarifas.push({
                    plantilla_id: savedPlantillaId,
                    tiptar_nro: 1,
                    tar_precio: parseFloat(prices.hora),
                    tar_fraccion: parseFloat(prices.hora)
                });
            }

            // Día (tipo 2)
            if (prices.dia) {
                tarifas.push({
                    plantilla_id: savedPlantillaId,
                    tiptar_nro: 2,
                    tar_precio: parseFloat(prices.dia),
                    tar_fraccion: parseFloat(prices.dia)
                });
            }

            // Mes (tipo 3)
            if (prices.mes) {
                tarifas.push({
                    plantilla_id: savedPlantillaId,
                    tiptar_nro: 3,
                    tar_precio: parseFloat(prices.mes),
                    tar_fraccion: parseFloat(prices.mes)
                });
            }

            // Semana (tipo 4)
            if (prices.semana) {
                tarifas.push({
                    plantilla_id: savedPlantillaId,
                    tiptar_nro: 4,
                    tar_precio: parseFloat(prices.semana),
                    tar_fraccion: parseFloat(prices.semana)
                });
            }

            if (tarifas.length === 0) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Debes ingresar al menos un precio"
                });
                return;
            }

            const response = await fetch(`/api/tarifas?est_id=${estId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tarifas })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al guardar tarifas');
            }

            const data = await response.json();

            toast({
                title: "¡Éxito!",
                description: `Se guardaron ${data.tarifas_actualizadas} tarifas correctamente`
            });

            // Recargar plantillas y cerrar modal
            await loadPlantillas();
            resetForm();
            setIsModalOpen(false);

        } catch (error: any) {
            console.error('Error guardando tarifas:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al guardar las tarifas"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleCaracteristicaToggle = (caracteristicaId: number) => {
        const caracteristica = allCaracteristicas.find(c => c.caracteristica_id === caracteristicaId);
        if (!caracteristica) return;

        const tipo = caracteristica.caracteristica_tipos.nombre_tipo;

        setCurrentTemplate(prev => {
            const isCurrentlySelected = prev.caracteristica_ids.includes(caracteristicaId);
            let newCaracteristicaIds = [...prev.caracteristica_ids];

            if (isCurrentlySelected) {
                newCaracteristicaIds = newCaracteristicaIds.filter(id => id !== caracteristicaId);
            } else {
                if (tipo === 'Techo') {
                    const caracteristicasDelTipo = allCaracteristicas
                        .filter(c => c.caracteristica_tipos.nombre_tipo === 'Techo')
                        .map(c => c.caracteristica_id);

                    newCaracteristicaIds = newCaracteristicaIds.filter(id => !caracteristicasDelTipo.includes(id));
                    newCaracteristicaIds.push(caracteristicaId);
                } else {
                    newCaracteristicaIds.push(caracteristicaId);
                }
            }

            return {
                ...prev,
                caracteristica_ids: newCaracteristicaIds
            };
        });
    };

    const handleDuplicateDialogClose = () => {
        setDuplicateDialog(prev => ({ ...prev, isOpen: false }));
    };

    const getVehicleDisplayValue = (segmento: string) => {
        switch (segmento) {
            case 'AUT': return 'Auto';
            case 'MOT': return 'Moto';
            case 'CAM': return 'Camioneta';
            default: return 'Auto';
        }
    };

    const getVehicleSegmentValue = (displayValue: string) => {
        switch (displayValue) {
            case 'Auto': return 'AUT';
            case 'Moto': return 'MOT';
            case 'Camioneta': return 'CAM';
            default: return 'AUT';
        }
    };

    // Agrupar características por tipo
    const caracteristicasPorTipo = allCaracteristicas.reduce((acc, caracteristica) => {
        const tipo = caracteristica.caracteristica_tipos.nombre_tipo;
        if (!acc[tipo]) {
            acc[tipo] = [];
        }
        acc[tipo].push(caracteristica);
        return acc;
    }, {} as Record<string, Caracteristica[]>);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const isInDashboard = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

    return (
        <TooltipProvider>
            <div className={`container mx-auto p-6 max-w-7xl min-h-screen ${isInDashboard ? '' : 'bg-white'}`}>
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Plantillas y Tarifas</h1>
                    <p className="text-gray-600 mt-1">Define y gestiona diferentes tipos de plazas de estacionamiento y sus tarifas</p>
                </div>

                {/* Botón Crear Plantilla - Arriba de la tabla */}
                <div className="mb-4">
                    <Button
                        onClick={openCreateModal}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Crear Plantilla
                    </Button>
                </div>

                {/* Tabla de Plantillas */}
                <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                    <CardContent className="pt-6">
                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Nombre</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Vehículo</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Techo</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Seguridad</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Conectividad</th>
                                        <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantillas.length === 0 ? (
                                        <tr className="bg-white">
                                            <td colSpan={6} className="py-12 px-4 text-center text-gray-500 border-t border-gray-300">
                                                No hay plantillas creadas. Haz clic en "Crear Plantilla" para comenzar.
                                            </td>
                                        </tr>
                                    ) : (
                                        plantillas.map((plantilla) => (
                                            <tr key={plantilla.plantilla_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium">
                                                    {plantilla.nombre_plantilla}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                    {getVehicleDisplayValue(plantilla.catv_segmento)}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                    {plantilla.caracteristicas['Techo']?.map((valor, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 mb-1">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                                                            <span className="text-sm text-gray-800">{valor}</span>
                                                        </div>
                                                    )) || <span className="text-gray-400 italic">-</span>}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                    {plantilla.caracteristicas['Seguridad']?.map((valor, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 mb-1">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"></div>
                                                            <span className="text-sm text-gray-800">{valor}</span>
                                                        </div>
                                                    )) || <span className="text-gray-400 italic">-</span>}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                    {plantilla.caracteristicas['Conectividad']?.map((valor, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 mb-1">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0"></div>
                                                            <span className="text-sm text-gray-800">{valor}</span>
                                                        </div>
                                                    )) || <span className="text-gray-400 italic">-</span>}
                                                </td>
                                                <td className="py-4 px-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleEditTemplate(plantilla)}
                                                                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded px-2 py-1"
                                                                    title="Editar plantilla"
                                                                >
                                                                    <Edit className="h-4 w-4 mr-1" />
                                                                    <span className="text-xs font-medium">Editar</span>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                Editar plantilla
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleEditTarifas(plantilla)}
                                                                    className="text-green-600 hover:text-green-800 hover:bg-green-50 border border-transparent hover:border-green-200 rounded px-2 py-1"
                                                                    title="Editar tarifas"
                                                                >
                                                                    <CircleDollarSign className="h-4 w-4 mr-1" />
                                                                    <span className="text-xs font-medium">Tarifas</span>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                Editar tarifas
                                                            </TooltipContent>
                                                        </Tooltip>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => plantilla.plantilla_id && handleDeleteTemplate(plantilla.plantilla_id)}
                                                                    className="text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 rounded px-2 py-1"
                                                                    title="Eliminar plantilla"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-1" />
                                                                    <span className="text-xs font-medium">Eliminar</span>
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                Eliminar plantilla
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Modal Crear/Editar Plantilla con 2 Pasos */}
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                if (!open) {
                    resetForm();
                }
                setIsModalOpen(open);
            }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {modalStep === 'plantilla'
                                ? (currentTemplate.plantilla_id ? 'Editar Plantilla' : 'Crear Plantilla')
                                : `Definir tarifas • ${currentTemplate.nombre_plantilla}`
                            }
                        </DialogTitle>
                        {modalStep === 'tarifas' && (
                            <p className="text-sm text-gray-600">
                                Vehículo: {getVehicleDisplayValue(currentTemplate.catv_segmento)}
                            </p>
                        )}
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* PASO 1: Formulario de Plantilla */}
                        {modalStep === 'plantilla' && (
                            <>
                                {/* Campo Nombre */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block text-gray-700">Nombre</label>
                                    <Input
                                        value={currentTemplate.nombre_plantilla}
                                        onChange={(e) => setCurrentTemplate(prev => ({ ...prev, nombre_plantilla: e.target.value }))}
                                        placeholder="Ej: Auto estándar"
                                        className="bg-white border-gray-300"
                                    />
                                </div>

                                {/* Campo Tipo de Vehículo */}
                                <div>
                                    <label className="text-sm font-medium mb-2 block text-gray-700">Tipo de vehículo</label>
                                    <Select
                                        value={getVehicleDisplayValue(currentTemplate.catv_segmento)}
                                        onValueChange={(value) => setCurrentTemplate(prev => ({
                                            ...prev,
                                            catv_segmento: getVehicleSegmentValue(value)
                                        }))}
                                    >
                                        <SelectTrigger className="bg-white border-gray-300">
                                            <SelectValue placeholder="Selecciona un tipo de vehículo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Auto">Auto</SelectItem>
                                            <SelectItem value="Moto">Moto</SelectItem>
                                            <SelectItem value="Camioneta">Camioneta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Características */}
                                <div>
                                    <label className="text-sm font-medium mb-4 block text-gray-700">Características</label>
                                    <div className="space-y-4">
                                        {Object.entries(caracteristicasPorTipo).map(([tipo, caracteristicas]) => (
                                            <div key={tipo}>
                                                <h4 className="text-sm font-medium mb-2 text-gray-700">{tipo}</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {caracteristicas.map((caracteristica) => (
                                                        <button
                                                            key={caracteristica.caracteristica_id}
                                                            type="button"
                                                            className={`px-4 py-2 text-sm rounded-full transition-colors border ${currentTemplate.caracteristica_ids.includes(caracteristica.caracteristica_id)
                                                                ? 'bg-blue-600 text-white border-transparent'
                                                                : 'bg-gray-100 text-gray-800 border-transparent hover:bg-gray-200'
                                                                }`}
                                                            onClick={() => handleCaracteristicaToggle(caracteristica.caracteristica_id)}
                                                        >
                                                            {caracteristica.valor}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* PASO 2: Formulario de Tarifas */}
                        {modalStep === 'tarifas' && (
                            <>
                                {loadingTarifas ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                        <span className="text-gray-600">Cargando precios existentes...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {/* Precio por Hora */}
                                        <div className="space-y-2">
                                            <Label htmlFor="hora" className="text-gray-700 flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                Por hora
                                            </Label>
                                            <Input
                                                id="hora"
                                                type="text"
                                                value={prices.hora}
                                                onChange={(e) => handlePriceChange('hora', e.target.value)}
                                                className="text-right"
                                                disabled={saving}
                                                placeholder="100"
                                            />
                                            <p className="text-xs text-gray-500">Se cobra este precio por cada hora completa</p>
                                        </div>

                                        {/* Precio por Día */}
                                        <div className="space-y-2">
                                            <Label htmlFor="dia" className="text-gray-700 flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                Por día
                                            </Label>
                                            <Input
                                                id="dia"
                                                type="text"
                                                value={prices.dia}
                                                onChange={(e) => handlePriceChange('dia', e.target.value)}
                                                className="text-right"
                                                disabled={saving}
                                                placeholder="200"
                                            />
                                            <p className="text-xs text-gray-500">Se cobra este precio por cada día completo</p>
                                        </div>

                                        {/* Precio por Semana */}
                                        <div className="space-y-2">
                                            <Label htmlFor="semana" className="text-gray-700 flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                Por semana
                                            </Label>
                                            <Input
                                                id="semana"
                                                type="text"
                                                value={prices.semana}
                                                onChange={(e) => handlePriceChange('semana', e.target.value)}
                                                className="text-right"
                                                disabled={saving}
                                                placeholder="300"
                                            />
                                            <p className="text-xs text-gray-500">Se cobra este precio por cada semana completa</p>
                                        </div>

                                        {/* Precio por Mes */}
                                        <div className="space-y-2">
                                            <Label htmlFor="mes" className="text-gray-700 flex items-center gap-1">
                                                <DollarSign className="h-4 w-4" />
                                                Por mes
                                            </Label>
                                            <Input
                                                id="mes"
                                                type="text"
                                                value={prices.mes}
                                                onChange={(e) => handlePriceChange('mes', e.target.value)}
                                                className="text-right"
                                                disabled={saving}
                                                placeholder="400"
                                            />
                                            <p className="text-xs text-gray-500">Se cobra este precio por cada mes completo</p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        {modalStep === 'plantilla' ? (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        resetForm();
                                        setIsModalOpen(false);
                                    }}
                                    disabled={saving}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleSavePlantilla}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {currentTemplate.plantilla_id
                                        ? (saving ? 'Guardando...' : 'Guardar cambios')
                                        : (saving ? 'Guardando...' : 'Definir tarifas')}
                                </Button>
                            </>
                        ) : (
                            <>
                                {isStandaloneTarifas ? (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            resetForm();
                                            setIsModalOpen(false);
                                        }}
                                        disabled={saving}
                                    >
                                        Cancelar
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outline"
                                        onClick={() => setModalStep('plantilla')}
                                        disabled={saving}
                                    >
                                        Volver
                                    </Button>
                                )}
                                <Button
                                    onClick={handleSaveTarifas}
                                    disabled={saving || loadingTarifas}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {saving ? 'Guardando...' : 'Guardar tarifas'}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo informativo para duplicados */}
            <DuplicateTemplateDialog
                isOpen={duplicateDialog.isOpen}
                onClose={handleDuplicateDialogClose}
                duplicateType={duplicateDialog.type}
                existingTemplate={duplicateDialog.existingTemplate}
                newTemplateName={duplicateDialog.newTemplateName}
            />
        </TooltipProvider>
    );
}
