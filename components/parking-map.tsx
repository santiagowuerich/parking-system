"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ParkingData {
    id: number;
    nombre: string;
    direccion: string;
    direccionCompleta: string;
    localidad: string;
    provincia: string;
    latitud: number;
    longitud: number;
    capacidad: number;
    espaciosDisponibles: number;
    horarioFuncionamiento: number;
    telefono?: string;
    email?: string;
    estado: 'disponible' | 'pocos' | 'lleno';
}

interface ParkingMapProps {
    className?: string;
    onParkingSelect?: (parking: ParkingData) => void;
    selectedParkingId?: number;
    onLocationButtonClick?: () => void;
}

declare global {
    interface Window {
        google: any;
        initParkingMap: () => void;
    }
}

export default function ParkingMap({
    className = "h-96 w-full",
    onParkingSelect,
    selectedParkingId,
    onLocationButtonClick
}: ParkingMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
    const [parkings, setParkings] = useState<ParkingData[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const [isDomReady, setIsDomReady] = useState(false);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const maxRetries = 3;

    // Función para guardar el estado del mapa en localStorage
    const saveMapState = (center: google.maps.LatLng, zoom: number) => {
        try {
            const mapState = {
                lat: center.lat(),
                lng: center.lng(),
                zoom: zoom,
                timestamp: Date.now()
            };
            localStorage.setItem('parking-map-state', JSON.stringify(mapState));
            console.log('💾 Estado del mapa guardado:', mapState);
        } catch (error) {
            console.error('❌ Error guardando estado del mapa:', error);
        }
    };

    // Función para cargar el estado del mapa desde localStorage
    const loadMapState = () => {
        try {
            const savedState = localStorage.getItem('parking-map-state');
            if (savedState) {
                const mapState = JSON.parse(savedState);
                // Verificar que el estado no sea muy viejo (más de 24 horas)
                const isOld = Date.now() - mapState.timestamp > 24 * 60 * 60 * 1000;
                if (!isOld) {
                    console.log('📂 Estado del mapa cargado:', mapState);
                    return {
                        center: { lat: mapState.lat, lng: mapState.lng },
                        zoom: mapState.zoom
                    };
                }
            }
        } catch (error) {
            console.error('❌ Error cargando estado del mapa:', error);
        }
        return null;
    };

    // Función para obtener datos de estacionamientos
    const fetchParkings = async () => {
        try {
            console.log('🔍 Obteniendo estacionamientos de la base de datos...');
            const response = await fetch('/api/parkings');

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Obtenidos ${data.count} estacionamientos:`, data.parkings);

            setParkings(data.parkings || []);
            return data.parkings || [];
        } catch (error) {
            console.error('❌ Error obteniendo estacionamientos:', error);
            setError(`Error cargando estacionamientos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
            return [];
        }
    };

    // Función para obtener la ubicación actual del usuario
    const getUserLocation = (): Promise<{ lat: number, lng: number }> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocalización no soportada por este navegador'));
                return;
            }

            console.log('📍 Solicitando ubicación del usuario...');

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    console.log('✅ Ubicación obtenida:', coords);
                    setUserLocation(coords);
                    resolve(coords);
                },
                (error) => {
                    console.error('❌ Error obteniendo ubicación:', error);
                    let errorMessage = 'Error obteniendo ubicación';

                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Permisos de ubicación denegados';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Ubicación no disponible';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Tiempo de espera agotado';
                            break;
                    }

                    setError(errorMessage);
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 300000 // 5 minutos
                }
            );
        });
    };

    // Función para centrar el mapa en la ubicación del usuario
    const centerMapOnUserLocation = async () => {
        try {
            console.log('🎯 Centrando mapa en ubicación del usuario...');
            const coords = await getUserLocation();

            if (!mapInstanceRef.current) {
                console.error('❌ Mapa no está inicializado');
                return;
            }

            // Centrar el mapa en la ubicación del usuario
            mapInstanceRef.current.setCenter(coords);
            mapInstanceRef.current.setZoom(16);

            // Guardar el nuevo estado del mapa
            saveMapState(new window.google.maps.LatLng(coords.lat, coords.lng), 16);

            // Limpiar marcador anterior de ubicación del usuario
            if (userLocationMarkerRef.current) {
                userLocationMarkerRef.current.setMap(null);
            }

            // Crear marcador de ubicación del usuario
            userLocationMarkerRef.current = new window.google.maps.Marker({
                position: coords,
                map: mapInstanceRef.current,
                title: 'Tu ubicación actual',
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285f4', // azul de Google
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                    zIndex: 1000 // Más alto que marcadores de estacionamientos
                },
                animation: window.google.maps.Animation.BOUNCE,
                zIndex: 1000
            });

            // Cerrar después de 2 segundos
            setTimeout(() => {
                if (userLocationMarkerRef.current) {
                    userLocationMarkerRef.current.setAnimation(null);
                }
            }, 2000);

            console.log('✅ Mapa centrado en ubicación del usuario');

        } catch (error) {
            console.error('❌ Error centrando mapa en usuario:', error);
            // No establecer error aquí para no romper la funcionalidad del mapa
        }
    };

    // Función para crear marcador con estilo según estado
    const createParkingMarker = (parking: ParkingData, map: google.maps.Map) => {
        const isSelected = selectedParkingId === parking.id;

        // Colores basados en estado
        let fillColor = '#3b82f6'; // azul por defecto
        let strokeColor = '#1d4ed8';

        switch (parking.estado) {
            case 'disponible':
                fillColor = '#10b981'; // verde
                strokeColor = '#059669';
                break;
            case 'pocos':
                fillColor = '#f59e0b'; // naranja
                strokeColor = '#d97706';
                break;
            case 'lleno':
                fillColor = '#ef4444'; // rojo
                strokeColor = '#dc2626';
                break;
        }

        // Si está seleccionado, usar color azul destacado
        if (isSelected) {
            fillColor = '#3b82f6';
            strokeColor = '#1d4ed8';
        }

        const marker = new window.google.maps.Marker({
            position: { lat: parking.latitud, lng: parking.longitud },
            map: map,
            title: parking.nombre,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? 12 : 10, // Más grande si está seleccionado
                fillColor: fillColor,
                fillOpacity: 1,
                strokeColor: strokeColor,
                strokeWeight: isSelected ? 3 : 2,
            },
            animation: isSelected ? window.google.maps.Animation.BOUNCE : undefined,
            zIndex: isSelected ? 1000 : 100 // Mayor prioridad si está seleccionado
        });

        // Info window con configuración limpia
        const infoWindow = new window.google.maps.InfoWindow({
            maxWidth: 360
        });

        // Función para abrir popup con la nueva implementación
        const openPopup = ({ map, marker }: { map: google.maps.Map, marker: google.maps.Marker }) => {
            infoWindow.close();

            // Crear un div temporal para el contenido
            const contentDiv = document.createElement('div');
            contentDiv.className = 'parking-popup relative w-[340px] max-w-[86vw] rounded-2xl border bg-white p-4 shadow-xl';

            contentDiv.innerHTML = `
                <button
                    aria-label="Cerrar"
                    id="close-button-${parking.id}"
                    style="position: absolute; right: 12px; top: 12px; background: none; border: none; font-size: 18px; color: #6b7280; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s;"
                    onmouseover="this.style.backgroundColor='#f3f4f6'"
                    onmouseout="this.style.backgroundColor='transparent'"
                >
                    ×
                </button>

                <!-- Nombre del estacionamiento -->
                <h3 style="margin: 0 0 8px 0; font-weight: bold; font-size: 18px; color: #1f2937; line-height: 1.2;">
                    ${parking.nombre}
                </h3>
                
                <!-- Dirección -->
                <p style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; display: flex; align-items: center; line-height: 1.4;">
                    📍 ${parking.direccion}
                </p>
                
                <!-- Estado y horario -->
                <div style="display: flex; align-items: center; justify-content: space-between; background: #f9fafb; padding: 12px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; border-radius: 50%; background: ${parking.estado === 'disponible' ? '#10b981' : parking.estado === 'pocos' ? '#f59e0b' : '#ef4444'};"></div>
                        <span style="font-weight: 600; color: #374151; font-size: 14px;">
                            ${parking.espaciosDisponibles > 0 ? `${parking.espaciosDisponibles} libres` : 'Sin espacios'}
                        </span>
                    </div>
                    <span style="font-weight: 600; color: #6b7280; font-size: 14px;">
                        ${parking.horarioFuncionamiento === 24 ? '24hs' : `${parking.horarioFuncionamiento}h`}
                    </span>
                </div>
            `;

            // Agregar event listener al botón de cerrar
            const closeButton = contentDiv.querySelector(`#close-button-${parking.id}`);
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    infoWindow.close();
                });
            }

            infoWindow.setContent(contentDiv);
            infoWindow.setOptions({
                shouldFocus: false,
                pixelOffset: new window.google.maps.Size(0, -8)
            });
            infoWindow.open({ map, anchor: marker });
        };

        // Hacer clic en el marcador para mostrar info window Y seleccionar estacionamiento
        marker.addListener('click', () => {
            console.log(`🏢 Marcador clickeado: ${parking.nombre}`, parking);

            // Cerrar otros info windows
            markersRef.current.forEach(m => {
                if (m !== marker) {
                    const otherInfoWindow = (m as any).infoWindow;
                    if (otherInfoWindow) {
                        otherInfoWindow.close();
                    }
                }
            });

            // Mostrar info window con la nueva implementación
            openPopup({ map, marker });

            // Seleccionar estacionamiento SIN mover el mapa
            if (onParkingSelect) {
                onParkingSelect(parking);
            }
        });

        // Guardar referencia al info window
        (marker as any).infoWindow = infoWindow;

        return marker;
    };

    // Función para inicializar el mapa con múltiples marcadores
    const initializeMap = async () => {
        if (!mapRef.current || !window.google?.maps?.Map) {
            console.error('❌ Referencia al mapa o Google Maps no disponible');
            setError('Mapa no disponible. Esperando carga...');
            setTimeout(() => initializeMap(), 300);
            return;
        }

        try {
            console.log('🗺️ Inicializando mapa de estacionamientos...');

            // Obtener estacionamientos
            const parkingsData = await fetchParkings();

            if (parkingsData.length === 0) {
                console.log('⚠️ No hay estacionamientos para mostrar');
                setError('No se encontraron estacionamientos con coordenadas en la base de datos');
                return;
            }

            // Intentar cargar el estado guardado del mapa
            const savedState = loadMapState();

            let mapCenter, mapZoom;

            if (savedState) {
                // Usar el estado guardado
                mapCenter = savedState.center;
                mapZoom = savedState.zoom;
                console.log('📍 Usando estado guardado del mapa:', savedState);
            } else {
                // Calcular centro del mapa basado en los estacionamientos
                const latitudes = parkingsData.map(p => p.latitud);
                const longitudes = parkingsData.map(p => p.longitud);
                const centerLat = latitudes.reduce((a, b) => a + b, 0) / latitudes.length;
                const centerLng = longitudes.reduce((a, b) => a + b, 0) / longitudes.length;

                mapCenter = { lat: centerLat, lng: centerLng };
                mapZoom = 14;
                console.log('📍 Centro calculado:', mapCenter);
            }

            // Opciones del mapa optimizadas para estacionamientos
            const mapOptions: google.maps.MapOptions = {
                zoom: mapZoom,
                center: mapCenter,
                mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                styles: [
                    {
                        "featureType": "poi.business",
                        "stylers": [{ "visibility": "simplified" }]
                    },
                    {
                        "featureType": "poi.park",
                        "stylers": [{ "visibility": "simplified" }]
                    }
                ],
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                scaleControl: true,
                streetViewControl: false,
                rotateControl: false,
                fullscreenControl: true
            };

            // Crear mapa
            const map = new window.google.maps.Map(mapRef.current, mapOptions);
            mapInstanceRef.current = map; // Guardar referencia global

            console.log('✅ Mapa creado exitosamente');

            // Limpiar marcadores anteriores
            markersRef.current.forEach(marker => marker.setMap(null));
            markersRef.current = [];

            // Limpiar marcador de ubicación del usuario anterior
            if (userLocationMarkerRef.current) {
                userLocationMarkerRef.current.setMap(null);
                userLocationMarkerRef.current = null;
            }

            // Crear marcadores para cada estacionamiento
            parkingsData.forEach(parking => {
                const marker = createParkingMarker(parking, map);
                markersRef.current.push(marker);
            });

            console.log(`✅ Creados ${markersRef.current.length} marcadores`);

            setIsLoaded(true);
            setError(null);
            console.log('🎉 Mapa de estacionamientos inicializado completamente');

            // Configurar el mapa para que NO se mueva automáticamente al hacer zoom de mouse
            map.set('scrollwheel', true);
            map.set('gestureHandling', 'greedy'); // Permite zoom con mouse wheel

            // Event listeners para guardar el estado del mapa
            let saveTimeout: NodeJS.Timeout;
            const debouncedSave = () => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => {
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    if (center && zoom !== undefined) {
                        saveMapState(center, zoom);
                    }
                }, 1000); // Guardar después de 1 segundo de inactividad
            };

            map.addListener('center_changed', debouncedSave);
            map.addListener('zoom_changed', debouncedSave);

        } catch (err) {
            console.error("❌ Error inicializando mapa:", err);
            setError(`Error inicializando el mapa: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
    };

    // useEffect para detectar cuando el DOM está listo
    useEffect(() => {
        if (mapRef.current && !isDomReady) {
            console.log('🏠 Contenedor del mapa detectado');
            setIsDomReady(true);
        }
    }, [mapRef.current, isDomReady]);

    // useEffect para cargar Google Maps cuando el DOM esté listo
    useEffect(() => {
        if (isDomReady) {
            console.log('🚀 DOM listo, iniciando carga de Google Maps para estacionamientos');

            const loadGoogleMaps = () => {
                // Verificar API key
                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                if (!apiKey || apiKey === 'TU_API_KEY_AQUI' || apiKey === 'TU_API_KEY_REAL') {
                    console.error('❌ API key de Google Maps no configurada');
                    setError('API key de Google Maps no configurada. Ve a /google-maps-setup para configurarla.');
                    return;
                }

                // Verificar si la API ya está completamente cargada
                if (window.google && window.google.maps && window.google.maps.Map) {
                    console.log('✅ Google Maps ya cargado, inicializando mapa...');
                    initializeMap();
                    return;
                }

                // Verificar si ya está cargando
                if (document.querySelector('script[src*="maps.googleapis.com"]')) {
                    console.log('⏳ Script de Google Maps ya existe, esperando...');
                    const checkLoaded = () => {
                        if (window.google && window.google.maps && window.google.maps.Map) {
                            initializeMap();
                        } else {
                            setTimeout(checkLoaded, 200);
                        }
                    };
                    checkLoaded();
                    return;
                }

                // Cargar script de Google Maps
                console.log('📡 Cargando script de Google Maps...');
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=weekly&callback=initParkingMap`;
                script.async = true;
                script.defer = true;

                script.onload = () => {
                    console.log('📦 Script de Google Maps cargado');
                    setTimeout(() => {
                        if (window.google && window.google.maps && window.google.maps.Map) {
                            initializeMap();
                        } else {
                            setError('Error: Google Maps no se cargó correctamente');
                        }
                    }, 500);
                };

                script.onerror = (error) => {
                    console.error('❌ Error cargando script de Google Maps:', error);
                    setError('Error cargando Google Maps API. Verifica tu API key.');
                };

                document.head.appendChild(script);
            };

            loadGoogleMaps();
        }
    }, [isDomReady]); // Remover selectedParkingId de dependencias para evitar recrear el mapa

    // useEffect separado para actualizar marcadores cuando cambie la selección (sin recrear mapa)
    useEffect(() => {
        if (!mapInstanceRef.current || markersRef.current.length === 0) {
            return; // Map o marcadores no listos aún
        }

        console.log(`🎯 Actualizando marcadores para selección:`, selectedParkingId);

        // Actualizar aspecto de todos los marcadores
        markersRef.current.forEach((marker, index) => {
            const parking = parkings[index];
            if (!parking) return;

            const isSelected = selectedParkingId === parking.id;

            // Redefinir icono según estado actual
            let fillColor = '#3b82f6'; // azul por defecto
            let strokeColor = '#1d4ed8';

            switch (parking.estado) {
                case 'disponible':
                    fillColor = '#10b981'; // verde
                    strokeColor = '#059669';
                    break;
                case 'pocos':
                    fillColor = '#f59e0b'; // naranja
                    strokeColor = '#d97706';
                    break;
                case 'lleno':
                    fillColor = '#ef4444'; // rojo
                    strokeColor = '#dc2626';
                    break;
            }

            // Si está seleccionado, usar color azul destacado
            if (isSelected) {
                fillColor = '#3b82f6';
                strokeColor = '#1d4ed8';
            }

            // Actualizar icono del marcador
            marker.setIcon({
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? 12 : 10, // Más grande si está seleccionado
                fillColor: fillColor,
                fillOpacity: 1,
                strokeColor: strokeColor,
                strokeWeight: isSelected ? 3 : 2,
            });

            // Actualizar z-index
            marker.setZIndex(isSelected ? 1000 : 100);

            // Actualizar animación
            if (isSelected) {
                marker.setAnimation(window.google.maps.Animation.BOUNCE);
                // Quitar animación después de 2 segundos
                setTimeout(() => {
                    marker.setAnimation(null);
                }, 2000);
            }
        });

    }, [selectedParkingId, parkings]);

    // Exponer función de ubicación cuando el componente esté montado
    useEffect(() => {
        if (onLocationButtonClick) {
            (window as any).centerMapOnUserLocation = centerMapOnUserLocation;
        }
        return () => {
            // Limpiar en unmount
            delete (window as any).centerMapOnUserLocation;
        };
    }, [onLocationButtonClick]);

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

        // Forzar recarga completa
        setTimeout(() => {
            window.location.reload();
        }, 100);
    };

    // Verificar configuración de API key
    if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'TU_API_KEY_AQUI' ||
        process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY === 'TU_API_KEY_REAL') {

        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Configuración Requerida
                    </h3>
                    <p className="text-gray-500 text-sm mb-4">
                        Para usar el mapa de estacionamientos, necesitas configurar tu Google Maps API key.
                    </p>
                    <div className="bg-gray-50 p-3 rounded text-left text-xs text-gray-700 mb-4">
                        <p>Crea un archivo <code className="bg-gray-200 px-1 rounded">.env.local</code>:</p>
                        <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_aqui</code>
                    </div>
                    <Button
                        onClick={() => window.open('/google-maps-setup', '_blank')}
                        variant="default"
                        size="sm"
                    >
                        Configurar API Key
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Error en el Mapa
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
                            <p className="text-xs text-gray-500">
                                También puedes recargar la página completa
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Estacionamientos Disponibles ({parkings.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    <div
                        ref={mapRef}
                        className={className + " rounded-lg border border-gray-200"}
                        style={{ minHeight: '400px' }}
                    />
                    {!isLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg">
                            <div className="text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
                                <p className="text-gray-500 text-sm">Cargando estacionamientos...</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Leyenda */}
                <div className="flex items-center gap-4 mt-3 text-xs">
                    <span className="text-gray-600">Leyenda:</span>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span>Disponible</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                        <span>Pocos espacios</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        <span>Lleno</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span>Seleccionado</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
