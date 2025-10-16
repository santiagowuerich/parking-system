"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleMapsLoader } from "@/lib/google-maps-loader";

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
    onUserLocationUpdate?: (location: { lat: number, lng: number }) => void;
    userLocation?: { lat: number, lng: number } | null;
    searchRadius?: number;
    onParkingsLoaded?: (parkings: ParkingData[]) => void;
    vehicleTypeFilter?: 'AUT' | 'MOT' | 'CAM' | null;
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
    onLocationButtonClick,
    onUserLocationUpdate,
    userLocation,
    searchRadius = 2,
    onParkingsLoaded,
    vehicleTypeFilter = null
}: ParkingMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const userLocationMarkerRef = useRef<google.maps.Marker | null>(null);
    const [parkings, setParkings] = useState<ParkingData[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const didMountRef = useRef(false);
    const updateMarkersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Función para calcular la distancia entre dos puntos (Haversine formula)
    const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }, []);

    // Función optimizada para filtrar estacionamientos según el radio de búsqueda
    const getFilteredParkings = useMemo((): ParkingData[] => {
        if (!userLocation) {
            // Si no hay ubicación del usuario, mostrar todos los estacionamientos disponibles
            return parkings;
        }

        return parkings.filter(parking => {
            const distance = calculateDistance(
                userLocation.lat,
                userLocation.lng,
                parking.latitud,
                parking.longitud
            );
            return distance <= searchRadius;
        });
    }, [parkings, userLocation, searchRadius, calculateDistance]);

    const [isDomReady, setIsDomReady] = useState(false);
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
            // Construir URL con filtro de tipo de vehículo si existe
            const url = vehicleTypeFilter
                ? `/api/parkings?vehicleType=${vehicleTypeFilter}`
                : '/api/parkings';

            const logPrefix = vehicleTypeFilter ? `🔍 [${vehicleTypeFilter}]` : '🔍';

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data = await response.json();
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

            // Notificar al componente padre sobre la nueva ubicación del usuario
            if (onUserLocationUpdate) {
                onUserLocationUpdate(coords);
            }

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
                
                <!-- Botón Navegar -->
                <button
                    id="navigate-button-${parking.id}"
                    style="width: 100%; background: #2563eb; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background-color 0.2s;"
                    onmouseover="this.style.backgroundColor='#1d4ed8'"
                    onmouseout="this.style.backgroundColor='#2563eb'"
                >
                    🧭 Navegar
                </button>
            `;

            // Agregar event listener al botón de cerrar
            const closeButton = contentDiv.querySelector(`#close-button-${parking.id}`);
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    infoWindow.close();
                });
            }

            // Agregar event listener al botón de navegar
            const navigateButton = contentDiv.querySelector(`#navigate-button-${parking.id}`);
            if (navigateButton) {
                navigateButton.addEventListener('click', () => {
                    // Crear la URL para Google Maps
                    const address = encodeURIComponent(
                        parking.direccionCompleta || parking.direccion
                    );
                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;

                    // Abrir en nueva pestaña
                    window.open(googleMapsUrl, '_blank');

                    console.log('🧭 Navegando a:', parking.nombre, 'en', parking.direccionCompleta || parking.direccion);
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

        // Guardar referencia al info window y al parking
        (marker as any).infoWindow = infoWindow;
        (marker as any).parkingData = parking;

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
                const latitudes = parkingsData.map((p: ParkingData) => p.latitud);
                const longitudes = parkingsData.map((p: ParkingData) => p.longitud);
                const centerLat = latitudes.reduce((a: number, b: number) => a + b, 0) / latitudes.length;
                const centerLng = longitudes.reduce((a: number, b: number) => a + b, 0) / longitudes.length;

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

            // Crear marcadores para cada estacionamiento (filtrar según radio si hay ubicación del usuario)
            const filteredParkings = getFilteredParkings;
            filteredParkings.forEach((parking: ParkingData) => {
                const marker = createParkingMarker(parking, map);
                markersRef.current.push(marker);
            });

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

            const loadGoogleMaps = async () => {
                // Verificar API key
                const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
                if (!apiKey || apiKey === 'TU_API_KEY_AQUI' || apiKey === 'TU_API_KEY_REAL') {
                    console.error('❌ API key de Google Maps no configurada');
                    setError('API key de Google Maps no configurada. Ve a /google-maps-setup para configurarla.');
                    return;
                }

                try {
                    // Usar el loader oficial
                    await googleMapsLoader.load({
                        apiKey,
                        libraries: ['places'],
                        version: 'weekly'
                    });

                    console.log('✅ Google Maps cargado, inicializando mapa...');
                    initializeMap();
                } catch (error) {
                    console.error('❌ Error cargando Google Maps:', error);
                    setError('Error cargando Google Maps API. Verifica tu API key.');
                }
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
        markersRef.current.forEach((marker) => {
            // Obtener el parking asociado al marcador directamente
            const parking = (marker as any).parkingData as ParkingData;
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

            // Actualizar animación y centrar mapa si está seleccionado
            if (isSelected) {
                marker.setAnimation(window.google.maps.Animation.BOUNCE);

                // Centrar el mapa suavemente en el marcador seleccionado
                const position = marker.getPosition();
                if (position && mapInstanceRef.current) {
                    mapInstanceRef.current.panTo(position);

                    // Ajustar zoom si está muy alejado
                    const currentZoom = mapInstanceRef.current.getZoom() || 14;
                    if (currentZoom < 15) {
                        mapInstanceRef.current.setZoom(15);
                    }
                }

                // Quitar animación después de 2 segundos
                setTimeout(() => {
                    marker.setAnimation(null);
                }, 2000);
            }
        });

    }, [selectedParkingId]);

    // useEffect para notificar al componente padre cuando se cargan los estacionamientos
    useEffect(() => {
        if (parkings.length > 0 && onParkingsLoaded) {
            console.log('📤 Notificando al componente padre sobre estacionamientos cargados:', parkings.length);
            onParkingsLoaded(parkings);
        }
    }, [parkings, onParkingsLoaded]);

    // useEffect para recargar estacionamientos cuando cambie el filtro de tipo de vehículo
    useEffect(() => {
        // Usar didMountRef para evitar ejecutar en el primer render
        if (!didMountRef.current) {
            didMountRef.current = true;
            return;
        }

        if (isLoaded && mapInstanceRef.current) {
            const reloadWithFilter = async () => {
                console.log('🔄 Recargando estacionamientos con filtro:', vehicleTypeFilter);
                const loadedParkings = await fetchParkings();

                // Recrear marcadores con los nuevos datos
                if (mapInstanceRef.current && loadedParkings.length > 0) {
                    // Limpiar marcadores existentes
                    markersRef.current.forEach(marker => marker.setMap(null));
                    markersRef.current = [];

                    // Crear nuevos marcadores
                    const filteredParkings = getFilteredParkings;
                    filteredParkings.forEach((parking: ParkingData) => {
                        const marker = createParkingMarker(parking, mapInstanceRef.current!);
                        markersRef.current.push(marker);
                    });
                }
            };

            reloadWithFilter();
        }
    }, [vehicleTypeFilter]);

    // useEffect para actualizar marcadores cuando cambie el radio de búsqueda o ubicación del usuario
    // Con debounce para evitar múltiples renders costosos
    useEffect(() => {
        if (isLoaded && mapInstanceRef.current && parkings.length > 0) {
            // Limpiar timeout anterior si existe
            if (updateMarkersTimeoutRef.current) {
                clearTimeout(updateMarkersTimeoutRef.current);
            }

            // Aplicar debounce de 300ms
            updateMarkersTimeoutRef.current = setTimeout(() => {
                console.log('🔄 Actualizando marcadores por cambio de radio o ubicación...');

                // Limpiar marcadores existentes
                markersRef.current.forEach(marker => marker.setMap(null));
                markersRef.current = [];

                // Crear nuevos marcadores con filtro actualizado
                const filteredParkings = getFilteredParkings;
                filteredParkings.forEach((parking: ParkingData) => {
                    const marker = createParkingMarker(parking, mapInstanceRef.current!);
                    markersRef.current.push(marker);
                });

                console.log(`✅ Actualizados ${markersRef.current.length} marcadores (filtrados por radio de ${searchRadius}km)`);
            }, 300);
        }

        // Cleanup al desmontar
        return () => {
            if (updateMarkersTimeoutRef.current) {
                clearTimeout(updateMarkersTimeoutRef.current);
            }
        };
    }, [userLocation, searchRadius, parkings, isLoaded, getFilteredParkings]);

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
                    <div role="alert" aria-live="assertive">
                        <AlertCircle className="h-8 w-8 mx-auto text-red-500 mb-2" aria-hidden="true" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            Error en el Mapa
                        </h3>
                        <p className="text-red-400 text-sm mb-4">{error}</p>
                    </div>
                    {retryCount < maxRetries && (
                        <div className="space-y-2">
                            <Button
                                onClick={handleRetryClick}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                aria-label={`Reintentar carga del mapa. Intento ${retryCount} de ${maxRetries}`}
                            >
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
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
                    Estacionamientos Disponibles ({getFilteredParkings.length})
                    {parkings.length > 0 && (
                        <span className="text-xs text-gray-500 ml-2">
                            (de {parkings.length} totales)
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative">
                    {/* Popup para solicitar ubicación */}
                    {!userLocation && isLoaded && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg" role="dialog" aria-labelledby="location-prompt-title" aria-describedby="location-prompt-description">
                            <div className="bg-white border border-blue-200 rounded-2xl p-8 shadow-xl max-w-md mx-4 text-center">
                                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6" aria-hidden="true">
                                    <MapPin className="h-8 w-8 text-blue-600" />
                                </div>
                                <h3 id="location-prompt-title" className="text-xl font-bold text-gray-900 mb-3">
                                    ¡Presiona "Mi Ubicación"!
                                </h3>
                                <p id="location-prompt-description" className="text-gray-600 mb-6 leading-relaxed">
                                    Para ver los estacionamientos cercanos a ti, necesitamos conocer tu ubicación actual.
                                </p>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center gap-3 text-blue-700">
                                        <div className="bg-blue-200 rounded-full w-8 h-8 flex items-center justify-center" aria-hidden="true">
                                            <span className="text-sm font-bold">1</span>
                                        </div>
                                        <span className="text-sm font-medium">
                                            Haz clic en el botón "Mi Ubicación" en la parte superior
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div
                        ref={mapRef}
                        className={className + " rounded-lg border border-gray-200"}
                        style={{ minHeight: '400px' }}
                    />
                    {!isLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white rounded-lg" role="status" aria-live="polite">
                            <div className="text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" aria-hidden="true" />
                                <p className="text-gray-500 text-sm">Cargando estacionamientos...</p>
                                <span className="sr-only">Cargando mapa de estacionamientos, por favor espere</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Leyenda */}
                <div className="flex items-center gap-4 mt-3 text-xs" role="group" aria-label="Leyenda del mapa de estacionamientos">
                    <span className="text-gray-600">Leyenda:</span>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-green-500" aria-hidden="true"></div>
                        <span>Disponible</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-orange-500" aria-hidden="true"></div>
                        <span>Pocos espacios</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-red-500" aria-hidden="true"></div>
                        <span>Lleno</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full bg-blue-500" aria-hidden="true"></div>
                        <span>Seleccionado</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
