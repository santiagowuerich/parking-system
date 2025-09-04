"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GoogleMapProps {
    latitude?: number;
    longitude?: number;
    address?: string;
    markerTitle?: string;
    className?: string;
}

declare global {
    interface Window {
        google: any;
        initGoogleMap: () => void;
    }
}

export default function GoogleMap({
    latitude,
    longitude,
    address,
    markerTitle = "Estacionamiento",
    className = "h-64 w-full"
}: GoogleMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;

    useEffect(() => {
        const loadGoogleMaps = () => {
            console.log('🔍 Iniciando carga de Google Maps...');

            // Verificar API key
            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
            if (!apiKey || apiKey === 'TU_API_KEY_AQUI' || apiKey === 'TU_API_KEY_REAL') {
                console.error('❌ API key de Google Maps no configurada o es placeholder');
                setError('API key de Google Maps no configurada. Ve a /google-maps-setup para configurarla.');
                return;
            }

            console.log('✅ API key encontrada:', apiKey.substring(0, 10) + '...');

            // Verificar si la API ya está completamente cargada
            if (window.google && window.google.maps && window.google.maps.Map) {
                console.log('✅ Google Maps ya cargado completamente, inicializando mapa...');
                // Usar setTimeout para asegurar que el DOM esté listo
                setTimeout(() => initializeMap(), 100);
                return;
            }

            // Verificar si ya está cargando
            if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                console.log('⏳ Script de Google Maps ya existe, esperando carga...');
                const checkLoaded = () => {
                    if (window.google && window.google.maps && window.google.maps.Map) {
                        console.log('✅ Google Maps cargado completamente desde script existente');
                        initializeMap();
                    } else {
                        // Timeout más largo para esperar carga completa
                        setTimeout(checkLoaded, 200);
                    }
                };
                checkLoaded();
                return;
            }

            // Cargar script de Google Maps con configuración optimizada
            console.log('📡 Cargando script de Google Maps...');
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=initGoogleMap`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                console.log('📦 Script de Google Maps cargado');
                // Esperar un poco más para asegurar que la API esté completamente inicializada
                setTimeout(() => {
                    if (window.google && window.google.maps && window.google.maps.Map) {
                        console.log('✅ Google Maps API completamente disponible');
                        initializeMap();
                    } else {
                        console.error('❌ Google Maps API no disponible después de timeout');
                        setError('Error: Google Maps no se cargó correctamente. Intenta recargar la página.');
                    }
                }, 500);
            };

            script.onerror = (error) => {
                console.error('❌ Error cargando script de Google Maps:', error);
                setError(`Error cargando Google Maps API. Verifica tu API key.`);
            };

            document.head.appendChild(script);
        };

        const initializeMap = () => {
            // Verificar que el contenedor esté disponible
            if (!mapRef.current) {
                console.error('❌ Referencia al contenedor del mapa no encontrada');
                // Reintentar después de un breve delay
                setTimeout(() => {
                    if (mapRef.current) {
                        initializeMap();
                    } else {
                        setError('Contenedor del mapa no disponible. Intenta recargar la página.');
                    }
                }, 200);
                return;
            }

            // Verificar que Google Maps esté completamente cargado
            if (!window.google || !window.google.maps || !window.google.maps.Map) {
                console.error('❌ Google Maps API no está completamente cargada');
                setError('Google Maps no está completamente cargado. Esperando...');
                setTimeout(() => initializeMap(), 300);
                return;
            }

            try {
                console.log('🗺️ Inicializando mapa con coordenadas:', { latitude, longitude });

                // Coordenadas por defecto (Buenos Aires)
                const defaultCenter = { lat: -34.6037, lng: -58.3816 };

                // Usar las coordenadas proporcionadas o las por defecto
                const center = latitude && longitude
                    ? { lat: latitude, lng: longitude }
                    : defaultCenter;

                console.log('📍 Centro del mapa:', center);

                // Crear el mapa con opciones más robustas
                const mapOptions = {
                    zoom: latitude && longitude ? 16 : 12,
                    center: center,
                    mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                    styles: [
                        {
                            "featureType": "all",
                            "elementType": "geometry.fill",
                            "stylers": [{ "color": "#1f2937" }]
                        },
                        {
                            "featureType": "all",
                            "elementType": "labels.text.fill",
                            "stylers": [{ "color": "#ffffff" }]
                        },
                        {
                            "featureType": "road",
                            "elementType": "geometry",
                            "stylers": [{ "color": "#374151" }]
                        }
                    ],
                    // Opciones adicionales para mejor estabilidad
                    disableDefaultUI: false,
                    zoomControl: true,
                    mapTypeControl: false,
                    scaleControl: true,
                    streetViewControl: false,
                    rotateControl: false,
                    fullscreenControl: true
                };

                const map = new window.google.maps.Map(mapRef.current, mapOptions);

                console.log('✅ Mapa creado exitosamente');

                // Agregar marcador si hay coordenadas
                if (latitude && longitude) {
                    console.log('📍 Agregando marcador en:', { lat: latitude, lng: longitude });

                    const markerOptions = {
                        position: { lat: latitude, lng: longitude },
                        map: map,
                        title: markerTitle,
                        icon: {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#3b82f6',
                            fillOpacity: 1,
                            strokeColor: '#1d4ed8',
                            strokeWeight: 2
                        },
                        animation: window.google.maps.Animation.DROP
                    };

                    const marker = new window.google.maps.Marker(markerOptions);

                    console.log('✅ Marcador agregado');

                    // Info window con dirección
                    if (address) {
                        const infoWindow = new window.google.maps.InfoWindow({
                            content: `
                                <div style="color: #000; padding: 8px; max-width: 200px;">
                                  <h4 style="margin: 0 0 8px 0; font-weight: bold;">${markerTitle}</h4>
                                  <p style="margin: 0; font-size: 14px; word-wrap: break-word;">${address}</p>
                                </div>
                              `
                        });

                        marker.addListener('click', () => {
                            infoWindow.open(map, marker);
                        });
                    }
                } else {
                    console.log('ℹ️ No hay coordenadas específicas, mostrando mapa general de Buenos Aires');
                }

                setIsLoaded(true);
                setError(null);
                console.log('🎉 Mapa inicializado completamente');

            } catch (err) {
                console.error("❌ Error inicializando mapa:", err);
                setError(`Error inicializando el mapa: ${err instanceof Error ? err.message : 'Error desconocido'}`);
            }
        };

        const handleRetry = () => {
            console.log(`🔄 Reintentando carga de Google Maps (${retryCount + 1}/${maxRetries})`);
            setRetryCount(prev => prev + 1);
            setError(null);
            setIsLoaded(false);

            // Limpiar scripts existentes
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existingScript) {
                existingScript.remove();
            }

            loadGoogleMaps();
        };

        loadGoogleMaps();

        // Exponer función de reintento para uso externo
        (window as any).retryGoogleMaps = handleRetry;

    }, [latitude, longitude, address, markerTitle, retryCount]);

    const handleRetryClick = () => {
        console.log('🔄 Usuario solicitó reintento');
        setRetryCount(0);
        setError(null);
        setIsLoaded(false);

        // Limpiar scripts existentes
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            existingScript.remove();
        }

        // Limpiar objeto google
        if (window.google) {
            delete window.google;
        }

        // Forzar recarga completa
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'TU_API_KEY_AQUI' ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'TU_API_KEY_REAL') {
        return (
            <Card className="bg-zinc-900/50 border-zinc-700">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        Configuración Requerida
                    </h3>
                    <p className="text-zinc-400 text-sm mb-4">
                        Para usar Google Maps, necesitas configurar tu API key.
                        Ve a la página de configuración para obtener instrucciones.
                    </p>
                    <div className="bg-zinc-800 p-3 rounded text-left text-xs text-zinc-300 mb-4">
                        <p>Crea un archivo <code className="bg-zinc-700 px-1 rounded">.env.local</code> en la raíz del proyecto:</p>
                        <br />
                        <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui</code>
                        <br />
                        <code>GOOGLE_MAPS_API_KEY=tu_api_key_aqui</code>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => window.open('/google-maps-setup', '_blank')}
                            variant="default"
                            size="sm"
                        >
                            Configurar API Key
                        </Button>
                        <Button
                            onClick={() => window.open('https://console.cloud.google.com/google/maps-apis', '_blank')}
                            variant="outline"
                            size="sm"
                        >
                            Obtener API Key
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="bg-zinc-900/50 border-zinc-700">
                <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <h3 className="text-lg font-medium text-white mb-2">
                        Error en Google Maps
                    </h3>
                    <p className="text-red-400 text-sm mb-4">{error}</p>
                    {retryCount < maxRetries && (
                        <div className="space-y-2">
                            <Button
                                onClick={handleRetryClick}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Reintentar ({retryCount}/{maxRetries})
                            </Button>
                            <p className="text-xs text-zinc-500">
                                También puedes recargar la página completa
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-zinc-900/50 border-zinc-700">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Ubicación del Estacionamiento
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <div
                        ref={mapRef}
                        className={className + " rounded-lg border border-zinc-600"}
                        style={{ minHeight: '250px' }}
                    />
                    {!isLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 rounded-lg">
                            <div className="text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-zinc-400 mb-2" />
                                <p className="text-zinc-400 text-sm">Cargando mapa...</p>
                            </div>
                        </div>
                    )}
                </div>
                {address && (
                    <div className="mt-3 text-sm text-zinc-400">
                        <MapPin className="h-4 w-4 inline mr-1" />
                        {address}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
