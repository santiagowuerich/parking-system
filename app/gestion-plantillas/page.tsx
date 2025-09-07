"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Caracteristica, Plantilla, PlantillaForm } from "@/lib/types";
import { DuplicateTemplateDialog } from "@/components/duplicate-template-dialog";

export default function GestionPlantillasPage() {
    const { estId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Estados para los datos
    const [allCaracteristicas, setAllCaracteristicas] = useState<Caracteristica[]>([]);
    const [plantillas, setPlantillas] = useState<Plantilla[]>([]);

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

    // Carga inicial de datos
    useEffect(() => {
        loadInitialData();
    }, [estId]);

    const loadInitialData = async () => {
        if (!estId) return;

        try {
            setLoading(true);

            // Cargar características
            const caracteristicasRes = await fetch('/api/caracteristicas');
            if (!caracteristicasRes.ok) {
                throw new Error('Error al cargar características');
            }
            const caracteristicasData = await caracteristicasRes.json();
            setAllCaracteristicas(caracteristicasData.caracteristicas || []);

            // Cargar plantillas
            await loadPlantillas();

        } catch (error: any) {
            console.error('Error cargando datos iniciales:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: error.message || "Error al cargar los datos"
            });
        } finally {
            setLoading(false);
        }
    };

    const loadPlantillas = async () => {
        if (!estId) return;

        const plantillasRes = await fetch(`/api/plantillas?est_id=${estId}`);
        if (!plantillasRes.ok) {
            throw new Error('Error al cargar plantillas');
        }
        const plantillasData = await plantillasRes.json();
        setPlantillas(plantillasData.plantillas || []);
    };

    // Funciones para manejar el formulario
    const resetForm = () => {
        setCurrentTemplate({
            nombre_plantilla: '',
            catv_segmento: 'AUT',
            caracteristica_ids: []
        });
    };

    const handleEditTemplate = (template: Plantilla) => {
        // Convertir las características agrupadas a una lista de IDs
        const caracteristicaIds: number[] = [];
        Object.values(template.caracteristicas).forEach(caracteristicas => {
            caracteristicas.forEach(valor => {
                // Buscar el ID correspondiente en allCaracteristicas
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

            // Recargar plantillas
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

    const handleSaveTemplate = async () => {
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

                // Si es un error de duplicado, mostrar diálogo informativo
                if (response.status === 409 && errorData.error_code) {
                    setDuplicateDialog({
                        isOpen: true,
                        type: errorData.error_code === 'DUPLICATE_NAME' ? 'name' : 'config',
                        existingTemplate: errorData.existing_template,
                        newTemplateName: currentTemplate.nombre_plantilla
                    });
                    return; // No lanzar error, solo mostrar diálogo
                }

                throw new Error(errorData.error || 'Error al guardar plantilla');
            }

            const data = await response.json();

            toast({
                title: "Éxito",
                description: currentTemplate.plantilla_id
                    ? "Plantilla actualizada correctamente"
                    : "Plantilla creada correctamente"
            });

            // Recargar plantillas y resetear formulario
            await loadPlantillas();
            resetForm();

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

    const handleCaracteristicaToggle = (caracteristicaId: number) => {
        // Buscar la característica que se está seleccionando/deseleccionando
        const caracteristica = allCaracteristicas.find(c => c.caracteristica_id === caracteristicaId);
        if (!caracteristica) return;

        const tipo = caracteristica.caracteristica_tipos.nombre_tipo;
        const valor = caracteristica.valor;

        setCurrentTemplate(prev => {
            const isCurrentlySelected = prev.caracteristica_ids.includes(caracteristicaId);
            let newCaracteristicaIds = [...prev.caracteristica_ids];

            if (isCurrentlySelected) {
                // Si se está deseleccionando, simplemente quitar el ID
                newCaracteristicaIds = newCaracteristicaIds.filter(id => id !== caracteristicaId);
            } else {
                // Si se está seleccionando, aplicar lógica de validación
                if (tipo === 'Techo') {
                    // Para características de techo, solo puede haber una seleccionada
                    // Primero, quitar cualquier otra característica del mismo tipo
                    const caracteristicasDelTipo = allCaracteristicas
                        .filter(c => c.caracteristica_tipos.nombre_tipo === 'Techo')
                        .map(c => c.caracteristica_id);

                    newCaracteristicaIds = newCaracteristicaIds.filter(id => !caracteristicasDelTipo.includes(id));

                    // Agregar la nueva característica
                    newCaracteristicaIds.push(caracteristicaId);
                } else {
                    // Para otros tipos, agregar normalmente
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
        <>
            <div className={`container mx-auto p-6 max-w-7xl min-h-screen ${isInDashboard ? '' : 'bg-white'}`}>
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Plantillas de Plazas</h1>
                    <p className="text-gray-600">Define y gestiona diferentes tipos de plazas de estacionamiento y sus características</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Columna Izquierda: Listado de Plantillas */}
                    <div className="lg:col-span-2">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Listado de plantillas</h2>

                        <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                            <table className="w-full bg-white border-collapse">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-200 to-gray-300 border-b-2 border-gray-400">
                                        <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Nombre</th>
                                        <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Vehículo</th>
                                        <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Techo</th>
                                        <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Seguridad</th>
                                        <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Conectividad</th>
                                        <th className="py-4 px-4 text-right text-sm font-bold text-gray-900 border-r-2 border-gray-300 last:border-r-0 shadow-sm">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {plantillas.length === 0 ? (
                                        <tr className="bg-white">
                                            <td colSpan={6} className="py-12 px-4 text-center text-gray-500 border-t border-gray-300">
                                                No hay plantillas creadas aún. Crea tu primera plantilla usando el formulario de la derecha.
                                            </td>
                                        </tr>
                                    ) : (
                                        plantillas.map((plantilla, index) => (
                                            <tr key={plantilla.plantilla_id} className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-100'} transition-colors duration-150`}>
                                                <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium last:border-r-0">
                                                    {plantilla.nombre_plantilla}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 last:border-r-0">
                                                    {plantilla.catv_segmento === 'AUT' ? 'Auto' :
                                                        plantilla.catv_segmento === 'MOT' ? 'Moto' : 'Camioneta'}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 last:border-r-0">
                                                    {plantilla.caracteristicas['Techo']?.map((valor, idx) => (
                                                        <span key={idx} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1 mb-1 font-medium shadow-sm">
                                                            {valor}
                                                        </span>
                                                    )) || <span className="text-gray-400 italic">Sin especificar</span>}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 last:border-r-0">
                                                    {plantilla.caracteristicas['Seguridad']?.map((valor, idx) => (
                                                        <span key={idx} className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs mr-1 mb-1 font-medium shadow-sm">
                                                            {valor}
                                                        </span>
                                                    )) || <span className="text-gray-400 italic">Sin especificar</span>}
                                                </td>
                                                <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300 last:border-r-0">
                                                    {plantilla.caracteristicas['Conectividad']?.map((valor, idx) => (
                                                        <span key={idx} className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs mr-1 mb-1 font-medium shadow-sm">
                                                            {valor}
                                                        </span>
                                                    )) || <span className="text-gray-400 italic">Sin especificar</span>}
                                                </td>
                                                <td className="py-4 px-4 text-right last:border-r-0">
                                                    <div className="flex items-center justify-end gap-1">
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
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Columna Derecha: Crear/Editar Plantilla */}
                    <Card className="bg-white border border-gray-200 shadow-sm lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-gray-900">
                                Crear / Editar plantilla
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Campo Nombre */}
                            <div>
                                <label className="text-sm font-medium mb-2 block text-gray-700">Nombre</label>
                                <Input
                                    value={currentTemplate.nombre_plantilla}
                                    onChange={(e) => setCurrentTemplate(prev => ({ ...prev, nombre_plantilla: e.target.value }))}
                                    placeholder="Ej: Auto estándar"
                                    className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
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
                                    <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
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

                            {/* Botones de Acción */}
                            <div className="flex gap-3 pt-4">
                                <Button
                                    onClick={handleSaveTemplate}
                                    disabled={saving}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0"
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Guardar plantilla
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={resetForm}
                                    disabled={saving}
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Diálogo informativo para duplicados */}
            <DuplicateTemplateDialog
                isOpen={duplicateDialog.isOpen}
                onClose={handleDuplicateDialogClose}
                duplicateType={duplicateDialog.type}
                existingTemplate={duplicateDialog.existingTemplate}
                newTemplateName={duplicateDialog.newTemplateName}
            />n
        </>
    );
}
