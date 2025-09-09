"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddressAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (place: google.maps.places.PlaceResult) => void;
    placeholder?: string;
    className?: string;
    label?: string;
    error?: string;
    disabled?: boolean;
}

declare global {
    interface Window {
        google: any;
    }
}

export default function AddressAutocomplete({
    value,
    onChange,
    onSelect,
    placeholder = "Ej: Av. Libertador 1234, Buenos Aires",
    className,
    label = "Dirección del Estacionamiento",
    error,
    disabled = false
}: AddressAutocompleteProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

    useEffect(() => {
        const loadGooglePlaces = () => {
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

            if (!apiKey || apiKey === 'TU_API_KEY_AQUI' || apiKey === 'TU_API_KEY_REAL') {
                console.warn('⚠️ Google Places API key no configurada');
                return;
            }

            // Verificar si Google Maps ya está cargado
            if (window.google && window.google.maps && window.google.maps.places) {
                initializeAutocomplete();
                return;
            }

            // Verificar si ya hay un script cargándose
            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                const checkLoaded = () => {
                    if (window.google && window.google.maps && window.google.maps.places) {
                        initializeAutocomplete();
                    } else {
                        setTimeout(checkLoaded, 200);
                    }
                };
                checkLoaded();
                return;
            }

            // Cargar el script de Google Maps con Places
            setIsLoading(true);
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                setIsLoading(false);
                setIsGoogleLoaded(true);
                initializeAutocomplete();
            };

            script.onerror = () => {
                setIsLoading(false);
                console.error('❌ Error cargando Google Places API');
            };

            document.head.appendChild(script);
        };

        const initializeAutocomplete = () => {
            if (!inputRef.current || !window.google || !window.google.maps || !window.google.maps.places) {
                console.warn('⚠️ No se puede inicializar Places Autocomplete');
                return;
            }

            try {
                // Crear instancia de Autocomplete
                autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                    types: ['address'], // Solo direcciones
                    componentRestrictions: { country: 'ar' }, // Restringir a Argentina
                    fields: ['formatted_address', 'geometry', 'place_id', 'address_components']
                });

                // Listener para cuando se selecciona una dirección
                autocompleteRef.current.addListener('place_changed', () => {
                    const place = autocompleteRef.current?.getPlace();

                    if (place && place.formatted_address) {
                        console.log('📍 Dirección seleccionada:', place.formatted_address);
                        onChange(place.formatted_address);

                        // Llamar al callback opcional con los detalles del lugar
                        if (onSelect) {
                            onSelect(place);
                        }
                    }
                });

                console.log('✅ Google Places Autocomplete inicializado');
            } catch (error) {
                console.error('❌ Error inicializando Places Autocomplete:', error);
            }
        };

        loadGooglePlaces();

        // Cleanup
        return () => {
            if (autocompleteRef.current) {
                // Limpiar listeners de Google Places
                window.google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
            }
        };
    }, [onChange, onSelect]);

    // Verificar configuración de API key
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const hasValidApiKey = apiKey && apiKey !== 'TU_API_KEY_AQUI' && apiKey !== 'TU_API_KEY_REAL';

    if (!hasValidApiKey) {
        return (
            <div className="space-y-2">
                {label && <Label htmlFor="address-input">{label} *</Label>}
                <div className="relative">
                    <Input
                        id="address-input"
                        type="text"
                        placeholder={placeholder}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={cn(
                            "pl-10 bg-gray-100 border-gray-200 text-gray-900",
                            error && "border-red-500",
                            className
                        )}
                        disabled={disabled}
                    />
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>API de Google Places no configurada. Usa entrada manual.</span>
                </div>
                {error && (
                    <p className="text-sm text-red-600">{error}</p>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {label && <Label htmlFor="address-input">{label} *</Label>}
            <div className="relative">
                <Input
                    ref={inputRef}
                    id="address-input"
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "pl-10 bg-gray-100 border-gray-200 text-gray-900",
                        error && "border-red-500",
                        className
                    )}
                    disabled={disabled || isLoading}
                />
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                {isLoading && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>Escribe la dirección y selecciona de la lista desplegable</span>
            </div>
            {error && (
                <p className="text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
