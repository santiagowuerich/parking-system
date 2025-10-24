"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Calendar } from "lucide-react";
import { Building2, MapPin, Clock, Users, Settings, Plus, Trash2, CheckCircle, Phone, Mail, Timer, Search, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import ParkingConfig from "./parking-config";
import AddressAutocomplete from "./address-autocomplete";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import GoogleMap from "./google-map";
import { Checkbox } from "@/components/ui/checkbox";
import HorariosEditor from "./horarios-editor";
import { HorarioFranja, RequiereLlaveOption, LLAVE_OPTIONS, EstadoApertura, isEstacionamientoAbierto } from "@/lib/types/horarios";

interface Estacionamiento {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_capacidad: number;
    est_cantidad_espacios_disponibles: number;
    est_tolerancia_min: number;
    est_publicado: boolean;
    est_requiere_llave: RequiereLlaveOption;
    est_descripcion?: string;
    est_telefono?: string;
    est_email?: string;
    // Nuevos campos calculados dinámicamente
    plazas_totales_reales: number;
    plazas_disponibles_reales: number;
    plazas_ocupadas: number;
    horarios?: HorarioFranja[];
    estadoApertura?: EstadoApertura;
}

interface Usuario {
    usu_id: number;
    nombre_completo: string;
    email: string;
}

interface EstacionamientoConfig {
    est_id: number;
    est_nombre: string;
    est_prov: string;
    est_locali: string;
    est_direc: string;
    est_direccion_completa?: string;
    est_latitud?: number;
    est_longitud?: number;
    est_codigo_postal?: string;
    est_telefono?: string;
    est_email?: string;
    est_descripcion?: string;
    est_capacidad: number;
    est_tolerancia_min: number;
    est_publicado: boolean;
    est_requiere_llave: RequiereLlaveOption;
}

interface AddressSuggestion {
    formatted_address: string;
    place_id: string;
    latitud: number;
    longitud: number;
    components: {
        street_number: string;
        street_name: string;
        locality: string;
        city: string;
        state: string;
        postal_code: string;
        country: string;
    };
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

    // Estado para modal de edición de configuración
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingConfig, setEditingConfig] = useState<EstacionamientoConfig | null>(null);
    const [editingHorarios, setEditingHorarios] = useState<HorarioFranja[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [configAddressSearch, setConfigAddressSearch] = useState("");
    const [configAddressSuggestions, setConfigAddressSuggestions] = useState<AddressSuggestion[]>([]);
    const [searchingConfigAddress, setSearchingConfigAddress] = useState(false);
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);

    // Evitar bucle de recarga cuando no hay estacionamientos
    // Solo intentamos cargar una vez al montar el componente
    const [requestedOnce, setRequestedOnce] = useState(false);
    const [estacionamientosEnriquecidos, setEstacionamientosEnriquecidos] = useState<Estacionamiento[]>([]);
    const [loadingHorarios, setLoadingHorarios] = useState(false);

    useEffect(() => {
        // Solo cargar si no hay estacionamientos y no está cargando
        if (requestedOnce || loading || estacionamientos.length > 0) return;
        setRequestedOnce(true);
        fetchParkings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enriquecer estacionamientos con horarios y estado de apertura
    useEffect(() => {
        const enriquecerConHorarios = async () => {
            if (estacionamientos.length === 0) {
                setEstacionamientosEnriquecidos([]);
                return;
            }

            setLoadingHorarios(true);

            const enriquecidos = await Promise.all(
                estacionamientos.map(async (est) => {
                    try {
                        // Consultar horarios del estacionamiento
                        const response = await fetch(`/api/estacionamiento/horarios?est_id=${est.est_id}`);
                        const data = await response.json();

                        const horarios = (data.success && data.horarios) ? data.horarios : [];
                        const estadoApertura = isEstacionamientoAbierto(horarios);

                        return {
                            ...est,
                            horarios,
                            estadoApertura
                        };
                    } catch (error) {
                        console.error(`Error cargando horarios para ${est.est_nombre}:`, error);
                        return {
                            ...est,
                            horarios: [],
                            estadoApertura: { isOpen: false, hasSchedule: false }
                        };
                    }
                })
            );

            setEstacionamientosEnriquecidos(enriquecidos);
            setLoadingHorarios(false);
        };

        enriquecerConHorarios();
    }, [estacionamientos]);
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

    // Funciones para el modal de edición de configuración
    const provinciaOptions = [
        "Buenos Aires", "CABA", "Córdoba", "Santa Fe", "Mendoza",
        "Tucumán", "Entre Ríos", "Salta", "Misiones", "Corrientes",
        "Santiago del Estero", "San Juan", "Jujuy", "Río Negro",
        "Neuquén", "Formosa", "Chubut", "San Luis", "Catamarca",
        "La Rioja", "La Pampa", "Santa Cruz", "Chaco", "Tierra del Fuego"
    ];

    const openEditConfigModal = async (estId: number) => {
        setLoadingConfig(true);
        setShowEditModal(true);

        try {
            // Cargar configuración
            const configResponse = await fetch(`/api/estacionamiento/config?est_id=${estId}`);
            const configData = await configResponse.json();

            if (configResponse.ok && configData.success) {
                setEditingConfig(configData.estacionamiento);
                if (configData.estacionamiento.est_direccion_completa) {
                    setConfigAddressSearch(configData.estacionamiento.est_direccion_completa);
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: configData.error || "Error cargando configuración"
                });
                setShowEditModal(false);
                setLoadingConfig(false);
                return;
            }

            // Cargar horarios
            const horariosResponse = await fetch(`/api/estacionamiento/horarios?est_id=${estId}`);
            const horariosData = await horariosResponse.json();

            if (horariosResponse.ok && horariosData.success) {
                // Normalizar formato de horas al cargar desde la BD
                const horariosNormalizados = (horariosData.horarios || []).map((h: HorarioFranja) => {
                    const normalizeTime = (time: string) => {
                        if (!time || !time.includes(':')) return time;
                        const [horas, minutos] = time.split(':');
                        return `${horas.padStart(2, '0')}:${minutos.padStart(2, '0')}`;
                    };

                    return {
                        ...h,
                        hora_apertura: normalizeTime(h.hora_apertura),
                        hora_cierre: normalizeTime(h.hora_cierre)
                    };
                });
                setEditingHorarios(horariosNormalizados);
            } else {
                // Si falla la carga de horarios, inicializar vacío
                setEditingHorarios([]);
                console.warn("No se pudieron cargar los horarios:", horariosData.error);
            }
        } catch (error) {
            console.error("Error cargando configuración:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar la configuración"
            });
            setShowEditModal(false);
        } finally {
            setLoadingConfig(false);
        }
    };

    const updateEditingConfig = (field: keyof EstacionamientoConfig, value: any) => {
        if (!editingConfig) return;
        setEditingConfig({ ...editingConfig, [field]: value });
    };

    const saveEditingConfig = async () => {
        if (!editingConfig) return;

        setSavingConfig(true);
        try {
            // Guardar configuración del estacionamiento
            const configResponse = await fetch('/api/estacionamiento/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingConfig)
            });

            const configData = await configResponse.json();

            if (!configResponse.ok || !configData.success) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: configData.error || "Error guardando configuración"
                });
                setSavingConfig(false);
                return;
            }

            // Guardar horarios
            const horariosResponse = await fetch('/api/estacionamiento/horarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    est_id: editingConfig.est_id,
                    horarios: editingHorarios
                })
            });

            const horariosData = await horariosResponse.json();

            if (!horariosResponse.ok || !horariosData.success) {
                toast({
                    variant: "destructive",
                    title: "Advertencia",
                    description: "Configuración guardada pero error actualizando horarios"
                });
            }

            // Éxito completo
            toast({
                title: "Configuración guardada",
                description: "Los datos del estacionamiento y horarios han sido actualizados"
            });

            setEditingConfig(configData.estacionamiento);
            setShowEditModal(false);
            // Recargar lista de estacionamientos
            await fetchParkings();

        } catch (error) {
            console.error("Error guardando configuración:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al guardar la configuración"
            });
        } finally {
            setSavingConfig(false);
        }
    };

    const getAutocompleteSuggestions = async (input: string) => {
        if (!input.trim() || input.length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        setLoadingAutocomplete(true);
        try {
            if (!window.google || !window.google.maps || !window.google.maps.places) {
                console.warn('Google Places API no disponible');
                return;
            }

            const service = new window.google.maps.places.AutocompleteService();

            const request = {
                input: input,
                componentRestrictions: { country: 'ar' },
                fields: ['place_id', 'description', 'structured_formatting']
            };

            service.getPlacePredictions(request, (predictions: any[], status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    setAutocompleteSuggestions(predictions);
                    setShowAutocomplete(true);
                    setSelectedSuggestionIndex(-1);
                } else {
                    setAutocompleteSuggestions([]);
                    setShowAutocomplete(false);
                }
                setLoadingAutocomplete(false);
            });
        } catch (error) {
            console.error('Error obteniendo sugerencias de autocompletado:', error);
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            setLoadingAutocomplete(false);
        }
    };

    const getPlaceDetails = (placeId: string): Promise<AddressSuggestion> => {
        return new Promise((resolve, reject) => {
            if (!window.google || !window.google.maps || !window.google.maps.places) {
                reject(new Error('Google Places API no disponible'));
                return;
            }

            const service = new window.google.maps.places.PlacesService(document.createElement('div'));

            service.getDetails({
                placeId: placeId,
                fields: ['place_id', 'formatted_address', 'geometry', 'address_components']
            }, (place: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    const components = place.address_components || [];
                    const getComponent = (types: string[]) => {
                        const component = components.find((comp: any) =>
                            types.some((type: string) => comp.types.includes(type))
                        );
                        return component?.long_name || '';
                    };

                    const suggestion: AddressSuggestion = {
                        formatted_address: place.formatted_address || '',
                        place_id: place.place_id || '',
                        latitud: place.geometry?.location?.lat() || 0,
                        longitud: place.geometry?.location?.lng() || 0,
                        components: {
                            street_number: getComponent(['street_number']),
                            street_name: getComponent(['route']),
                            locality: getComponent(['locality', 'sublocality']),
                            city: getComponent(['administrative_area_level_2']),
                            state: getComponent(['administrative_area_level_1']),
                            postal_code: getComponent(['postal_code']),
                            country: getComponent(['country'])
                        }
                    };

                    resolve(suggestion);
                } else {
                    reject(new Error('Error obteniendo detalles del lugar'));
                }
            });
        });
    };

    const selectAutocompleteSuggestion = async (suggestion: any) => {
        if (!editingConfig) return;

        try {
            setLoadingAutocomplete(true);
            const placeDetails = await getPlaceDetails(suggestion.place_id);

            setEditingConfig({
                ...editingConfig,
                est_direccion_completa: placeDetails.formatted_address,
                est_direc: `${placeDetails.components.street_name} ${placeDetails.components.street_number}`.trim(),
                est_locali: placeDetails.components.locality || placeDetails.components.city,
                est_prov: placeDetails.components.state,
                est_codigo_postal: placeDetails.components.postal_code,
                est_latitud: placeDetails.latitud,
                est_longitud: placeDetails.longitud
            });

            setConfigAddressSearch(placeDetails.formatted_address);
            setShowAutocomplete(false);
            setAutocompleteSuggestions([]);

            toast({
                title: "Dirección seleccionada",
                description: "Datos actualizados. No olvides guardar los cambios."
            });
        } catch (error) {
            console.error('Error seleccionando sugerencia:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudieron obtener los detalles de la dirección seleccionada"
            });
        } finally {
            setLoadingAutocomplete(false);
        }
    };

    const handleConfigAddressInputChange = (value: string) => {
        setConfigAddressSearch(value);
        getAutocompleteSuggestions(value);
    };

    const handleConfigAddressKeyDown = (e: React.KeyboardEvent) => {
        if (!showAutocomplete || autocompleteSuggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedSuggestionIndex(prev =>
                    prev < autocompleteSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < autocompleteSuggestions.length) {
                    selectAutocompleteSuggestion(autocompleteSuggestions[selectedSuggestionIndex]);
                }
                break;
            case 'Escape':
                setShowAutocomplete(false);
                setSelectedSuggestionIndex(-1);
                break;
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

                                <div className="grid gap-6">
                                    {(loadingHorarios ? estacionamientos : estacionamientosEnriquecidos).map((estacionamiento) => {
                                        const porcentajeOcupacion = estacionamiento.plazas_totales_reales > 0
                                            ? Math.round((estacionamiento.plazas_ocupadas / estacionamiento.plazas_totales_reales) * 100)
                                            : 0;

                                        return (
                                        <Card
                                            key={estacionamiento.est_id}
                                            className={`overflow-hidden transition-all duration-300 hover:shadow-xl ${currentEstId === estacionamiento.est_id
                                                ? 'ring-4 ring-blue-400 shadow-2xl'
                                                : 'shadow-lg'
                                                }`}
                                        >
                                            {/* HEADER CON GRADIENTE */}
                                            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b-2 border-blue-100">
                                                <div className="space-y-3">
                                                    {/* Título y badges */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1">
                                                            <CardTitle className="text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                                                                {estacionamiento.est_nombre}
                                                                {currentEstId === estacionamiento.est_id && (
                                                                    <span className="text-2xl">⭐</span>
                                                                )}
                                                            </CardTitle>
                                                            {estacionamiento.est_descripcion && (
                                                                <p className="text-sm text-gray-600 line-clamp-2">
                                                                    {estacionamiento.est_descripcion}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            {currentEstId === estacionamiento.est_id && (
                                                                <Badge className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
                                                                    ✓ Activo
                                                                </Badge>
                                                            )}
                                                            {!estacionamiento.est_publicado && (
                                                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300">
                                                                    🚫 Borrador
                                                                </Badge>
                                                            )}
                                                            {loadingHorarios ? (
                                                                <Badge variant="outline" className="animate-pulse">
                                                                    ⏳ Cargando...
                                                                </Badge>
                                                            ) : estacionamiento.estadoApertura && (
                                                                estacionamiento.estadoApertura.hasSchedule ? (
                                                                    estacionamiento.estadoApertura.isOpen ? (
                                                                        <Badge className="bg-green-100 text-green-800 border-green-300">
                                                                            🟢 ABIERTO
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge className="bg-red-100 text-red-800 border-red-300">
                                                                            🔴 CERRADO
                                                                        </Badge>
                                                                    )
                                                                ) : (
                                                                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                                                        ⚠️ Sin horarios
                                                                    </Badge>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Próximo cambio de horario */}
                                                    {!loadingHorarios && estacionamiento.estadoApertura?.nextChange && (
                                                        <div className="text-xs text-gray-600 bg-white/50 px-3 py-1.5 rounded-full inline-block">
                                                            ⏰ {estacionamiento.estadoApertura.nextChange}
                                                        </div>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-5">
                                                {/* Dirección */}
                                                <div className="flex items-center gap-3 text-gray-700 bg-gray-50 p-3 rounded-lg">
                                                    <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                                    <span className="text-sm font-medium">{estacionamiento.est_direc}, {estacionamiento.est_locali}, {estacionamiento.est_prov}</span>
                                                </div>

                                                {/* Grid de estadísticas - MEJORADO */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    {/* Card de Plazas Totales */}
                                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border-2 border-green-200">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-green-500 rounded-lg">
                                                                <Building2 className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div>
                                                                <div className="text-2xl font-bold text-green-700">
                                                                    {estacionamiento.plazas_totales_reales || 0}
                                                                </div>
                                                                <div className="text-xs text-green-600 font-medium">Plazas totales</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Card de Disponibles */}
                                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border-2 border-blue-200">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-500 rounded-lg">
                                                                <Users className="h-5 w-5 text-white" />
                                                            </div>
                                                            <div>
                                                                <div className="text-2xl font-bold text-blue-700">
                                                                    {estacionamiento.plazas_disponibles_reales || 0}
                                                                </div>
                                                                <div className="text-xs text-blue-600 font-medium">Disponibles</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Barra de ocupación */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600 font-medium">Ocupación</span>
                                                        <span className={`font-bold ${porcentajeOcupacion > 80 ? 'text-red-600' : porcentajeOcupacion > 50 ? 'text-amber-600' : 'text-green-600'}`}>
                                                            {porcentajeOcupacion}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-500 rounded-full ${
                                                                porcentajeOcupacion > 80 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                                                porcentajeOcupacion > 50 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
                                                                'bg-gradient-to-r from-green-500 to-emerald-500'
                                                            }`}
                                                            style={{ width: `${porcentajeOcupacion}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-xs text-gray-500 text-center">
                                                        {estacionamiento.plazas_ocupadas} ocupadas
                                                    </div>
                                                </div>

                                                {/* Información adicional */}
                                                <div className="grid grid-cols-2 gap-3 text-sm">
                                                    <div className="flex items-center gap-2 text-gray-600 bg-gray-50 p-2 rounded-lg">
                                                        <Timer className="h-4 w-4 text-gray-500" />
                                                        <span><strong>{estacionamiento.est_tolerancia_min}</strong> min tolerancia</span>
                                                    </div>
                                                    {estacionamiento.est_requiere_llave && estacionamiento.est_requiere_llave !== 'no' && (
                                                        <div className={`flex items-center gap-2 p-2 rounded-lg ${
                                                            estacionamiento.est_requiere_llave === 'requerida'
                                                                ? 'bg-red-50 text-red-700'
                                                                : 'bg-yellow-50 text-yellow-700'
                                                        }`}>
                                                            <span className="text-base">🔑</span>
                                                            <span className="text-xs font-medium">
                                                                {estacionamiento.est_requiere_llave === 'requerida' ? 'Llave requerida' : 'Llave opcional'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Contacto si existe */}
                                                {(estacionamiento.est_telefono || estacionamiento.est_email) && (
                                                    <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                                        <div className="text-xs text-gray-500 font-semibold mb-2">CONTACTO</div>
                                                        {estacionamiento.est_telefono && (
                                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                                <Phone className="h-3 w-3" />
                                                                {estacionamiento.est_telefono}
                                                            </div>
                                                        )}
                                                        {estacionamiento.est_email && (
                                                            <div className="flex items-center gap-2 text-sm text-gray-700">
                                                                <Mail className="h-3 w-3" />
                                                                {estacionamiento.est_email}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Indicador de datos en tiempo real */}
                                                <div className="flex items-center justify-center gap-2 text-xs text-green-600 bg-green-50 py-2 rounded-lg">
                                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                    <span className="font-medium">Datos actualizados en tiempo real</span>
                                                </div>

                                                {/* Botones de acción - MEJORADOS */}
                                                <div className="grid grid-cols-3 gap-3 pt-4 border-t-2 border-gray-100">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditConfigModal(estacionamiento.est_id);
                                                        }}
                                                        className="h-11 hover:bg-blue-50 hover:border-blue-300"
                                                    >
                                                        <Settings className="h-4 w-4 mr-1" />
                                                        Editar
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!estacionamiento.horarios || estacionamiento.horarios.length === 0) {
                                                                toast({
                                                                    title: "Sin horarios configurados",
                                                                    description: "Este estacionamiento aún no tiene horarios. Edítalo para configurarlos.",
                                                                    variant: "default"
                                                                });
                                                                return;
                                                            }

                                                            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                                            const horariosPorDia: { [key: number]: HorarioFranja[] } = {};

                                                            estacionamiento.horarios.forEach(h => {
                                                                if (!horariosPorDia[h.dia_semana]) {
                                                                    horariosPorDia[h.dia_semana] = [];
                                                                }
                                                                horariosPorDia[h.dia_semana].push(h);
                                                            });

                                                            let mensaje = `📅 Horarios de ${estacionamiento.est_nombre}\n\n`;
                                                            mensaje += '═'.repeat(45) + '\n\n';

                                                            for (let dia = 0; dia < 7; dia++) {
                                                                const nombreDia = diasSemana[dia].padEnd(12, ' ');
                                                                if (horariosPorDia[dia]) {
                                                                    const franjas = horariosPorDia[dia]
                                                                        .sort((a, b) => a.orden - b.orden)
                                                                        .map(h => `${h.hora_apertura}-${h.hora_cierre}`)
                                                                        .join(', ');
                                                                    mensaje += `${nombreDia} ${franjas}\n`;
                                                                } else {
                                                                    mensaje += `${nombreDia} 🔒 Cerrado\n`;
                                                                }
                                                            }

                                                            mensaje += '\n' + '═'.repeat(45);
                                                            alert(mensaje);
                                                        }}
                                                        className="h-11 hover:bg-purple-50 hover:border-purple-300"
                                                    >
                                                        <Calendar className="h-4 w-4 mr-1" />
                                                        Horarios
                                                    </Button>
                                                    <Button
                                                        variant={currentEstId === estacionamiento.est_id ? "secondary" : "default"}
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelectParking?.(estacionamiento.est_id);
                                                        }}
                                                        disabled={currentEstId === estacionamiento.est_id}
                                                        className={`h-11 ${currentEstId === estacionamiento.est_id ? '' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-1" />
                                                        {currentEstId === estacionamiento.est_id ? 'Activo' : 'Seleccionar'}
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        );
                                    })}
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

            {/* Modal de Edición de Configuración - MEJORADO */}
            <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
                <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
                    <DialogHeader className="border-b pb-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                                        <Settings className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                        <div>Configuración del Estacionamiento</div>
                                        {editingConfig && (
                                            <div className="text-sm font-normal text-gray-500 mt-1">
                                                {editingConfig.est_nombre}
                                            </div>
                                        )}
                                    </div>
                                </DialogTitle>
                            </div>

                            {/* Controles de Estado - MEJORADOS */}
                            {editingConfig && (
                                <div className="flex items-center gap-4 pt-2">
                                    {/* Toggle de Publicación */}
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 rounded-xl border-2 border-blue-200 flex-1">
                                        <div className="flex items-center gap-3 flex-1">
                                            {editingConfig.est_publicado ? (
                                                <Eye className="h-5 w-5 text-blue-600" />
                                            ) : (
                                                <EyeOff className="h-5 w-5 text-gray-400" />
                                            )}
                                            <div className="flex-1">
                                                <Label htmlFor="modal-publicado" className="text-sm font-semibold cursor-pointer text-gray-900">
                                                    Visible en el mapa
                                                </Label>
                                                <p className="text-xs text-gray-600">
                                                    {editingConfig.est_publicado
                                                        ? "Los conductores pueden ver este estacionamiento"
                                                        : "Estacionamiento oculto para conductores"}
                                                </p>
                                            </div>
                                            <Switch
                                                id="modal-publicado"
                                                checked={editingConfig.est_publicado}
                                                onCheckedChange={(checked) => updateEditingConfig('est_publicado', checked)}
                                            />
                                        </div>
                                    </div>

                                    {/* Botón Ver Horarios */}
                                    <Button
                                        variant="outline"
                                        size="lg"
                                        onClick={() => {
                                            if (editingHorarios.length === 0) {
                                                toast({
                                                    title: "Sin horarios configurados",
                                                    description: "Aún no has configurado los horarios de atención. Usa la pestaña 'Horarios' para configurarlos.",
                                                    variant: "default"
                                                });
                                                return;
                                            }

                                            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                            const horariosPorDia: { [key: number]: HorarioFranja[] } = {};

                                            editingHorarios.forEach(h => {
                                                if (!horariosPorDia[h.dia_semana]) {
                                                    horariosPorDia[h.dia_semana] = [];
                                                }
                                                horariosPorDia[h.dia_semana].push(h);
                                            });

                                            let mensaje = `📅 Horarios de ${editingConfig.est_nombre}\n\n`;
                                            mensaje += '═'.repeat(45) + '\n\n';

                                            for (let dia = 0; dia < 7; dia++) {
                                                const nombreDia = diasSemana[dia].padEnd(12, ' ');
                                                if (horariosPorDia[dia]) {
                                                    const franjas = horariosPorDia[dia]
                                                        .sort((a, b) => a.orden - b.orden)
                                                        .map(h => `${h.hora_apertura}-${h.hora_cierre}`)
                                                        .join(', ');
                                                    mensaje += `${nombreDia} ${franjas}\n`;
                                                } else {
                                                    mensaje += `${nombreDia} 🔒 Cerrado\n`;
                                                }
                                            }

                                            mensaje += '\n' + '═'.repeat(45);
                                            alert(mensaje);
                                        }}
                                        className="gap-2"
                                    >
                                        <Calendar className="h-4 w-4" />
                                        Ver Horarios
                                    </Button>
                                </div>
                            )}
                        </div>
                    </DialogHeader>

                    {loadingConfig ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center space-y-4">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                                <p className="text-gray-500">Cargando configuración...</p>
                            </div>
                        </div>
                    ) : editingConfig ? (
                        <Tabs defaultValue="general" className="w-full py-4">
                            <TabsList className="grid w-full grid-cols-3 mb-6">
                                <TabsTrigger value="general" className="gap-2">
                                    <Building2 className="h-4 w-4" />
                                    Información General
                                </TabsTrigger>
                                <TabsTrigger value="ubicacion" className="gap-2">
                                    <MapPin className="h-4 w-4" />
                                    Ubicación
                                </TabsTrigger>
                                <TabsTrigger value="horarios" className="gap-2">
                                    <Clock className="h-4 w-4" />
                                    Horarios
                                </TabsTrigger>
                            </TabsList>

                            {/* TAB: Información General */}
                            <TabsContent value="general" className="space-y-4">
                                <Card className="border-2 shadow-sm">
                                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                    <CardTitle className="text-gray-900 flex items-center gap-2">
                                        <Building2 className="h-5 w-5 text-blue-600" />
                                        Datos del Estacionamiento
                                    </CardTitle>
                                    <p className="text-sm text-gray-600 mt-1">Información básica y de contacto</p>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-nombre" className="text-gray-700">Nombre del Estacionamiento</Label>
                                            <Input
                                                id="edit-nombre"
                                                value={editingConfig.est_nombre}
                                                onChange={(e) => updateEditingConfig('est_nombre', e.target.value)}
                                                placeholder="Ej: Estacionamiento Centro"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-llave" className="text-gray-700">Requerimiento de Llave</Label>
                                            <Select
                                                value={editingConfig.est_requiere_llave}
                                                onValueChange={(value) => updateEditingConfig('est_requiere_llave', value as RequiereLlaveOption)}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="no">{LLAVE_OPTIONS.no}</SelectItem>
                                                    <SelectItem value="opcional">{LLAVE_OPTIONS.opcional}</SelectItem>
                                                    <SelectItem value="requerida">{LLAVE_OPTIONS.requerida}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-descripcion" className="text-gray-700">Descripción</Label>
                                        <Textarea
                                            id="edit-descripcion"
                                            value={editingConfig.est_descripcion || ''}
                                            onChange={(e) => updateEditingConfig('est_descripcion', e.target.value)}
                                            placeholder="Descripción del estacionamiento, características especiales..."
                                            className="min-h-20"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-tolerancia" className="text-gray-700 flex items-center gap-1">
                                                <Timer className="h-4 w-4" />
                                                Tolerancia (min)
                                            </Label>
                                            <Select
                                                value={String(editingConfig.est_tolerancia_min)}
                                                onValueChange={(value) => updateEditingConfig('est_tolerancia_min', Number(value))}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="5">5 minutos</SelectItem>
                                                    <SelectItem value="10">10 minutos</SelectItem>
                                                    <SelectItem value="15">15 minutos</SelectItem>
                                                    <SelectItem value="30">30 minutos</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-telefono" className="text-gray-700 flex items-center gap-1">
                                                <Phone className="h-4 w-4" />
                                                Teléfono
                                            </Label>
                                            <Input
                                                id="edit-telefono"
                                                value={editingConfig.est_telefono || ''}
                                                onChange={(e) => updateEditingConfig('est_telefono', e.target.value)}
                                                placeholder="Ej: +54 11 1234-5678"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-email" className="text-gray-700 flex items-center gap-1">
                                                <Mail className="h-4 w-4" />
                                                Email de Contacto
                                            </Label>
                                            <Input
                                                id="edit-email"
                                                type="email"
                                                value={editingConfig.est_email || ''}
                                                onChange={(e) => updateEditingConfig('est_email', e.target.value)}
                                                placeholder="contacto@miestacionamiento.com"
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            </TabsContent>

                            {/* TAB: Ubicación */}
                            <TabsContent value="ubicacion" className="space-y-4">
                                <Card className="border-2 shadow-sm">
                                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                                        <CardTitle className="text-gray-900 flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-blue-600" />
                                            Ubicación y Dirección
                                        </CardTitle>
                                        <p className="text-sm text-gray-600 mt-1">Dirección física y ubicación en el mapa</p>
                                    </CardHeader>
                                <CardContent className="space-y-4">
                                    {/* Búsqueda de Dirección con Autocompletado */}
                                    <div className="space-y-2 relative" data-search-container>
                                        <Label htmlFor="edit-address-search" className="text-gray-700">
                                            Buscar Dirección (Argentina)
                                        </Label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Input
                                                    id="edit-address-search"
                                                    value={configAddressSearch}
                                                    onChange={(e) => handleConfigAddressInputChange(e.target.value)}
                                                    onKeyDown={handleConfigAddressKeyDown}
                                                    placeholder="Ej: Av. Corrientes 1234, CABA"
                                                    className="pr-10"
                                                    autoComplete="off"
                                                />
                                                {loadingAutocomplete && (
                                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Lista desplegable de sugerencias de autocompletado */}
                                        {showAutocomplete && autocompleteSuggestions.length > 0 && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {autocompleteSuggestions.map((suggestion, index) => (
                                                    <div
                                                        key={suggestion.place_id}
                                                        onClick={() => selectAutocompleteSuggestion(suggestion)}
                                                        className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedSuggestionIndex
                                                            ? 'bg-blue-600 text-white'
                                                            : 'hover:bg-gray-100 text-gray-700'
                                                            }`}
                                                    >
                                                        <div className="font-medium">
                                                            {suggestion.structured_formatting?.main_text || suggestion.description}
                                                        </div>
                                                        {suggestion.structured_formatting?.secondary_text && (
                                                            <div className={`text-sm ${index === selectedSuggestionIndex
                                                                ? 'text-blue-100'
                                                                : 'text-gray-500'
                                                                }`}>
                                                                {suggestion.structured_formatting.secondary_text}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Campos de Dirección Manual */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="edit-provincia" className="text-gray-700">Provincia</Label>
                                            <Select value={editingConfig.est_prov} onValueChange={(value) => updateEditingConfig('est_prov', value)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar provincia" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {provinciaOptions.map((provincia) => (
                                                        <SelectItem key={provincia} value={provincia}>
                                                            {provincia}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-localidad" className="text-gray-700">Localidad/Ciudad</Label>
                                            <Input
                                                id="edit-localidad"
                                                value={editingConfig.est_locali}
                                                onChange={(e) => updateEditingConfig('est_locali', e.target.value)}
                                                placeholder="Ej: Capital Federal"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-direccion" className="text-gray-700">Dirección</Label>
                                            <Input
                                                id="edit-direccion"
                                                value={editingConfig.est_direc}
                                                onChange={(e) => updateEditingConfig('est_direc', e.target.value)}
                                                placeholder="Ej: Av. Corrientes 1234"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="edit-cp" className="text-gray-700">Código Postal</Label>
                                            <Input
                                                id="edit-cp"
                                                value={editingConfig.est_codigo_postal || ''}
                                                onChange={(e) => updateEditingConfig('est_codigo_postal', e.target.value)}
                                                placeholder="Ej: 1043"
                                            />
                                        </div>
                                    </div>

                                    {/* Mapa de Google */}
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Ubicación en el Mapa</Label>
                                        <GoogleMap
                                            latitude={editingConfig.est_latitud}
                                            longitude={editingConfig.est_longitud}
                                            address={editingConfig.est_direccion_completa || `${editingConfig.est_direc}, ${editingConfig.est_locali}, ${editingConfig.est_prov}`}
                                            markerTitle={editingConfig.est_nombre}
                                            className="h-64 w-full"
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                            </TabsContent>

                            {/* TAB: Horarios */}
                            <TabsContent value="horarios" className="space-y-4">
                                <HorariosEditor
                                    estId={editingConfig.est_id}
                                    horarios={editingHorarios}
                                    onChange={setEditingHorarios}
                                />
                            </TabsContent>
                        </Tabs>
                    ) : null}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowEditModal(false)}
                            disabled={savingConfig}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={saveEditingConfig}
                            disabled={savingConfig || !editingConfig}
                        >
                            {savingConfig ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Guardar Configuración
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}


