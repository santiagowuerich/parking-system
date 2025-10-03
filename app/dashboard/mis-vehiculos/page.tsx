"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Car, Edit, Trash2 } from "lucide-react";

export default function MisVehiculosPage() {
    const [vehicles, setVehicles] = useState([
        {
            id: 1,
            patente: "ABC123",
            tipo: "Auto",
            marca: "Toyota",
            modelo: "Corolla",
            año: 2020,
            color: "Blanco"
        },
        {
            id: 2,
            patente: "XYZ789",
            tipo: "Moto",
            marca: "Honda",
            modelo: "CB190",
            año: 2019,
            color: "Negro"
        }
    ]);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<any>(null);
    const [formData, setFormData] = useState({
        patente: "",
        tipo: "",
        marca: "",
        modelo: "",
        año: "",
        color: ""
    });

    const handleAddVehicle = () => {
        setEditingVehicle(null);
        setFormData({
            patente: "",
            tipo: "",
            marca: "",
            modelo: "",
            año: "",
            color: ""
        });
        setIsDialogOpen(true);
    };

    const handleEditVehicle = (vehicle: any) => {
        setEditingVehicle(vehicle);
        setFormData(vehicle);
        setIsDialogOpen(true);
    };

    const handleSaveVehicle = () => {
        if (editingVehicle) {
            // Editar vehículo existente
            setVehicles(vehicles.map(v => v.id === editingVehicle.id ? { ...formData, id: editingVehicle.id } : v));
        } else {
            // Agregar nuevo vehículo
            const newVehicle = {
                ...formData,
                id: vehicles.length + 1
            };
            setVehicles([...vehicles, newVehicle]);
        }
        setIsDialogOpen(false);
    };

    const handleDeleteVehicle = (id: number) => {
        setVehicles(vehicles.filter(v => v.id !== id));
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Mis Vehículos</h1>
                        <p className="text-gray-600">
                            Administrá y mantenés actualizada la información de tus vehículos
                        </p>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAddVehicle}>
                                <Plus className="w-4 h-4 mr-2" />
                                Agregar Vehículo
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {editingVehicle ? 'Editar Vehículo' : 'Agregar Nuevo Vehículo'}
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="patente">Patente</Label>
                                    <Input
                                        id="patente"
                                        value={formData.patente}
                                        onChange={(e) => setFormData({ ...formData, patente: e.target.value })}
                                        placeholder="ABC123"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="tipo">Tipo de Vehículo</Label>
                                    <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="auto">Auto</SelectItem>
                                            <SelectItem value="moto">Moto</SelectItem>
                                            <SelectItem value="camioneta">Camioneta</SelectItem>
                                            <SelectItem value="utilitario">Utilitario</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="marca">Marca</Label>
                                        <Input
                                            id="marca"
                                            value={formData.marca}
                                            onChange={(e) => setFormData({ ...formData, marca: e.target.value })}
                                            placeholder="Toyota"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="modelo">Modelo</Label>
                                        <Input
                                            id="modelo"
                                            value={formData.modelo}
                                            onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                                            placeholder="Corolla"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="año">Año</Label>
                                        <Input
                                            id="año"
                                            value={formData.año}
                                            onChange={(e) => setFormData({ ...formData, año: e.target.value })}
                                            placeholder="2020"
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="color">Color</Label>
                                        <Input
                                            id="color"
                                            value={formData.color}
                                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                            placeholder="Blanco"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button onClick={handleSaveVehicle} className="flex-1">
                                        {editingVehicle ? 'Actualizar' : 'Agregar'}
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                                        Cancelar
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Lista de Vehículos */}
                {vehicles.length === 0 ? (
                    <Card className="text-center py-12">
                        <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No tienes vehículos registrados</h3>
                        <p className="text-gray-600 mb-4">
                            Agregá tu primer vehículo para empezar a reservar estacionamientos
                        </p>
                        <Button onClick={handleAddVehicle}>
                            <Plus className="w-4 h-4 mr-2" />
                            Agregar mi primer vehículo
                        </Button>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map((vehicle) => (
                            <Card key={vehicle.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">{vehicle.patente}</CardTitle>
                                            <Badge variant="secondary">{vehicle.tipo}</Badge>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => handleEditVehicle(vehicle)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDeleteVehicle(vehicle.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Marca:</span>
                                            <span>{vehicle.marca}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Modelo:</span>
                                            <span>{vehicle.modelo}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Año:</span>
                                            <span>{vehicle.año}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Color:</span>
                                            <span>{vehicle.color}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
