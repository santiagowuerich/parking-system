"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Building2, MapPin, Clock, Users, Settings, Plus, Trash2 } from "lucide-react";
import ParkingConfig from "./parking-config";

interface Estacionamiento {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_capacidad: number;
    est_cantidad_espacios_disponibles: number;
    est_horario_funcionamiento: number;
    est_tolerancia_min: number;
}

interface Usuario {
    usu_id: number;
    nombre_completo: string;
    email: string;
}

interface UserParkingsProps {
    onSelectParking?: (estId: number) => void;
    currentEstId?: number;
}

export default function UserParkings({ onSelectParking, currentEstId }: UserParkingsProps) {
    const [estacionamientos, setEstacionamientos] = useState<Estacionamiento[]>([]);
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("list");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newParkingName, setNewParkingName] = useState("");

    const fetchUserParkings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/auth/list-parkings');

            if (response.ok) {
                const data = await response.json();
                setEstacionamientos(data.estacionamientos || []);
                setUsuario(data.usuario || null);
                setError(null);
            } else {
                const errorData = await response.json();
                setError(errorData.error || "Error cargando estacionamientos");
            }
        } catch (err) {
            console.error("Error fetching user parkings:", err);
            setError("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    const createNewParking = async () => {
        if (!newParkingName.trim()) {
            setError("El nombre del estacionamiento es requerido");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            // Primera estrategia: endpoint principal
            console.log('🚀 Intentando crear estacionamiento con endpoint principal...');
            let response = await fetch('/api/auth/create-new-parking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newParkingName.trim(),
                    email: usuario?.email
                }),
            });

            // Si falla, intentar con el endpoint de fallback
            if (!response.ok) {
                console.log('⚠️ Endpoint principal falló, intentando con fallback...');
                response = await fetch('/api/auth/create-new-parking-fallback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: newParkingName.trim(),
                        email: usuario?.email
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Nuevo estacionamiento creado:', data);

                // Recargar la lista de estacionamientos
                await fetchUserParkings();

                // Limpiar el formulario
                setNewParkingName("");
                setShowCreateForm(false);

                // Seleccionar automáticamente el nuevo estacionamiento si se creó
                if (data.estacionamiento_id && onSelectParking) {
                    onSelectParking(data.estacionamiento_id);
                }
            } else {
                const errorData = await response.json();
                console.error('❌ Error creando estacionamiento:', errorData);

                // Mostrar mensaje de error más específico
                if (errorData.details) {
                    setError(`${errorData.error}: ${errorData.details}`);
                } else {
                    setError(errorData.error || "Error creando estacionamiento");
                }
            }
        } catch (err) {
            console.error("Error creando estacionamiento:", err);
            setError("Error de conexión - intenta nuevamente");
        } finally {
            setCreating(false);
        }
    };

    useEffect(() => {
        fetchUserParkings();
    }, []);

    if (loading) {
        return (
            <Card className="w-full">
                <CardContent className="p-6">
                    <p className="text-center text-muted-foreground">Cargando estacionamientos...</p>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="w-full border-red-200 bg-red-50">
                <CardContent className="p-6">
                    <p className="text-center text-red-600">{error}</p>
                    <div className="mt-4 text-center">
                        <Button onClick={fetchUserParkings} variant="outline">
                            Reintentar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {usuario && (
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardHeader>
                        <CardTitle className="text-zinc-100 flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Información del Usuario
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-zinc-300">
                            <p><span className="text-zinc-400">Nombre:</span> {usuario.nombre_completo}</p>
                            <p><span className="text-zinc-400">Email:</span> {usuario.email}</p>
                            <p><span className="text-zinc-400">ID Usuario:</span> {usuario.usu_id}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                <Button
                    variant={activeTab === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("list")}
                    className="flex-1"
                >
                    <Building2 className="h-4 w-4 mr-2" />
                    Mis Estacionamientos
                </Button>
                <Button
                    variant={activeTab === "config" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setActiveTab("config")}
                    className="flex-1"
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Configuración
                </Button>
            </div>

            {/* Tab Content */}
            {activeTab === "list" && (
                <Card className="bg-zinc-900/50 border-zinc-700">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Lista de Estacionamientos ({estacionamientos.length})
                            </CardTitle>
                            <Button
                                onClick={() => setShowCreateForm(!showCreateForm)}
                                variant="outline"
                                size="sm"
                                className="bg-zinc-800 border-zinc-600 hover:bg-zinc-700"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nuevo Estacionamiento
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Formulario de creación de nuevo estacionamiento */}
                        {showCreateForm && (
                            <Card className="bg-zinc-800 border-zinc-600 mb-6">
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Plus className="h-5 w-5 text-zinc-400" />
                                            <h3 className="text-lg font-medium text-zinc-200">
                                                Crear Nuevo Estacionamiento
                                            </h3>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <Label htmlFor="parking-name" className="text-zinc-300">
                                                    Nombre del Estacionamiento *
                                                </Label>
                                                <Input
                                                    id="parking-name"
                                                    type="text"
                                                    placeholder="Ej: Estacionamiento Centro"
                                                    value={newParkingName}
                                                    onChange={(e) => setNewParkingName(e.target.value)}
                                                    className="bg-zinc-700 border-zinc-600 text-zinc-100 mt-1"
                                                    disabled={creating}
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={createNewParking}
                                                    disabled={creating || !newParkingName.trim()}
                                                    className="flex-1"
                                                >
                                                    {creating ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                            Creando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Plus className="h-4 w-4 mr-2" />
                                                            Crear Estacionamiento
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        setShowCreateForm(false);
                                                        setNewParkingName("");
                                                        setError(null);
                                                    }}
                                                    variant="outline"
                                                    disabled={creating}
                                                >
                                                    Cancelar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {estacionamientos.length === 0 ? (
                            <div className="text-center py-8">
                                <Building2 className="h-16 w-16 mx-auto text-zinc-600 mb-4" />
                                <h3 className="text-lg font-medium text-zinc-300 mb-2">
                                    No tienes estacionamientos configurados
                                </h3>
                                <p className="text-zinc-400 mb-4">
                                    Crea tu primer estacionamiento usando el botón "Nuevo Estacionamiento" arriba.
                                    Podrás configurar plazas, tarifas y zonas desde el Panel de Administrador.
                                </p>
                                <Button onClick={fetchUserParkings} variant="outline">
                                    Actualizar
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {estacionamientos.map((estacionamiento) => (
                                    <Card
                                        key={estacionamiento.est_id}
                                        className={`bg-zinc-800 border-zinc-700 cursor-pointer transition-colors ${currentEstId === estacionamiento.est_id
                                            ? 'ring-2 ring-blue-500 bg-zinc-700'
                                            : 'hover:bg-zinc-750'
                                            }`}
                                        onClick={() => onSelectParking?.(estacionamiento.est_id)}
                                    >
                                        <CardHeader className="pb-3">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-zinc-100 text-lg">
                                                    {estacionamiento.est_nombre}
                                                </CardTitle>
                                                <Badge variant={currentEstId === estacionamiento.est_id ? "default" : "secondary"}>
                                                    ID: {estacionamiento.est_id}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="pt-0">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                <div className="flex items-center gap-2 text-zinc-300">
                                                    <MapPin className="h-4 w-4 text-zinc-500" />
                                                    <span>{estacionamiento.est_prov}, {estacionamiento.est_locali}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-300">
                                                    <Building2 className="h-4 w-4 text-zinc-500" />
                                                    <span>{estacionamiento.est_capacidad} plazas totales</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-300">
                                                    <Users className="h-4 w-4 text-zinc-500" />
                                                    <span>{estacionamiento.est_cantidad_espacios_disponibles} disponibles</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-300">
                                                    <Clock className="h-4 w-4 text-zinc-500" />
                                                    <span>{estacionamiento.est_horario_funcionamiento}h funcionamiento</span>
                                                </div>
                                            </div>
                                            <div className="mt-3 text-zinc-400 text-xs">
                                                <p>{estacionamiento.est_direc}</p>
                                                <p>Tolerancia: {estacionamiento.est_tolerancia_min} minutos</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Tab Configuración */}
            {activeTab === "config" && (
                <ParkingConfig />
            )}
        </div>
    );
}