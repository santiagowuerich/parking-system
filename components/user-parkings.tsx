"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, Calendar } from "lucide-react";
import { Building2, MapPin, Clock, Users, Settings, Plus, CheckCircle, Phone, Mail, Timer, Save, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import AddressAutocomplete from "./address-autocomplete";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

    const [showEditModal, setShowEditModal] = useState(false);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false);
    const MAX_PARKINGS_PER_USER = 5;
    const [configTabsValue, setConfigTabsValue] = useState("general");

    const [editingConfig, setEditingConfig] = useState<EstacionamientoConfig | null>(null);
    const [editingHorarios, setEditingHorarios] = useState<HorarioFranja[]>([]);
    const [savingConfig, setSavingConfig] = useState(false);
    const [loadingConfig, setLoadingConfig] = useState(false);
    const [configAddressSearch, setConfigAddressSearch] = useState("");
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);

    // Evitar bucle de recarga cuando no hay estacionamientos
    // Solo intentamos cargar una vez al montar el componente
    const [requestedOnce, setRequestedOnce] = useState(false);
    const [estacionamientosEnriquecidos, setEstacionamientosEnriquecidos] = useState<Estacionamiento[]>([]);
    const [loadingHorarios, setLoadingHorarios] = useState(false);

    // Estados para eliminar estacionamiento
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingParking, setDeletingParking] = useState<{ id: number; nombre: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        // Solo cargar si no hay estacionamientos y no está cargando
        if (requestedOnce || loading || estacionamientos.length > 0) return;
        setRequestedOnce(true);
        fetchParkings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enriquecer estacionamientos con horarios, estado de apertura y datos de plazas
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
                        const horariosResponse = await fetch(`/api/estacionamiento/horarios?est_id=${est.est_id}`);
                        const horariosData = await horariosResponse.json();

                        const horarios = (horariosData.success && horariosData.horarios) ? horariosData.horarios : [];
                        const estadoApertura = isEstacionamientoAbierto(horarios);

                        // Consultar plazas para obtener datos reales
                        const plazasResponse = await fetch(`/api/plazas?est_id=${est.est_id}`);
                        const plazasData = await plazasResponse.json();

                        let plazas_totales_reales = 0;
                        let plazas_disponibles_reales = 0;
                        let plazas_ocupadas = 0;

                        if (plazasData.plazas && Array.isArray(plazasData.plazas)) {
                            plazas_totales_reales = plazasData.plazas.length;
                            plazas_disponibles_reales = plazasData.plazas.filter((p: any) => p.pla_estado === 'Libre').length;
                            plazas_ocupadas = plazasData.plazas.filter((p: any) => p.pla_estado === 'Ocupada' || p.pla_estado === 'Abonado').length;

                            // Debug: ver estados de las plazas
                            console.log(`📊 ${est.est_nombre} - Totales: ${plazas_totales_reales}, Disponibles: ${plazas_disponibles_reales}, Ocupadas: ${plazas_ocupadas}`);
                            const estadosConteo = plazasData.plazas.reduce((acc: any, p: any) => {
                                acc[p.pla_estado] = (acc[p.pla_estado] || 0) + 1;
                                return acc;
                            }, {});
                            console.log(`   Estados:`, estadosConteo);
                        }

                        return {
                            ...est,
                            horarios,
                            estadoApertura,
                            plazas_totales_reales,
                            plazas_disponibles_reales,
                            plazas_ocupadas
                        };
                    } catch (error) {
                        console.error(`Error cargando datos para ${est.est_nombre}:`, error);
                        return {
                            ...est,
                            horarios: [],
                            estadoApertura: { isOpen: false, hasSchedule: false },
                            plazas_totales_reales: 0,
                            plazas_disponibles_reales: 0,
                            plazas_ocupadas: 0
                        };
                    }
                })
            );

            setEstacionamientosEnriquecidos(enriquecidos);
            setLoadingHorarios(false);
        };

        enriquecerConHorarios();
    }, [estacionamientos]);
    const defaultConfigState = (): EstacionamientoConfig => ({
        est_id: 0,
        est_nombre: "",
        est_prov: "Por configurar",
        est_locali: "Por configurar",
        est_direc: "",
        est_direccion_completa: "",
        est_latitud: undefined,
        est_longitud: undefined,
        est_codigo_postal: "",
        est_telefono: "",
        est_email: "",
        est_descripcion: "",
        est_capacidad: 0,
        est_tolerancia_min: 15,
        est_publicado: true,
        est_requiere_llave: "no"
    });

    const resetCreateForm = () => {
        setEditingConfig(null);
        setEditingHorarios([]);
        setConfigAddressSearch("");
        setAutocompleteSuggestions([]);
        setShowAutocomplete(false);
        setSelectedSuggestionIndex(-1);
        setAddressConfirmed(false);
        setIsCreatingNew(false);
        setSavingConfig(false);
        setLoadingConfig(false);
        setLoadingAutocomplete(false);
        setConfigTabsValue("general");
    };

    const createNewParking = async () => {
        if (!editingConfig) {
            return;
        }

        const nombre = (editingConfig.est_nombre || "").trim();
        if (!nombre) {
            alert("El nombre del estacionamiento es requerido");
            return;
        }
        if (nombre.length < 2) {
            alert("El nombre debe tener al menos 2 caracteres");
            return;
        }

        const direccionIngresada = (configAddressSearch || editingConfig.est_direccion_completa || editingConfig.est_direc || "").trim();
        if (!direccionIngresada) {
            alert("La dirección del estacionamiento es requerida y debe ser única");
            return;
        }
        if (direccionIngresada.length < 5) {
            alert("La dirección debe tener al menos 5 caracteres");
            return;
        }

        if (estacionamientos.length >= MAX_PARKINGS_PER_USER) {
            alert(`Has alcanzado el límite máximo de estacionamientos (${MAX_PARKINGS_PER_USER})`);
            return;
        }

        const existingParking = estacionamientos.find(
            (est) => est.est_nombre.toLowerCase() === nombre.toLowerCase()
        );
        if (existingParking) {
            alert(`Ya tienes un estacionamiento con el nombre "${nombre}"`);
            return;
        }

        setSavingConfig(true);
        try {
            let enrichedConfig = editingConfig;

            if (!addressConfirmed || !editingConfig.est_latitud || !editingConfig.est_longitud) {
                try {
                    const resp = await fetch('/api/geocoding/search', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ address: direccionIngresada, region: 'ar' })
                    });
                    const data = await resp.json();

                    if (resp.ok && data.success && Array.isArray(data.results) && data.results.length > 0) {
                        const suggestion = data.results[0];
                        enrichedConfig = {
                            ...enrichedConfig,
                            est_direccion_completa: suggestion.formatted_address,
                            est_direc: suggestion.components.street_name
                                ? `${suggestion.components.street_name} ${suggestion.components.street_number}`.trim()
                                : direccionIngresada,
                            est_locali: suggestion.components.locality || suggestion.components.city || enrichedConfig.est_locali,
                            est_prov: suggestion.components.state || enrichedConfig.est_prov,
                            est_codigo_postal: suggestion.components.postal_code || enrichedConfig.est_codigo_postal,
                            est_latitud: suggestion.latitud ?? enrichedConfig.est_latitud,
                            est_longitud: suggestion.longitud ?? enrichedConfig.est_longitud
                        };
                        setConfigAddressSearch(suggestion.formatted_address);
                        setAddressConfirmed(true);
                    } else {
                        alert("Seleccioná una dirección de la lista para continuar.");
                        setSavingConfig(false);
                        return;
                    }
                } catch (error) {
                    console.error("Error validando dirección:", error);
                    alert("No se pudo validar la dirección. Seleccioná una de la lista.");
                    setSavingConfig(false);
                    return;
                }
            }

            setEditingConfig(enrichedConfig);

            const payloadDireccion = enrichedConfig.est_direccion_completa || direccionIngresada;

            console.log('🚀 Intentando crear estacionamiento con endpoint principal...');
            let response = await fetch('/api/auth/create-new-parking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: nombre,
                    email: usuario?.email || authUser?.email,
                    direccion: payloadDireccion,
                    est_prov: enrichedConfig.est_prov,
                    est_locali: enrichedConfig.est_locali,
                    est_codigo_postal: enrichedConfig.est_codigo_postal,
                    est_latitud: enrichedConfig.est_latitud,
                    est_longitud: enrichedConfig.est_longitud,
                    est_direccion_completa: payloadDireccion
                }),
            });

            if (!response.ok) {
                console.log('⚠️ Endpoint principal falló, intentando con fallback...');
                response = await fetch('/api/auth/create-new-parking-fallback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: nombre,
                        email: usuario?.email || authUser?.email,
                        direccion: payloadDireccion,
                        est_prov: enrichedConfig.est_prov,
                        est_locali: enrichedConfig.est_locali,
                        est_codigo_postal: enrichedConfig.est_codigo_postal,
                        est_latitud: enrichedConfig.est_latitud,
                        est_longitud: enrichedConfig.est_longitud,
                        est_direccion_completa: payloadDireccion
                    }),
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                console.error('❌ Error creando estacionamiento:', errorData);
                const errorMessage = errorData.details
                    ? `${errorData.error}: ${errorData.details}`
                    : errorData.error || "Error creando estacionamiento";
                alert(errorMessage);
                setSavingConfig(false);
                return;
            }

            const data = await response.json();
            console.log('✅ Nuevo estacionamiento creado:', data);

            if (!data.estacionamiento_id) {
                alert("Estacionamiento creado pero no se recibió el ID. Revisa la lista para verificarlo.");
                await fetchParkings();
                setShowEditModal(false);
                resetCreateForm();
                return;
            }

            const newEstId = data.estacionamiento_id;
            const finalConfig: EstacionamientoConfig = {
                ...enrichedConfig,
                est_id: newEstId,
                est_direccion_completa: payloadDireccion,
                est_direc: enrichedConfig.est_direc || payloadDireccion
            };

            // Guardar configuración adicional
            const configResponse = await fetch('/api/estacionamiento/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalConfig)
            });
            const configData = await configResponse.json();

            if (!configResponse.ok || !configData.success) {
                console.error("Error guardando configuración tras crear:", configData);
                toast({
                    variant: "destructive",
                    title: "Advertencia",
                    description: "El estacionamiento se creó pero no se pudieron guardar todos los datos adicionales."
                });
            } else {
                // Guardar horarios si existen
                if (editingHorarios.length > 0) {
                    const horariosResponse = await fetch('/api/estacionamiento/horarios', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            est_id: newEstId,
                            horarios: editingHorarios
                        })
                    });

                    const horariosData = await horariosResponse.json();
                    if (!horariosResponse.ok || !horariosData.success) {
                        toast({
                            variant: "destructive",
                            title: "Advertencia",
                            description: "El estacionamiento se creó pero hubo un problema guardando los horarios."
                        });
                    }
                }

                toast({
                    title: "Estacionamiento creado",
                    description: "Se guardó la configuración inicial del nuevo estacionamiento."
                });
            }

            await fetchParkings();
            setShowEditModal(false);
            resetCreateForm();

            if (onSelectParking) {
                onSelectParking(newEstId);
            }
        } catch (err) {
            console.error("Error creando estacionamiento:", err);
            alert("Error de conexión - intenta nuevamente");
        } finally {
            setSavingConfig(false);
        }
    };

    const openCreateParkingModal = () => {
        setIsCreatingNew(true);
        const initialConfig = defaultConfigState();
        setEditingConfig(initialConfig);
        setEditingHorarios([]);
        setConfigAddressSearch("");
        setAutocompleteSuggestions([]);
        setShowAutocomplete(false);
        setSelectedSuggestionIndex(-1);
        setAddressConfirmed(false);
        setLoadingConfig(false);
        setSavingConfig(false);
        setConfigTabsValue("general");
        setShowEditModal(true);
    };

    const handleConfigModalOpenChange = (open: boolean) => {
        if (!open) {
            setShowEditModal(false);
            resetCreateForm();
        } else {
            setShowEditModal(true);
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
        setIsCreatingNew(false);
        setAddressConfirmed(true);
        setConfigTabsValue("general");
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
                resetCreateForm();
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
            resetCreateForm();
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
            resetCreateForm();

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

    // Función para eliminar estacionamiento
    const handleDeleteEstacionamiento = async () => {
        if (!deletingParking) return;

        setIsDeleting(true);

        try {
            const response = await fetch(`/api/estacionamiento/delete?est_id=${deletingParking.id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                toast({
                    variant: "destructive",
                    title: "Error al eliminar",
                    description: data.error || "No se pudo eliminar el estacionamiento"
                });
                return;
            }

            toast({
                title: "Estacionamiento eliminado",
                description: `El estacionamiento "${deletingParking.nombre}" y sus datos asociados han sido eliminados correctamente`
            });

            // Cerrar el modal y resetear estado
            setShowDeleteModal(false);
            setDeletingParking(null);

            // Recargar la lista de estacionamientos
            await fetchParkings();

        } catch (error) {
            console.error("Error eliminando estacionamiento:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error inesperado al eliminar el estacionamiento"
            });
        } finally {
            setIsDeleting(false);
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
            setAddressConfirmed(true);

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
        setAddressConfirmed(false);
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
            
            <Card className="bg-white/50 border-gray-200">
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                onClick={() => {
                                    if (estacionamientos.length < MAX_PARKINGS_PER_USER) {
                                        openCreateParkingModal();
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                                size="sm"
                                disabled={estacionamientos.length >= MAX_PARKINGS_PER_USER}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Nuevo Estacionamiento
                            </Button>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Lista de Estacionamientos ({estacionamientos.length}/{MAX_PARKINGS_PER_USER})
                            </CardTitle>
                        </div>
                        {estacionamientos.length >= MAX_PARKINGS_PER_USER && (
                            <div className="flex items-center gap-1 text-blue-600 text-sm">
                                <span>⚠️ Límite alcanzado</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
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
                                            <CardHeader className="px-5 py-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-100">
                                                <div className="space-y-2.5">
                                                    {/* Título y badges */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1">
                                                            <CardTitle className="text-xl font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
                                                                {estacionamiento.est_nombre}
                                                            </CardTitle>
                                                            {estacionamiento.est_descripcion && (
                                                                <p className="text-xs text-gray-600 line-clamp-2">
                                                                    {estacionamiento.est_descripcion}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                            {currentEstId === estacionamiento.est_id && (
                                                                <Badge className="border-blue-200 bg-blue-50 text-blue-700 font-semibold">
                                                                    ACTIVO
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
                                                                                ABIERTO
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge className="bg-red-100 text-red-800 border-red-300">
                                                                                CERRADO
                                                                            </Badge>
                                                                        )
                                                                    ) : (
                                                                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                                                            SIN HORARIOS
                                                                        </Badge>
                                                                    )
                                                                )}
                                                        </div>
                                                    </div>

                                                </div>
                                            </CardHeader>
                                            <CardContent className="px-5 py-4 space-y-4">
                                                {/* Dirección */}
                                                <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">
                                                    <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                                    <span className="text-sm font-medium leading-snug">{estacionamiento.est_direc}, {estacionamiento.est_locali}, {estacionamiento.est_prov}</span>
                                                </div>

                                                {/* Grid de estadísticas - MEJORADO */}
                                                <div className="grid grid-cols-2 gap-3">
                                                    {/* Card de Plazas Totales */}
                                                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-xl border border-green-200">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 bg-green-500 rounded-lg">
                                                                <Building2 className="h-4 w-4 text-white" />
                                                            </div>
                                                            <div>
                                                                <div className="text-xl font-semibold text-green-700 leading-none">
                                                                    {estacionamiento.plazas_totales_reales || 0}
                                                                </div>
                                                                <div className="text-xs text-green-600 font-medium leading-tight">Plazas totales</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Card de Disponibles */}
                                                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 rounded-xl border border-blue-200">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 bg-blue-500 rounded-lg">
                                                                <Users className="h-4 w-4 text-white" />
                                                            </div>
                                                            <div>
                                                                <div className="text-xl font-semibold text-blue-700 leading-none">
                                                                    {estacionamiento.plazas_disponibles_reales || 0}
                                                                </div>
                                                                <div className="text-xs text-blue-600 font-medium leading-tight">Disponibles</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Barra de ocupación */}
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600 font-medium">Ocupación</span>
                                                        <span className={`font-bold ${porcentajeOcupacion > 80 ? 'text-red-600' : porcentajeOcupacion > 50 ? 'text-amber-600' : 'text-green-600'}`}>
                                                            {porcentajeOcupacion}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
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
                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                    <div className="flex items-center gap-2 text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                                                        <Timer className="h-4 w-4 text-gray-500" />
                                                        <span><strong>{estacionamiento.est_tolerancia_min}</strong> min tolerancia</span>
                                                    </div>
                                                    {estacionamiento.est_requiere_llave && estacionamiento.est_requiere_llave !== 'no' && (
                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
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
                                                    <div className="bg-gray-50 px-3 py-2 rounded-lg space-y-1">
                                                        <div className="text-xs text-gray-500 font-semibold mb-1.5">CONTACTO</div>
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
                                                {/* Botones de acción - MEJORADOS */}
                                                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-gray-100">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openEditConfigModal(estacionamiento.est_id);
                                                        }}
                                                        className="h-10 hover:bg-blue-50 hover:border-blue-300"
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
                                                        className="h-10 hover:bg-purple-50 hover:border-purple-300"
                                                    >
                                                        <Calendar className="h-4 w-4 mr-1" />
                                                        Horarios
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeletingParking({
                                                                id: estacionamiento.est_id,
                                                                nombre: estacionamiento.est_nombre
                                                            });
                                                            setShowDeleteModal(true);
                                                        }}
                                                        className="h-10 hover:bg-red-50 hover:border-red-300 text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-1" />
                                                        Eliminar
                                                    </Button>
                                                    <Button
                                                        variant={currentEstId === estacionamiento.est_id ? "secondary" : "default"}
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onSelectParking?.(estacionamiento.est_id);
                                                        }}
                                                        disabled={currentEstId === estacionamiento.est_id}
                                                        className={`h-10 ${currentEstId === estacionamiento.est_id ? '' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
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

            {/* Tab Configuración */}

            {/* Modal de Edición de Configuración - MEJORADO */}
            <Dialog open={showEditModal} onOpenChange={handleConfigModalOpenChange}>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto p-0">
                    <DialogHeader className="border-b px-6 py-4">
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-xl font-semibold flex items-center gap-3">
                                    <div className={`p-1.5 rounded-lg ${isCreatingNew ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                                        {isCreatingNew ? (
                                            <Plus className="h-5 w-5 text-white" />
                                        ) : (
                                            <Settings className="h-5 w-5 text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <div>{isCreatingNew ? "Crear nuevo estacionamiento" : "Configuración del Estacionamiento"}</div>
                                        {editingConfig && (
                                            <div className="text-xs font-medium text-gray-500 mt-0.5">
                                                {isCreatingNew
                                                    ? (editingConfig.est_nombre?.trim()
                                                        ? `Nombre provisional: ${editingConfig.est_nombre}`
                                                        : "Completa los datos antes de guardar")
                                                    : editingConfig.est_nombre}
                                            </div>
                                        )}
                                    </div>
                                </DialogTitle>
                            </div>

                            {/* Controles de Estado - MEJORADOS */}
                            {editingConfig && (
                                <div className="flex items-center gap-3 pt-1.5">
                                    {/* Toggle de Publicación */}
                                    <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2.5 rounded-xl border border-blue-200 flex-1">
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

                                    {!isCreatingNew && (
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
                                    )}
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
                        <Tabs value={configTabsValue} onValueChange={setConfigTabsValue} className="w-full py-4">
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
                            onClick={() => handleConfigModalOpenChange(false)}
                            disabled={savingConfig}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={isCreatingNew ? createNewParking : saveEditingConfig}
                            disabled={savingConfig || !editingConfig}
                            className={isCreatingNew ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600" : undefined}
                        >
                            {savingConfig ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    {isCreatingNew ? "Creando..." : "Guardando..."}
                                </>
                            ) : (
                                <>
                                    {isCreatingNew ? <Plus className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {isCreatingNew ? "Crear Estacionamiento" : "Guardar Configuración"}
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación para eliminar estacionamiento */}
            <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 className="h-5 w-5" />
                            ¿Eliminar estacionamiento?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-700">
                            {deletingParking && (
                                <div className="space-y-4">
                                    <p>
                                        ¿Está seguro que quiere eliminar el estacionamiento{" "}
                                        <strong className="text-gray-900">"{deletingParking.nombre}"</strong> y sus datos asociados?
                                    </p>
                                    <div>
                                        <p className="font-medium mb-2">Esta acción eliminará:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Todas las plazas del estacionamiento</li>
                                            <li>Todas las tarifas configuradas</li>
                                            <li>Todos los horarios de atención</li>
                                            <li>Métodos de pago asociados</li>
                                            <li>Historial de vehículos</li>
                                        </ul>
                                    </div>
                                    <p className="font-bold text-red-600">
                                        Esta acción no se puede deshacer.
                                    </p>
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleDeleteEstacionamiento();
                            }}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Eliminando...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Eliminar estacionamiento
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
