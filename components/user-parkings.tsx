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
import AddressAutocomplete from "./address-autocomplete";

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
    // Nuevos campos calculados dinámicamente
    plazas_totales_reales: number;
    plazas_disponibles_reales: number;
    plazas_ocupadas: number;
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
    const [newParkingAddress, setNewParkingAddress] = useState("");
    const MAX_PARKINGS_PER_USER = 5;

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

        if (!newParkingAddress.trim()) {
            setError("La dirección del estacionamiento es requerida y debe ser única");
            return;
        }

        // Validación básica de nombre
        if (newParkingName.trim().length < 2) {
            setError("El nombre debe tener al menos 2 caracteres");
            return;
        }

        // Validación básica de dirección
        if (newParkingAddress.trim().length < 5) {
            setError("La dirección debe tener al menos 5 caracteres");
            return;
        }

        // Verificar límite de estacionamientos
        if (estacionamientos.length >= MAX_PARKINGS_PER_USER) {
            setError(`Has alcanzado el límite máximo de estacionamientos (${MAX_PARKINGS_PER_USER})`);
            return;
        }

        // Verificar que no exista ya un estacionamiento con este nombre
        const existingParking = estacionamientos.find(
            est => est.est_nombre.toLowerCase() === newParkingName.trim().toLowerCase()
        );

        if (existingParking) {
            setError(`Ya tienes un estacionamiento con el nombre "${newParkingName.trim()}"`);
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
                    // El email se obtiene automáticamente del usuario autenticado
                    // email: usuario?.email, // Removido: ahora se obtiene del auth
                    direccion: newParkingAddress.trim()
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
                        // El email se obtiene automáticamente del usuario autenticado
                        // email: usuario?.email, // Removido: ahora se obtiene del auth
                        direccion: newParkingAddress.trim()
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
                setNewParkingAddress("");
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
                <Card>
                    <CardHeader>
                        <CardTitle className="text-gray-900 flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Información del Usuario
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-gray-600">
                            <p><span className="text-gray-500">Nombre:</span> {usuario.nombre_completo}</p>
                            <p><span className="text-gray-500">Email:</span> {usuario.email}</p>
                            <p><span className="text-gray-500">ID Usuario:</span> {usuario.usu_id}</p>
                            <div className="pt-2 border-t border-gray-200">
                                <p className="text-sm">
                                    <span className="text-gray-500">Estacionamientos:</span>{' '}
                                    <span className={`font-semibold ${estacionamientos.length >= MAX_PARKINGS_PER_USER
                                        ? 'text-blue-600'
                                        : estacionamientos.length >= MAX_PARKINGS_PER_USER * 0.8
                                            ? 'text-amber-500'
                                            : 'text-green-600'
                                        }`}>
                                        {estacionamientos.length}/{MAX_PARKINGS_PER_USER}
                                    </span>
                                </p>
                                {estacionamientos.length >= MAX_PARKINGS_PER_USER && (
                                    <p className="text-xs text-blue-600 mt-1">
                                        ℹ️ Has alcanzado el límite máximo
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
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
                <Card className="bg-white/50 border-gray-200">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Lista de Estacionamientos ({estacionamientos.length}/{MAX_PARKINGS_PER_USER})
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={() => setShowCreateForm(!showCreateForm)}
                                    variant="outline"
                                    size="sm"
                                    className="bg-gray-50 border-gray-200 hover:bg-gray-100"
                                    disabled={estacionamientos.length >= MAX_PARKINGS_PER_USER}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nuevo Estacionamiento
                                </Button>
                                {estacionamientos.length >= MAX_PARKINGS_PER_USER && (
                                    <div className="flex items-center gap-1 text-blue-600 text-sm">
                                        <span>⚠️ Límite alcanzado</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Formulario de creación de nuevo estacionamiento */}
                        {showCreateForm && estacionamientos.length < MAX_PARKINGS_PER_USER && (
                            <Card className="bg-gray-50 border-gray-200 mb-6">
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        <div className="mb-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Plus className="h-5 w-5 text-gray-500" />
                                                <h3 className="text-lg font-medium text-gray-700">
                                                    Crear Nuevo Estacionamiento
                                                </h3>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                <span>Estacionamientos: {estacionamientos.length}/{MAX_PARKINGS_PER_USER}</span>
                                                <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                                                    <div
                                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                                        style={{ width: `${(estacionamientos.length / MAX_PARKINGS_PER_USER) * 100}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <div>
                                                <Label htmlFor="parking-name" className="text-gray-600">
                                                    Nombre del Estacionamiento *
                                                </Label>
                                                <Input
                                                    id="parking-name"
                                                    type="text"
                                                    placeholder="Ej: Estacionamiento Centro"
                                                    value={newParkingName}
                                                    onChange={(e) => {
                                                        setNewParkingName(e.target.value);
                                                        // Limpiar error cuando el usuario empiece a escribir
                                                        if (error && error.includes("nombre")) {
                                                            setError(null);
                                                        }
                                                    }}
                                                    className="bg-gray-100 border-gray-200 text-gray-900 mt-1"
                                                    disabled={creating}
                                                />
                                            </div>

                                            <AddressAutocomplete
                                                value={newParkingAddress}
                                                onChange={(value) => {
                                                    setNewParkingAddress(value);
                                                    // Limpiar error cuando el usuario empiece a escribir
                                                    if (error && error.includes("dirección")) {
                                                        setError(null);
                                                    }
                                                }}
                                                onSelect={(place) => {
                                                    console.log('📍 Dirección completa seleccionada:', place);
                                                    // Aquí puedes extraer información adicional del lugar si es necesario
                                                }}
                                                placeholder="Ej: Av. Libertador 1234, Buenos Aires"
                                                error={error && error.includes("dirección") ? error : undefined}
                                                disabled={creating}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                ⚠️ La dirección debe ser única en todo el sistema
                                            </p>
                                            {newParkingAddress.trim() && newParkingAddress.trim().length >= 5 && (
                                                <p className="text-xs text-green-400 mt-1">
                                                    ✓ Dirección válida
                                                </p>
                                            )}

                                            <div className="flex gap-2">
                                                <Button
                                                    onClick={createNewParking}
                                                    disabled={
                                                        creating ||
                                                        !newParkingName.trim() ||
                                                        !newParkingAddress.trim() ||
                                                        newParkingName.trim().length < 2 ||
                                                        newParkingAddress.trim().length < 5 ||
                                                        estacionamientos.length >= MAX_PARKINGS_PER_USER
                                                    }
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
                                                        setNewParkingAddress("");
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
                                <Building2 className="h-16 w-16 mx-auto text-gray-500 mb-4" />
                                <h3 className="text-lg font-medium text-gray-600 mb-2">
                                    No tienes estacionamientos configurados
                                </h3>
                                <p className="text-gray-500 mb-4">
                                    Crea tu primer estacionamiento usando el botón "Nuevo Estacionamiento" arriba.
                                    Podrás crear hasta {MAX_PARKINGS_PER_USER} estacionamientos.
                                </p>
                                <Button onClick={fetchUserParkings} variant="outline">
                                    Actualizar
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Mostrar aviso si está en el límite pero permitir selección */}
                                {estacionamientos.length >= MAX_PARKINGS_PER_USER && (
                                    <Card className="bg-blue-50 border-blue-200">
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="text-2xl">⚠️</div>
                                                <div>
                                                    <h4 className="text-blue-700 font-medium">
                                                        Límite de Estacionamientos Alcanzado
                                                    </h4>
                                                    <p className="text-blue-600 text-sm">
                                                        Has alcanzado el límite máximo de {MAX_PARKINGS_PER_USER} estacionamientos.
                                                        Puedes seguir usando tus estacionamientos existentes, pero no puedes crear nuevos.
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                <div className="grid gap-4">
                                    {estacionamientos.map((estacionamiento) => (
                                        <Card
                                            key={estacionamiento.est_id}
                                            className={`bg-gray-50 border-gray-200 cursor-pointer transition-colors ${currentEstId === estacionamiento.est_id
                                                ? 'ring-2 ring-blue-500 bg-gray-100'
                                                : 'hover:bg-gray-100'
                                                }`}
                                            onClick={() => onSelectParking?.(estacionamiento.est_id)}
                                        >
                                            <CardHeader className="pb-3">
                                                <div className="flex items-center justify-between">
                                                    <CardTitle className="text-gray-900 text-lg">
                                                        {estacionamiento.est_nombre}
                                                    </CardTitle>
                                                    <Badge variant={currentEstId === estacionamiento.est_id ? "default" : "secondary"}>
                                                        ID: {estacionamiento.est_id}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <MapPin className="h-4 w-4 text-gray-400" />
                                                        <span>{estacionamiento.est_prov}, {estacionamiento.est_locali}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Building2 className="h-4 w-4 text-gray-400" />
                                                        <span className="font-semibold text-green-400">
                                                            {estacionamiento.plazas_totales_reales || 0} plazas totales
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Users className="h-4 w-4 text-gray-400" />
                                                        <span className="font-semibold text-blue-400">
                                                            {estacionamiento.plazas_disponibles_reales || 0} disponibles
                                                        </span>
                                                        {estacionamiento.plazas_ocupadas > 0 && (
                                                            <span className="text-amber-600 text-xs">
                                                                ({estacionamiento.plazas_ocupadas} ocupadas)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Clock className="h-4 w-4 text-gray-400" />
                                                        <span>{estacionamiento.est_horario_funcionamiento}h funcionamiento</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-gray-500 text-xs">
                                                    <p>{estacionamiento.est_direc}</p>
                                                    <p>Tolerancia: {estacionamiento.est_tolerancia_min} minutos</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-green-400">Datos calculados en tiempo real</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
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