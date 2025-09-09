'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Palette, Trash2, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Plantilla {
    plantilla_id: number;
    nombre_plantilla: string;
    catv_segmento: string;
    caracteristicas: { [tipo: string]: string[] };
}

interface ApplyTemplatePanelProps {
    plantillas: Plantilla[];
    plantillaSeleccionada: number | null;
    setPlantillaSeleccionada: (id: number | null) => void;
    onAplicarPlantilla: () => void;
    onLimpiarPlantillas: () => void;
    seleccion: Set<number>;
    previewMode: boolean;
    setPreviewMode: (preview: boolean) => void;
}

export const ApplyTemplatePanel: React.FC<ApplyTemplatePanelProps> = ({
    plantillas,
    plantillaSeleccionada,
    setPlantillaSeleccionada,
    onAplicarPlantilla,
    onLimpiarPlantillas,
    seleccion,
    previewMode,
    setPreviewMode
}) => {
    // Función para obtener el color de la plantilla
    const getPlantillaColor = (catv_segmento: string) => {
        switch (catv_segmento) {
            case 'AUT': return 'bg-blue-100 border-blue-300 text-blue-800';
            case 'MOT': return 'bg-green-100 border-green-300 text-green-800';
            case 'CAM': return 'bg-purple-100 border-purple-300 text-purple-800';
            default: return 'bg-gray-100 border-gray-300 text-gray-800';
        }
    };

    // Función para obtener el nombre del tipo de vehículo
    const getTipoVehiculoNombre = (catv_segmento: string) => {
        switch (catv_segmento) {
            case 'AUT': return 'Automóvil';
            case 'MOT': return 'Motocicleta';
            case 'CAM': return 'Camioneta';
            default: return catv_segmento;
        }
    };

    // Función para manejar la aplicación de plantilla
    const handleAplicarPlantilla = () => {
        if (!plantillaSeleccionada) {
            toast.error('Selecciona una plantilla primero');
            return;
        }

        if (seleccion.size === 0) {
            toast.error('Selecciona al menos una plaza');
            return;
        }

        onAplicarPlantilla();
    };

    // Función para manejar la limpieza de plantillas
    const handleLimpiarPlantillas = () => {
        if (seleccion.size === 0) {
            toast.error('Selecciona al menos una plaza');
            return;
        }

        onLimpiarPlantillas();
    };

    // Obtener información de la plantilla seleccionada
    const plantillaActual = plantillas.find(p => p.plantilla_id === plantillaSeleccionada);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Aplicar Plantillas
                </CardTitle>
                <CardDescription>
                    Asigna o remueve plantillas de las plazas seleccionadas
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Modo preview */}
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-2">
                        {previewMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        <Label htmlFor="preview-mode" className="text-sm">
                            Modo preview
                        </Label>
                    </div>
                    <Switch
                        id="preview-mode"
                        checked={previewMode}
                        onCheckedChange={setPreviewMode}
                    />
                </div>

                {previewMode && (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
                        🔍 En modo preview los cambios se muestran inmediatamente pero no se guardan en la base de datos hasta confirmar
                    </div>
                )}

                {/* Selector de plantilla */}
                <div className="space-y-2">
                    <Label htmlFor="plantilla-select">Seleccionar plantilla</Label>
                    <Select
                        value={plantillaSeleccionada?.toString() || ''}
                        onValueChange={(value) => setPlantillaSeleccionada(value ? parseInt(value) : null)}
                    >
                        <SelectTrigger id="plantilla-select">
                            <SelectValue placeholder="Elige una plantilla..." />
                        </SelectTrigger>
                        <SelectContent>
                            {plantillas
                                .filter(plantilla => plantilla && plantilla.plantilla_id && plantilla.nombre_plantilla)
                                .map((plantilla) => (
                                    <SelectItem
                                        key={plantilla.plantilla_id}
                                        value={plantilla.plantilla_id.toString()}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                variant="outline"
                                                className={`text-xs ${getPlantillaColor(plantilla.catv_segmento || 'AUT')}`}
                                            >
                                                {plantilla.catv_segmento || 'AUT'}
                                            </Badge>
                                            {plantilla.nombre_plantilla || 'Sin nombre'}
                                        </div>
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Información de la plantilla seleccionada */}
                {plantillaActual && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge className={getPlantillaColor(plantillaActual.catv_segmento)}>
                                {getTipoVehiculoNombre(plantillaActual.catv_segmento)}
                            </Badge>
                            <span className="font-medium text-sm">{plantillaActual.nombre_plantilla}</span>
                        </div>

                        {Object.keys(plantillaActual.caracteristicas).length > 0 && (
                            <div className="text-xs text-blue-700">
                                <div className="font-medium mb-1">Características:</div>
                                {Object.entries(plantillaActual.caracteristicas).map(([tipo, valores]) => (
                                    <div key={tipo} className="mb-1">
                                        <span className="font-medium">{tipo}:</span> {valores.join(', ')}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <Separator />

                {/* Botones de acción */}
                <div className="space-y-3">
                    {/* Aplicar plantilla */}
                    <Button
                        onClick={handleAplicarPlantilla}
                        disabled={!plantillaSeleccionada || seleccion.size === 0}
                        className="w-full flex items-center gap-2"
                    >
                        <CheckCircle className="h-4 w-4" />
                        Aplicar plantilla
                        {seleccion.size > 0 && ` (${seleccion.size} plazas)`}
                    </Button>

                    {/* Limpiar plantillas */}
                    <Button
                        variant="outline"
                        onClick={handleLimpiarPlantillas}
                        disabled={seleccion.size === 0}
                        className="w-full flex items-center gap-2"
                    >
                        <Trash2 className="h-4 w-4" />
                        Limpiar plantillas
                        {seleccion.size > 0 && ` (${seleccion.size} plazas)`}
                    </Button>
                </div>

                {/* Información de estado */}
                <div className="space-y-2 text-sm">
                    {seleccion.size === 0 && (
                        <div className="text-muted-foreground flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Selecciona plazas para aplicar cambios
                        </div>
                    )}

                    {seleccion.size > 0 && !plantillaSeleccionada && (
                        <div className="text-muted-foreground">
                            💡 Selecciona una plantilla para aplicar a las {seleccion.size} plazas seleccionadas
                        </div>
                    )}

                    {seleccion.size > 0 && plantillaSeleccionada && (
                        <div className="text-green-700 bg-green-50 p-2 rounded border border-green-200">
                            ✅ Listo para aplicar "{plantillaActual?.nombre_plantilla}" a {seleccion.size} plazas
                        </div>
                    )}
                </div>

                {/* Información adicional */}
                <div className="text-xs text-muted-foreground space-y-1">
                    <div>• Las plazas ocupadas no se verán afectadas</div>
                    <div>• Los cambios se pueden deshacer antes de confirmar</div>
                    <div>• En modo preview los cambios son temporales</div>
                </div>
            </CardContent>
        </Card>
    );
};
