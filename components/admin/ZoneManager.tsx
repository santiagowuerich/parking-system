// components/admin/ZoneManager.tsx - Gestión simplificada de zonas
'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useZoneManagement } from '@/lib/hooks/use-zone-management';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';

export function ZoneManager() {
    const { estId } = useAuth();
    const { zonas, loading, fetchZonas, createZoneWithPlazas, renameZone, deleteZone, assignPlazasToZone } = useZoneManagement(estId);

    // Estados locales del componente
    const [editingZone, setEditingZone] = useState<any | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [selectedZoneForAssign, setSelectedZoneForAssign] = useState<string>('');
    const [selectedPlazas, setSelectedPlazas] = useState<number[]>([]);

    // Estados para creación de zona con plazas
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createZoneData, setCreateZoneData] = useState({
        nombre: '',
        capacidad: { Auto: 0, Moto: 0, Camioneta: 0 }
    });

    // Si no hay estId, mostrar mensaje de configuración
    if (estId === null) {
        return (
            <div className="text-center py-8">
                <p className="text-zinc-400">Configurando estacionamiento...</p>
            </div>
        );
    }

    const handleRenameZone = async () => {
        if (!editingZone || !editingZone.nombre.trim()) return;

        try {
            const zonaAntigua = zonas.find(z => z.id === editingZone.id)?.nombre;
            if (!zonaAntigua) return;

            await renameZone(zonaAntigua, editingZone.nombre);

            setEditingZone(null);
            fetchZonas();
            toast.success('Zona renombrada exitosamente');
        } catch (error: any) {
            toast.error('Error al renombrar', { description: error.message });
        }
    };

    const handleDeleteZone = async (zonaNombre: string) => {
        if (!confirm(`¿Seguro que quieres eliminar la zona "${zonaNombre}"? Las plazas serán reasignadas a la zona "GENERAL".`)) return;

        try {
            await deleteZone(zonaNombre);
            fetchZonas();
            toast.success('Zona eliminada', { description: 'Las plazas fueron reasignadas a GENERAL' });
        } catch (error: any) {
            toast.error('Error al eliminar', { description: error.message });
        }
    };

    const handleAssignPlazas = async () => {
        try {
            await assignPlazasToZone({
                zona_nombre: selectedZoneForAssign,
                plaza_numeros: selectedPlazas,
                est_id: estId!
            });

            setIsAssignModalOpen(false);
            setSelectedPlazas([]);
            setSelectedZoneForAssign('');
            fetchZonas();
            toast.success('Plazas asignadas exitosamente');
        } catch (error: any) {
            toast.error('Error al asignar plazas', { description: error.message });
        }
    };

    const handleCreateZoneWithPlazas = async () => {
        try {
            const result = await createZoneWithPlazas(createZoneData);

            setIsCreateModalOpen(false);
            setCreateZoneData({ nombre: '', capacidad: { Auto: 0, Moto: 0, Camioneta: 0 } });
            fetchZonas();

            const totalPlazas = Object.values(createZoneData.capacidad).reduce((a, b) => a + b, 0);
            toast.success('¡Zona creada exitosamente!', {
                description: result.message || `${totalPlazas} plazas generadas automáticamente`
            });
        } catch (error: any) {
            toast.error('Error al crear zona', { description: error.message });
        }
    };

    return (
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
            <CardHeader>
                <CardTitle className="dark:text-zinc-100">Gestión de Zonas (Obligatorio)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="h-20 flex flex-col items-center justify-center"
                        >
                            <Plus className="w-6 h-6 mb-2" />
                            <span className="font-semibold">Crear Zona Nueva</span>
                            <span className="text-xs opacity-75">Con plazas automáticas</span>
                        </Button>

                        <Button
                            onClick={() => setIsAssignModalOpen(true)}
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center"
                        >
                            <Edit className="w-6 h-6 mb-2" />
                            <span className="font-semibold">Asignar Plazas</span>
                            <span className="text-xs opacity-75">A zonas existentes</span>
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : (
                    <div>
                        <h4 className="font-semibold mb-2">Zonas Existentes:</h4>
                        {zonas.length === 0 ? (
                            <p className="text-zinc-500 text-sm">Cargando zonas...</p>
                        ) : (
                            <ul className="space-y-2">
                                {(zonas || []).map((zona) => zona ? (
                                    <li key={zona.id} className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                                        {editingZone?.id === zona.id ? (
                                            <Input
                                                value={editingZone?.nombre || ''}
                                                onChange={(e) => setEditingZone({
                                                    ...editingZone,
                                                    id: zona.id,
                                                    est_id: zona.est_id,
                                                    nombre: e.target.value
                                                })}
                                                onBlur={handleRenameZone}
                                                onKeyDown={(e) => e.key === 'Enter' && handleRenameZone()}
                                                autoFocus
                                                className="dark:bg-zinc-700"
                                            />
                                        ) : (
                                            <span className="dark:text-zinc-200">{zona.nombre || 'Sin nombre'}</span>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setEditingZone(zona)}
                                                title="Renombrar zona"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteZone(zona.nombre || '')}
                                                title="Eliminar zona"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </li>
                                ) : null)}
                            </ul>
                        )}
                    </div>
                )}
            </CardContent>

            {/* Modal de Asignación Mejorado */}
            <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
                <DialogContent className="dark:bg-zinc-900 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="dark:text-zinc-100">Asignar Plazas a Zona</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="zona-select">Zona:</Label>
                            <Input
                                id="zona-select"
                                placeholder="Nombre de la zona (ej: ZONA A)"
                                value={selectedZoneForAssign}
                                onChange={(e) => setSelectedZoneForAssign(e.target.value)}
                                className="dark:bg-zinc-800 dark:border-zinc-700"
                            />
                        </div>
                        <div>
                            <Label>Números de plaza:</Label>
                            <Input
                                placeholder="Individual: 1,2,3,4,5 | Por rango: 1-10,15-20"
                                onChange={(e) => {
                                    const input = e.target.value.trim();
                                    const numeros: number[] = [];

                                    // Separar por comas
                                    const parts = input.split(',');

                                    for (const part of parts) {
                                        const trimmed = part.trim();

                                        if (trimmed.includes('-')) {
                                            // Es un rango (ej: 1-10)
                                            const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                                            if (!isNaN(start) && !isNaN(end) && start <= end) {
                                                for (let i = start; i <= end; i++) {
                                                    numeros.push(i);
                                                }
                                            }
                                        } else {
                                            // Es un número individual
                                            const num = parseInt(trimmed);
                                            if (!isNaN(num)) {
                                                numeros.push(num);
                                            }
                                        }
                                    }

                                    setSelectedPlazas([...new Set(numeros)].sort((a, b) => a - b));
                                }}
                                className="dark:bg-zinc-800 dark:border-zinc-700"
                            />
                            <p className="text-xs text-zinc-500 mt-1">
                                Ejemplos: "1,2,3" o "1-10" o "1-5,8,10-15"
                            </p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-800 p-3 rounded">
                            <p className="text-sm font-medium">Plazas seleccionadas ({selectedPlazas.length}):</p>
                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                {selectedPlazas.length > 0 ? selectedPlazas.join(', ') : 'Ninguna'}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAssignPlazas}>
                            Asignar {selectedPlazas.length} Plaza{selectedPlazas.length !== 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Creación de Zona con Plazas */}
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="dark:bg-zinc-900 dark:border-zinc-800 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="dark:text-zinc-100">Crear Zona Nueva</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="create-zone-name">Nombre de la Zona:</Label>
                            <Input
                                id="create-zone-name"
                                placeholder="ej: ZONA A, Planta Baja, Sector Norte"
                                value={createZoneData.nombre}
                                onChange={(e) => setCreateZoneData({
                                    ...createZoneData,
                                    nombre: e.target.value
                                })}
                                className="dark:bg-zinc-800 dark:border-zinc-700"
                            />
                        </div>

                        <div className="space-y-3">
                            <Label className="dark:text-zinc-400">Cantidad de Plazas a Crear:</Label>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="create-auto" className="text-xs dark:text-zinc-400">🚗 Autos</Label>
                                    <Input
                                        id="create-auto"
                                        type="number"
                                        min="0"
                                        value={createZoneData.capacidad.Auto}
                                        onChange={(e) => setCreateZoneData({
                                            ...createZoneData,
                                            capacidad: {
                                                ...createZoneData.capacidad,
                                                Auto: parseInt(e.target.value) || 0
                                            }
                                        })}
                                        className="dark:bg-zinc-800 dark:border-zinc-700"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="create-moto" className="text-xs dark:text-zinc-400">🏍️ Motos</Label>
                                    <Input
                                        id="create-moto"
                                        type="number"
                                        min="0"
                                        value={createZoneData.capacidad.Moto}
                                        onChange={(e) => setCreateZoneData({
                                            ...createZoneData,
                                            capacidad: {
                                                ...createZoneData.capacidad,
                                                Moto: parseInt(e.target.value) || 0
                                            }
                                        })}
                                        className="dark:bg-zinc-800 dark:border-zinc-700"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <Label htmlFor="create-camioneta" className="text-xs dark:text-zinc-400">🚛 Camionetas</Label>
                                    <Input
                                        id="create-camioneta"
                                        type="number"
                                        min="0"
                                        value={createZoneData.capacidad.Camioneta}
                                        onChange={(e) => setCreateZoneData({
                                            ...createZoneData,
                                            capacidad: {
                                                ...createZoneData.capacidad,
                                                Camioneta: parseInt(e.target.value) || 0
                                            }
                                        })}
                                        className="dark:bg-zinc-800 dark:border-zinc-700"
                                    />
                                </div>
                            </div>

                            <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded">
                                <strong>Total:</strong> {Object.values(createZoneData.capacidad).reduce((a, b) => a + b, 0)} plazas se crearán automáticamente
                                <br />
                                <strong>Numeración:</strong> Se asignarán números consecutivos empezando desde la última plaza existente
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleCreateZoneWithPlazas}
                            disabled={!createZoneData.nombre.trim() || Object.values(createZoneData.capacidad).reduce((a, b) => a + b, 0) === 0}
                        >
                            Crear Zona + Plazas
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}