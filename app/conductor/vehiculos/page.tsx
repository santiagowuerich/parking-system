"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2, Plus } from "lucide-react";
import { useUserRole } from "@/lib/use-user-role";
import { useVehicle } from "@/lib/contexts/vehicle-context";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Vehicle {
    id: string;
    patente: string;
    tipo: string;
    marca: string;
    modelo: string;
    color: string;
}

export default function ConductorVehiculosPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [formData, setFormData] = useState({
        tipo: "",
        patente: "",
        marca: "",
        modelo: "",
        color: ""
    });

    const { toast } = useToast();
    const { isDriver, isEmployee, isOwner, loading: roleLoading } = useUserRole();
    const { selectedVehicle, setSelectedVehicle } = useVehicle();

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/conductor/vehicles');

            if (!response.ok) {
                throw new Error('Error al cargar vehículos');
            }

            const data = await response.json();
            setVehicles(data.vehicles);
        } catch (error) {
            console.error('Error:', error);
            toast({
                title: "Error",
                description: "No se pudieron cargar los vehículos",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveVehicle = async () => {
        if (!formData.tipo || !formData.patente || !formData.marca || !formData.modelo || !formData.color) {
            toast({
                title: "Error",
                description: "Todos los campos son requeridos",
                variant: "destructive"
            });
            return;
        }

        try {
            setSaving(true);

            const method = editingVehicle ? 'PUT' : 'POST';
            const url = editingVehicle
                ? `/api/conductor/vehicles/${editingVehicle.id}`
                : '/api/conductor/vehicles';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                throw new Error('Error al guardar vehículo');
            }

            const data = await response.json();

            toast({
                title: "Éxito",
                description: data.message || 'Vehículo guardado exitosamente',
            });

            // Actualizar lista de vehículos
            await fetchVehicles();

            // Limpiar formulario y cerrar modal
            handleClearForm();
            setIsDialogOpen(false);

        } catch (error) {
            console.error('Error:', error);
            toast({
                title: "Error",
                description: "No se pudo guardar el vehículo",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const handleEditVehicle = (vehicle: Vehicle) => {
        // Mapear tipo de BD a tipo de formulario
        const tipoMapping: Record<string, string> = {
            'AUT': 'Auto',
            'MOT': 'Moto',
            'CAM': 'Camioneta'
        };

        setEditingVehicle(vehicle);
        setFormData({
            tipo: tipoMapping[vehicle.tipo] || vehicle.tipo,
            patente: vehicle.patente,
            marca: vehicle.marca,
            modelo: vehicle.modelo,
            color: vehicle.color
        });
        setIsDialogOpen(true);
    };

    const handleOpenCreateDialog = () => {
        handleClearForm();
        setIsDialogOpen(true);
    };

    const handleDeleteVehicle = async (vehicleId: string) => {
        if (!confirm('¿Estás seguro de que querés eliminar este vehículo?')) {
            return;
        }

        try {
            const response = await fetch(`/api/conductor/vehicles/${vehicleId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Error al eliminar vehículo');
            }

            const data = await response.json();

            toast({
                title: "Éxito",
                description: data.message || 'Vehículo eliminado exitosamente',
            });

            // Actualizar lista de vehículos
            await fetchVehicles();

        } catch (error) {
            console.error('Error:', error);
            toast({
                title: "Error",
                description: "No se pudo eliminar el vehículo",
                variant: "destructive"
            });
        }
    };

    const handleClearForm = () => {
        setFormData({
            tipo: "",
            patente: "",
            marca: "",
            modelo: "",
            color: ""
        });
        setEditingVehicle(null);
    };

    // Si no es conductor, no mostrar nada (DashboardLayout manejará la redirección)
    if (!isDriver && !roleLoading) {
        return <DashboardLayout><div></div></DashboardLayout>;
    }

    return (
        <DashboardLayout>
            <div className="h-screen bg-white flex flex-col">
                <div className="border-b bg-card px-6 py-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mis Vehículos</h1>
                        <p className="text-gray-600 mt-1">
                            Registrá tus vehículos y gestioná los ya cargados
                        </p>
                    </div>
                </div>

                <div className="flex-1 p-6">
                    <Card className="shadow-lg">
                        <CardHeader className="pb-4">
                            <div>
                                <Button
                                    onClick={handleOpenCreateDialog}
                                    className="bg-blue-600 hover:bg-blue-700"
                                    size="default"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Registrar vehículo
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                    Cargando vehículos...
                                </div>
                            ) : vehicles.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-gray-500 mb-4">No hay vehículos registrados</p>
                                    <Button
                                        onClick={handleOpenCreateDialog}
                                        variant="outline"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Registrar primer vehículo
                                    </Button>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                                    <table className="w-full bg-white border-collapse">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-blue-100 to-blue-200 border-b-2 border-gray-400">
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Tipo</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Patente</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Marca</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Modelo</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Color</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900 border-r-2 border-gray-300">Seleccionar</th>
                                                <th className="py-4 px-4 text-center text-sm font-bold text-gray-900">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {vehicles.map((vehicle) => (
                                                <tr 
                                                    key={vehicle.id} 
                                                    className={`border-b border-gray-300 hover:bg-blue-50 transition-colors ${selectedVehicle?.patente === vehicle.patente ? 'bg-blue-50' : ''}`}
                                                >
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{vehicle.tipo}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center font-medium">{vehicle.patente}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{vehicle.marca}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{vehicle.modelo}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">{vehicle.color}</td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 text-center">
                                                        <Button
                                                            variant={selectedVehicle?.patente === vehicle.patente ? "default" : "outline"}
                                                            size="sm"
                                                            onClick={() => setSelectedVehicle(vehicle)}
                                                        >
                                                            {selectedVehicle?.patente === vehicle.patente ? 'Seleccionado' : 'Seleccionar'}
                                                        </Button>
                                                    </td>
                                                    <td className="py-4 px-4 text-sm text-gray-800 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleEditVehicle(vehicle)}
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteVehicle(vehicle.id)}
                                                                className="text-red-600 hover:text-red-700"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Modal para Crear/Editar Vehículo */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>
                                {editingVehicle ? 'Editar vehículo' : 'Registrar vehículo'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingVehicle
                                    ? 'Modificá los datos de tu vehículo'
                                    : 'Completá los datos de tu vehículo'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="tipo">Tipo de vehículo</Label>
                                <Select
                                    value={formData.tipo}
                                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
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

                            <div className="space-y-2">
                                <Label htmlFor="patente">Patente</Label>
                                <Input
                                    id="patente"
                                    value={formData.patente}
                                    onChange={(e) => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="marca">Marca</Label>
                                <Input
                                    id="marca"
                                    value={formData.marca}
                                    onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="modelo">Modelo</Label>
                                <Input
                                    id="modelo"
                                    value={formData.modelo}
                                    onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="color">Color</Label>
                                <Input
                                    id="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsDialogOpen(false);
                                    handleClearForm();
                                }}
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSaveVehicle}
                                disabled={saving}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    editingVehicle ? 'Actualizar' : 'Guardar'
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </DashboardLayout>
    );
}