"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Search, Save, Loader2, Phone, Mail, Building2, Clock, Timer } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import GoogleMap from "./google-map";

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
    est_horario_funcionamiento: number;
    est_tolerancia_min: number;
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

export default function ParkingConfig() {
    const { estId } = useAuth();
    const { toast } = useToast();

    const [config, setConfig] = useState<EstacionamientoConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [addressSearch, setAddressSearch] = useState("");
    const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
    const [searchingAddress, setSearchingAddress] = useState(false);

    // Estados para autocompletado
    const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<any[]>([]);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);

    // Cargar configuración actual
    useEffect(() => {
        if (estId) {
            fetchConfig();
        }
    }, [estId]);

    // useEffect para manejar clics fuera del componente
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Element;
            const searchContainer = target.closest('[data-search-container]');
            if (!searchContainer) {
                setShowAutocomplete(false);
                setSelectedSuggestionIndex(-1);
            }
        };

        if (showAutocomplete) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showAutocomplete]);

    const fetchConfig = async () => {
        if (!estId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/estacionamiento/config?est_id=${estId}`);
            const data = await response.json();

            if (response.ok && data.success) {
                setConfig(data.estacionamiento);
                if (data.estacionamiento.est_direccion_completa) {
                    setAddressSearch(data.estacionamiento.est_direccion_completa);
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: data.error || "Error cargando configuración"
                });
            }
        } catch (error) {
            console.error("Error cargando configuración:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar la configuración"
            });
        } finally {
            setLoading(false);
        }
    };

    // Función para obtener sugerencias de autocompletado
    const getAutocompleteSuggestions = async (input: string) => {
        if (!input.trim() || input.length < 2) {
            setAutocompleteSuggestions([]);
            setShowAutocomplete(false);
            return;
        }

        setLoadingAutocomplete(true);
        try {
            // Verificar que Google Maps esté cargado
            if (!window.google || !window.google.maps || !window.google.maps.places) {
                console.warn('Google Places API no disponible');
                return;
            }

            const service = new window.google.maps.places.AutocompleteService();

            const request = {
                input: input,
                componentRestrictions: { country: 'ar' }, // Bias hacia Argentina
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

    // Función para obtener detalles de una dirección seleccionada
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
                    // Extraer componentes de la dirección
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

    // Función para seleccionar una sugerencia
    const selectAutocompleteSuggestion = async (suggestion: any) => {
        if (!config) return;

        try {
            setLoadingAutocomplete(true);
            const placeDetails = await getPlaceDetails(suggestion.place_id);

            setConfig({
                ...config,
                est_direccion_completa: placeDetails.formatted_address,
                est_direc: `${placeDetails.components.street_name} ${placeDetails.components.street_number}`.trim(),
                est_locali: placeDetails.components.locality || placeDetails.components.city,
                est_prov: placeDetails.components.state,
                est_codigo_postal: placeDetails.components.postal_code,
                est_latitud: placeDetails.latitud,
                est_longitud: placeDetails.longitud
            });

            setAddressSearch(placeDetails.formatted_address);
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

    // Función para manejar cambios en el input de dirección
    const handleAddressInputChange = (value: string) => {
        setAddressSearch(value);
        getAutocompleteSuggestions(value);
    };

    // Función para manejar navegación por teclado
    const handleAddressKeyDown = (e: React.KeyboardEvent) => {
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
                } else {
                    // Si no hay sugerencia seleccionada, buscar manualmente
                    searchAddresses();
                }
                break;
            case 'Escape':
                setShowAutocomplete(false);
                setSelectedSuggestionIndex(-1);
                break;
        }
    };

    const searchAddresses = async () => {
        if (!addressSearch.trim() || addressSearch.length < 3) return;

        // Limpiar sugerencias de autocompletado
        setShowAutocomplete(false);
        setAutocompleteSuggestions([]);
        setSelectedSuggestionIndex(-1);

        setSearchingAddress(true);
        try {
            const response = await fetch('/api/geocoding/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: addressSearch, region: 'ar' })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setAddressSuggestions(data.results || []);
                if (data.results.length === 0) {
                    toast({
                        title: "Sin resultados",
                        description: "No se encontraron direcciones para tu búsqueda"
                    });
                }
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: data.error || "Error buscando direcciones"
                });
            }
        } catch (error) {
            console.error("Error buscando direcciones:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error en búsqueda de direcciones"
            });
        } finally {
            setSearchingAddress(false);
        }
    };

    const selectAddress = (suggestion: AddressSuggestion) => {
        if (!config) return;

        setConfig({
            ...config,
            est_direccion_completa: suggestion.formatted_address,
            est_direc: `${suggestion.components.street_name} ${suggestion.components.street_number}`.trim(),
            est_locali: suggestion.components.locality || suggestion.components.city,
            est_prov: suggestion.components.state,
            est_codigo_postal: suggestion.components.postal_code,
            est_latitud: suggestion.latitud,
            est_longitud: suggestion.longitud
        });

        setAddressSearch(suggestion.formatted_address);
        setAddressSuggestions([]); // Limpiar sugerencias

        toast({
            title: "Dirección seleccionada",
            description: "Datos actualizados. No olvides guardar los cambios."
        });
    };

    const saveConfig = async () => {
        if (!config || !estId) return;

        setSaving(true);
        try {
            const response = await fetch('/api/estacionamiento/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                toast({
                    title: "¡Configuración guardada!",
                    description: "Los datos de tu estacionamiento han sido actualizados"
                });

                // Actualizar configuración con la respuesta
                setConfig(data.estacionamiento);
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: data.error || "Error guardando configuración"
                });
            }
        } catch (error) {
            console.error("Error guardando configuración:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al guardar la configuración"
            });
        } finally {
            setSaving(false);
        }
    };

    const updateConfig = (field: keyof EstacionamientoConfig, value: any) => {
        if (!config) return;
        setConfig({ ...config, [field]: value });
    };

    const provinciaOptions = [
        "Buenos Aires", "CABA", "Córdoba", "Santa Fe", "Mendoza",
        "Tucumán", "Entre Ríos", "Salta", "Misiones", "Corrientes",
        "Santiago del Estero", "San Juan", "Jujuy", "Río Negro",
        "Neuquén", "Formosa", "Chubut", "San Luis", "Catamarca",
        "La Rioja", "La Pampa", "Santa Cruz", "Chaco", "Tierra del Fuego"
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                    <p className="text-gray-500">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="text-center py-8">
                <Building2 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">
                    Error cargando configuración
                </h3>
                <Button onClick={fetchConfig} variant="outline">
                    Reintentar
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Configuración del Estacionamiento
                    </h2>
                    <p className="text-gray-500">
                        ID: {config.est_id} • Configura los datos específicos de tu estacionamiento
                    </p>
                </div>
                <Badge variant="outline">
                    {config.est_capacidad} plazas totales
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Información Básica */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-gray-900 flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Información Básica
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre" className="text-gray-700">Nombre del Estacionamiento</Label>
                            <Input
                                id="nombre"
                                value={config.est_nombre}
                                onChange={(e) => updateConfig('est_nombre', e.target.value)}
                                placeholder="Ej: Estacionamiento Centro"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="descripcion" className="text-gray-700">Descripción</Label>
                            <Textarea
                                id="descripcion"
                                value={config.est_descripcion || ''}
                                onChange={(e) => updateConfig('est_descripcion', e.target.value)}
                                placeholder="Descripción del estacionamiento, características especiales..."
                                className="min-h-20"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="horario" className="text-gray-700 flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    Horario (horas)
                                </Label>
                                <Select value={String(config.est_horario_funcionamiento)} onValueChange={(value) => updateConfig('est_horario_funcionamiento', Number(value))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="8">8 horas</SelectItem>
                                        <SelectItem value="12">12 horas</SelectItem>
                                        <SelectItem value="16">16 horas</SelectItem>
                                        <SelectItem value="24">24 horas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tolerancia" className="text-gray-700 flex items-center gap-1">
                                    <Timer className="h-4 w-4" />
                                    Tolerancia (min)
                                </Label>
                                <Select value={String(config.est_tolerancia_min)} onValueChange={(value) => updateConfig('est_tolerancia_min', Number(value))}>
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
                        </div>
                    </CardContent>
                </Card>

                {/* Contacto */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-gray-900 flex items-center gap-2">
                            <Phone className="h-5 w-5" />
                            Información de Contacto
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="telefono" className="text-gray-700">Teléfono</Label>
                            <Input
                                id="telefono"
                                value={config.est_telefono || ''}
                                onChange={(e) => updateConfig('est_telefono', e.target.value)}
                                placeholder="Ej: +54 11 1234-5678"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-gray-700 flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                Email de Contacto
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={config.est_email || ''}
                                onChange={(e) => updateConfig('est_email', e.target.value)}
                                placeholder="contacto@miestacionamiento.com"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Ubicación y Google Maps */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-gray-900 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Ubicación y Dirección
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Búsqueda de Dirección con Autocompletado */}
                    <div className="space-y-2 relative" data-search-container>
                        <Label htmlFor="address-search" className="text-gray-700">
                            Buscar Dirección (Argentina)
                        </Label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Input
                                    id="address-search"
                                    value={addressSearch}
                                    onChange={(e) => handleAddressInputChange(e.target.value)}
                                    onKeyDown={handleAddressKeyDown}
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
                            <Button
                                onClick={searchAddresses}
                                disabled={searchingAddress || !addressSearch.trim()}
                                className="min-w-[100px]"
                            >
                                {searchingAddress ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Search className="h-4 w-4 mr-2" />
                                        Buscar
                                    </>
                                )}
                            </Button>
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

                        {/* Mensaje cuando no hay sugerencias pero hay búsqueda */}
                        {showAutocomplete && autocompleteSuggestions.length === 0 && addressSearch.length >= 2 && !loadingAutocomplete && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-4 text-center text-gray-500">
                                <MapPin className="h-5 w-5 mx-auto mb-2 opacity-50" />
                                No se encontraron direcciones
                            </div>
                        )}
                    </div>

                    {/* Sugerencias de Direcciones */}
                    {addressSuggestions.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-gray-700">Selecciona una dirección:</Label>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {addressSuggestions.map((suggestion, index) => (
                                    <div
                                        key={suggestion.place_id}
                                        onClick={() => selectAddress(suggestion)}
                                        className="p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded cursor-pointer transition-colors"
                                    >
                                        <div className="font-medium text-gray-900">
                                            {suggestion.formatted_address}
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                            {suggestion.components.locality}, {suggestion.components.state}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Campos de Dirección Manual */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="provincia" className="text-gray-700">Provincia</Label>
                            <Select value={config.est_prov} onValueChange={(value) => updateConfig('est_prov', value)}>
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
                            <Label htmlFor="localidad" className="text-gray-700">Localidad/Ciudad</Label>
                            <Input
                                id="localidad"
                                value={config.est_locali}
                                onChange={(e) => updateConfig('est_locali', e.target.value)}
                                placeholder="Ej: Capital Federal"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="direccion" className="text-gray-700">Dirección</Label>
                            <Input
                                id="direccion"
                                value={config.est_direc}
                                onChange={(e) => updateConfig('est_direc', e.target.value)}
                                placeholder="Ej: Av. Corrientes 1234"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cp" className="text-gray-700">Código Postal</Label>
                            <Input
                                id="cp"
                                value={config.est_codigo_postal || ''}
                                onChange={(e) => updateConfig('est_codigo_postal', e.target.value)}
                                placeholder="Ej: 1043"
                            />
                        </div>
                    </div>

                    {/* Coordenadas OCULTAS - No se muestran al usuario */}
                    {/* Los valores de latitud y longitud se mantienen internamente pero no se muestran */}

                    {/* Mapa de Google */}
                    <div className="space-y-2">
                        <Label className="text-gray-700">Ubicación en el Mapa</Label>
                        <GoogleMap
                            latitude={config.est_latitud}
                            longitude={config.est_longitud}
                            address={config.est_direccion_completa || `${config.est_direc}, ${config.est_locali}, ${config.est_prov}`}
                            markerTitle={config.est_nombre}
                            className="h-64 w-full"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Botón Guardar */}
            <div className="flex justify-end">
                <Button
                    onClick={saveConfig}
                    disabled={saving}
                    className="min-w-[120px]"
                    size="lg"
                >
                    {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Save className="h-4 w-4 mr-2" />
                    )}
                    {saving ? 'Guardando...' : 'Guardar Configuración'}
                </Button>
            </div>
        </div>
    );
}
