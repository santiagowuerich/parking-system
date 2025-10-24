"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Building2, MapPin, Clock, Users, Settings, Plus, Trash2 } from "lucide-react";
import ParkingConfig from "./parking-config";
import AddressAutocomplete from "./address-autocomplete";
import { useAuth } from "@/lib/auth-context";

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
    // Usar estado centralizado del AuthContext
    const {
        user: authUser,
        parkings: estacionamientos,
        parkingsUser: usuario,
        parkingsLoading: loading,
        parkingsError: error,
        fetchParkings
    } = useAuth();

    const [activeTab, setActiveTab] = useState("list");
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newParkingName, setNewParkingName] = useState("");
    const [newParkingAddress, setNewParkingAddress] = useState("");
    const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false);
    // Campos detallados de dirección obtenidos del autocompletado
    const [newParkingProvince, setNewParkingProvince] = useState<string>("Por configurar");
    const [newParkingLocality, setNewParkingLocality] = useState<string>("Por configurar");
    const [newParkingPostalCode, setNewParkingPostalCode] = useState<string>("");
    const [newParkingLat, setNewParkingLat] = useState<number | null>(null);
    const [newParkingLng, setNewParkingLng] = useState<number | null>(null);
    const [newParkingFullAddress, setNewParkingFullAddress] = useState<string>("");
    const MAX_PARKINGS_PER_USER = 5;

    // Evitar bucle de recarga cuando no hay estacionamientos
    // Solo intentamos cargar una vez al montar el componente
    const [requestedOnce, setRequestedOnce] = useState(false);
    useEffect(() => {
        // Solo cargar si no hay estacionamientos y no está cargando
        if (requestedOnce || loading || estacionamientos.length > 0) return;
        setRequestedOnce(true);
        fetchParkings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const createNewParking = async () => {
        if (!newParkingName.trim()) {
            // El error se maneja localmente ya que es específico del formulario
            alert("El nombre del estacionamiento es requerido");
            return;
        }

        if (!newParkingAddress.trim()) {
            alert("La dirección del estacionamiento es requerida y debe ser única");
            return;
        }

        // Validación básica de nombre
        if (newParkingName.trim().length < 2) {
            alert("El nombre debe tener al menos 2 caracteres");
            return;
        }

        // Validación básica de dirección
        if (newParkingAddress.trim().length < 5) {
            alert("La dirección debe tener al menos 5 caracteres");
            return;
        }

        // Verificar límite de estacionamientos
        if (estacionamientos.length >= MAX_PARKINGS_PER_USER) {
            alert(`Has alcanzado el límite máximo de estacionamientos (${MAX_PARKINGS_PER_USER})`);
            return;
        }

        // Verificar que no exista ya un estacionamiento con este nombre
        const existingParking = estacionamientos.find(
            est => est.est_nombre.toLowerCase() === newParkingName.trim().toLowerCase()
        );

        if (existingParking) {
            alert(`Ya tienes un estacionamiento con el nombre "${newParkingName.trim()}"`);
            return;
        }

        setCreating(true);

        try {
            // Si el usuario no confirmó seleccionando de la lista, intentar resolver con geocodificación
            if (!addressConfirmed) {
                try {
                    const resp = await fetch('/api/geocoding/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: newParkingAddress, region: 'ar' })
                    });
                    const data = await resp.json();
                    if (resp.ok && data.success && Array.isArray(data.results) && data.results.length > 0) {
                        const suggestion = data.results[0];
                        setNewParkingFullAddress(suggestion.formatted_address);
                        setNewParkingLocality(suggestion.components.locality || suggestion.components.city || 'Por configurar');
                        setNewParkingProvince(suggestion.components.state || 'Por configurar');
                        setNewParkingPostalCode(suggestion.components.postal_code || '');
                        setNewParkingLat(suggestion.latitud ?? null);
                        setNewParkingLng(suggestion.longitud ?? null);
                    } else {
                        alert('Seleccioná una dirección de la lista para continuar.');
                        setCreating(false);
                        return;
                    }
                } catch (_) {
                    alert('No se pudo validar la dirección. Seleccioná una de la lista.');
                    setCreating(false);
                    return;
                }
            }
            // Primera estrategia: endpoint principal
            console.log('🚀 Intentando crear estacionamiento con endpoint principal...');
            let response = await fetch('/api/auth/create-new-parking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newParkingName.trim(),
                    email: usuario?.email || authUser?.email,
                    direccion: newParkingAddress.trim(),
                    est_prov: newParkingProvince,
                    est_locali: newParkingLocality,
                    est_codigo_postal: newParkingPostalCode,
                    est_latitud: newParkingLat,
                    est_longitud: newParkingLng,
                    est_direccion_completa: newParkingFullAddress || newParkingAddress.trim()
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
                        email: usuario?.email || authUser?.email,
                        direccion: newParkingAddress.trim(),
                        est_prov: newParkingProvince,
                        est_locali: newParkingLocality,
                        est_codigo_postal: newParkingPostalCode,
                        est_latitud: newParkingLat,
                        est_longitud: newParkingLng,
                        est_direccion_completa: newParkingFullAddress || newParkingAddress.trim()
                    }),
                });
            }

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Nuevo estacionamiento creado:', data);

                // Recargar la lista de estacionamientos usando el contexto centralizado
                await fetchParkings();

                // Limpiar el formulario
                setNewParkingName("");
                setNewParkingAddress("");
                setNewParkingProvince("Por configurar");
                setNewParkingLocality("Por configurar");
                setNewParkingPostalCode("");
                setNewParkingLat(null);
                setNewParkingLng(null);
                setNewParkingFullAddress("");
                setAddressConfirmed(false);
                setShowCreateForm(false);

                // Seleccionar automáticamente el nuevo estacionamiento si se creó
                if (data.estacionamiento_id && onSelectParking) {
                    onSelectParking(data.estacionamiento_id);
                }
            } else {
                const errorData = await response.json();
                console.error('❌ Error creando estacionamiento:', errorData);

                // Mostrar mensaje de error más específico
                const errorMessage = errorData.details
                    ? `${errorData.error}: ${errorData.details}`
                    : errorData.error || "Error creando estacionamiento";
                alert(errorMessage);
            }
        } catch (err) {
            console.error("Error creando estacionamiento:", err);
            alert("Error de conexión - intenta nuevamente");
        } finally {
            setCreating(false);
        }
    };

    // El fetching se hace automáticamente por el AuthContext cuando es necesario

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
                        <Button onClick={() => fetchParkings()} variant="outline">
                            Reintentar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {false && (
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
                                                    }}
                                                    className="bg-gray-100 border-gray-200 text-gray-900 mt-1"
                                                    disabled={creating}
                                                />
                                            </div>

                                            <AddressAutocomplete
                                                value={newParkingAddress}
                                                onChange={(value) => {
                                                    setNewParkingAddress(value);
                                                    setAddressConfirmed(false);
                                                }}
                                                onSelect={(place) => {
                                                    console.log('📍 Dirección completa seleccionada:', place);
                                                    // Extraer y guardar campos relevantes automáticamente
                                                    const components = place.address_components || [];
                                                    const getComp = (types: string[]) => {
                                                        const c = components.find((comp: any) => types.some((t: string) => comp.types.includes(t)));
                                                        return c?.long_name || '';
                                                    };
                                                    const streetName = getComp(['route']);
                                                    const streetNumber = getComp(['street_number']);
                                                    const locality = getComp(['locality', 'sublocality']);
                                                    const city = getComp(['administrative_area_level_2']);
                                                    const state = getComp(['administrative_area_level_1']);
                                                    const postal = getComp(['postal_code']);
                                                    const formatted = place.formatted_address || `${streetName} ${streetNumber}`.trim();
                                                    setNewParkingFullAddress(formatted);
                                                    setNewParkingLocality(locality || city || 'Por configurar');
                                                    setNewParkingProvince(state || 'Por configurar');
                                                    setNewParkingPostalCode(postal || '');
                                                    const latVal = typeof place?.geometry?.location?.lat === 'function'
                                                        ? (place.geometry.location.lat() as number)
                                                        : null;
                                                    const lngVal = typeof place?.geometry?.location?.lng === 'function'
                                                        ? (place.geometry.location.lng() as number)
                                                        : null;
                                                    setNewParkingLat(latVal);
                                                    setNewParkingLng(lngVal);
                                                    setAddressConfirmed(true);
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
                                <Button onClick={() => fetchParkings()} variant="outline">
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
                                                <CardTitle className="text-gray-900 text-lg">
                                                    {estacionamiento.est_nombre}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                                {/* Dirección completa */}
                                                <div className="flex items-center gap-2 text-gray-600 mb-3">
                                                    <MapPin className="h-4 w-4 text-gray-400" />
                                                    <span className="text-sm">{estacionamiento.est_direc}, {estacionamiento.est_locali}, {estacionamiento.est_prov}</span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Building2 className="h-4 w-4 text-gray-400" />
                                                        <span className="font-semibold text-green-600">
                                                            {estacionamiento.plazas_total || 0} plazas totales
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Users className="h-4 w-4 text-gray-400" />
                                                        <span className="font-semibold text-blue-600">
                                                            {estacionamiento.plazas_libres || 0} disponibles
                                                        </span>
                                                        {(estacionamiento.plazas_ocupadas > 0) && (
                                                            <span className="text-amber-600 text-xs">
                                                                ({estacionamiento.plazas_ocupadas} ocupadas)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-600">
                                                        <Clock className="h-4 w-4 text-gray-400" />
                                                        <span>{estacionamiento.est_horario_funcionamiento || 24}h funcionamiento</span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-gray-500 text-xs">
                                                    <p>Tolerancia: {estacionamiento.est_tolerancia_min || 0} minutos</p>
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


