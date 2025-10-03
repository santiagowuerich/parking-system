"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Edit, Trash2 } from "lucide-react";

interface Vehicle {
    id: string;
    patente: string;
    tipo: string;
    marca: string;
    modelo: string;
    color: string;
}

export default function MisVehiculosPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [formData, setFormData] = useState({
        tipo: "",
        patente: "",
        marca: "",
        modelo: "",
        color: ""
    });

    const { toast } = useToast();

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

            // Limpiar formulario
            handleClearForm();

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
        setEditingVehicle(vehicle);
        setFormData({
            tipo: vehicle.tipo,
            patente: vehicle.patente,
            marca: vehicle.marca,
            modelo: vehicle.modelo,
            color: vehicle.color
        });
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

    return (
        <DashboardLayout>
            <div className="h-screen bg-gray-50 flex flex-col">
                <div className="bg-white border-b px-6 py-4">
                    <h1 className="text-2xl font-bold text-gray-900">Mis Vehículos</h1>
                    <p className="text-gray-600 mt-1">
                        Registrá tus vehículos y gestioná los ya cargados
                    </p>
                </div>

                <div className="flex-1 p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                        {/* Panel Izquierdo - Formulario */}
                        <div className="flex flex-col">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Registrar vehículo</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="tipo">Tipo de vehículo</Label>
                                        <Select
                                            value={formData.tipo}
                                            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Auto / Camioneta / Moto" />
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
                                            placeholder="AA123BB"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="marca">Marca</Label>
                                        <Input
                                            id="marca"
                                            value={formData.marca}
                                            onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                                            placeholder="Toyota"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="modelo">Modelo</Label>
                                        <Input
                                            id="modelo"
                                            value={formData.modelo}
                                            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                                            placeholder="Corolla 2021"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="color">Color</Label>
                                        <Input
                                            id="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            placeholder="Blanco"
                                        />
                                    </div>

                                    <div className="flex gap-3 pt-4">
                                        <Button
                                            onClick={handleSaveVehicle}
                                            disabled={saving}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Guardando...
                                                </>
                                            ) : (
                                                'Guardar vehículo'
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={handleClearForm}
                                            className="flex-1"
                                        >
                                            Limpiar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Panel Derecho - Tabla */}
                        <div className="flex flex-col">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Vehículos registrados</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-6 h-6 animate-spin mr-2" />
                                            Cargando vehículos...
                                        </div>
                                    ) : vehicles.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No hay vehículos registrados
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Tipo</TableHead>
                                                    <TableHead>Patente</TableHead>
                                                    <TableHead>Marca</TableHead>
                                                    <TableHead>Modelo</TableHead>
                                                    <TableHead>Color</TableHead>
                                                    <TableHead className="text-center">Acción</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {vehicles.map((vehicle) => (
                                                    <TableRow key={vehicle.id}>
                                                        <TableCell>{vehicle.tipo}</TableCell>
                                                        <TableCell className="font-medium">{vehicle.patente}</TableCell>
                                                        <TableCell>{vehicle.marca}</TableCell>
                                                        <TableCell>{vehicle.modelo}</TableCell>
                                                        <TableCell>{vehicle.color}</TableCell>
                                                        <TableCell className="text-center">
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
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}