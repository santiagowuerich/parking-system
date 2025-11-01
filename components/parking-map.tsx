"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleMapsLoader } from "@/lib/google-maps-loader";
import { HorarioFranja, EstadoApertura } from "@/lib/types/horarios";

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
    telefono?: string;
    email?: string;
    estado: 'disponible' | 'pocos' | 'lleno';
    est_publicado?: boolean;
    est_requiere_llave?: 'no' | 'opcional' | 'requerida';
    descripcion?: string;
    tolerancia?: number;
    horarios?: HorarioFranja[];
    estadoApertura?: EstadoApertura;
    tipoDisponibilidad?: 'configurada' | 'fisica';
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
        openParkingPopup?: (parkingId: number) => void;
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
    const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
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
            console.log(`${logPrefix} Estacionamientos encontrados:`, data.parkings?.length || 0);
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

    // Función para mostrar ruta desde ubicación del usuario hasta estacionamiento seleccionado
    const showRouteToParking = async (parking: ParkingData) => {
        if (!mapInstanceRef.current || !userLocation || !window.google?.maps) {
            return;
        }

        try {
            // Inicializar DirectionsService y DirectionsRenderer si no existen
            if (!directionsServiceRef.current) {
                directionsServiceRef.current = new window.google.maps.DirectionsService();
            }
            if (!directionsRendererRef.current) {
                directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
                    suppressMarkers: true, // No mostrar marcadores adicionales ya que tenemos los nuestros
                    preserveViewport: true, // No ajustar automáticamente el viewport para mostrar toda la ruta
                    polylineOptions: {
                        strokeColor: '#4285f4',
                        strokeWeight: 5,
                        strokeOpacity: 0.8
                    }
                });
                if (directionsRendererRef.current) {
                    directionsRendererRef.current.setMap(mapInstanceRef.current);
                }
            }

            // Calcular la ruta
            const request: google.maps.DirectionsRequest = {
                origin: userLocation,
                destination: { lat: parking.latitud, lng: parking.longitud },
                travelMode: window.google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false
            };

            if (directionsServiceRef.current) {
                directionsServiceRef.current.route(request, (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK && result) {
                        directionsRendererRef.current?.setDirections(result);
                        console.log('🛣️ Ruta calculada exitosamente al estacionamiento:', parking.nombre);
                    } else {
                        console.error('❌ Error calculando ruta:', status);
                        // Limpiar ruta si hay error
                        directionsRendererRef.current?.setDirections(null);
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error mostrando ruta:', error);
        }
    };

    // Función para limpiar la ruta mostrada
    const clearRoute = () => {
        if (directionsRendererRef.current) {
            directionsRendererRef.current.setDirections(null);
        }
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
            maxWidth: 300
        });

        // Función para abrir popup con la nueva implementación
        const openPopup = ({ map, marker }: { map: google.maps.Map, marker: google.maps.Marker }) => {
            infoWindow.close();

            // Primero abrir el popup para que se renderice
            // Luego centrar el mapa considerando la posición del popup

            // Crear un div temporal para el contenido
            const contentDiv = document.createElement('div');
            contentDiv.className = 'parking-popup relative w-[280px] max-w-[80vw] rounded-2xl border bg-white p-4 shadow-xl';


            contentDiv.innerHTML = `
                <button
                    aria-label="Cerrar"
                    id="close-button-${parking.id}"
                    style="position: absolute; right: 12px; top: 12px; background: none; border: none; font-size: 20px; color: #9ca3af; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;"
                    onmouseover="this.style.backgroundColor='#f3f4f6'; this.style.color='#374151';"
                    onmouseout="this.style.backgroundColor='transparent'; this.style.color='#9ca3af';"
                >
                    ×
                </button>

                <!-- Nombre del estacionamiento con badge de capacidad -->
                <div style="margin-bottom: 12px; padding-right: 24px;">
                    <h3 style="margin: 0 0 6px 0; font-weight: 700; font-size: 19px; color: #111827; line-height: 1.3;">
                        ${parking.nombre}
                    </h3>
                    <div style="display: inline-flex; align-items: center; gap: 6px; background: ${parking.estado === 'disponible' ? '#dcfce7' : parking.estado === 'pocos' ? '#fef3c7' : '#fee2e2'}; padding: 4px 10px; border-radius: 12px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${parking.estado === 'disponible' ? '#10b981' : parking.estado === 'pocos' ? '#f59e0b' : '#ef4444'};"></div>
                        <span style="font-weight: 600; color: ${parking.estado === 'disponible' ? '#047857' : parking.estado === 'pocos' ? '#b45309' : '#b91c1c'}; font-size: 13px;">
                            ${parking.capacidad} plazas totales
                        </span>
                    </div>
                </div>

                <!-- Dirección con icono -->
                <div style="margin-bottom: 14px; display: flex; align-items: start; gap: 8px;">
                    <span style="color: #6b7280; font-size: 16px; margin-top: 1px;">📍</span>
                    <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5; flex: 1;">
                        ${parking.direccion.split(',')[0]}, ${parking.localidad}
                    </p>
                </div>



                <!-- Botón de acción -->
                <button
                    id="navigate-button-${parking.id}"
                    style="width: 100%; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); margin-top: 14px;"
                    onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(37, 99, 235, 0.3)';"
                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(37, 99, 235, 0.2)';"
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
                    // PRIMERO: Centrar el mapa específicamente en el estacionamiento
                    if (mapInstanceRef.current) {
                        const parkingPosition = { lat: parking.latitud, lng: parking.longitud };
                        mapInstanceRef.current.setCenter(parkingPosition);
                        mapInstanceRef.current.setZoom(17); // Zoom más cercano para enfocarse en el estacionamiento

                        console.log('📍 Mapa centrado específicamente en estacionamiento:', parking.nombre);
                    }

                    // SEGUNDO: Crear la URL para Google Maps y abrir en nueva pestaña
                    const address = encodeURIComponent(
                        parking.direccionCompleta || parking.direccion
                    );
                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${address}`;
                    window.open(googleMapsUrl, '_blank');

                    console.log('🧭 Navegando a:', parking.nombre, 'en', parking.direccionCompleta || parking.direccion);
                });
            }

            infoWindow.setContent(contentDiv);
            infoWindow.setOptions({
                shouldFocus: false,
                pixelOffset: new window.google.maps.Size(0, -8)
            });
            
            // Función para centrar el mapa considerando el popup
            const centerMapWithPopup = () => {
                if (mapInstanceRef.current && marker.getPosition()) {
                    const position = marker.getPosition();
                    if (position && mapInstanceRef.current.getDiv()) {
                        const mapDiv = mapInstanceRef.current.getDiv();
                        const mapHeight = mapDiv.offsetHeight;
                        const mapWidth = mapDiv.offsetWidth;
                        
                        // El popup tiene aproximadamente 300px de alto y aparece arriba del marcador
                        // Para centrar el popup en la vista, necesitamos mover el centro del mapa hacia abajo
                        // El offset debe ser aproximadamente la mitad de la altura del popup más espacio para el marcador
                        // Usamos un offset más grande para asegurar que quede centrado
                        const popupHeight = 300;
                        const offsetPixels = mapHeight * 0.15; // 15% de la altura del mapa hacia abajo
                        
                        // Obtener los bounds actuales del mapa
                        const bounds = mapInstanceRef.current.getBounds();
                        if (bounds) {
                            const ne = bounds.getNorthEast();
                            const sw = bounds.getSouthWest();
                            const latRange = ne.lat() - sw.lat();
                            
                            if (latRange > 0 && mapHeight > 0) {
                                // Calcular la conversión de píxeles a grados de latitud
                                const degreesPerPixel = latRange / mapHeight;
                                const offsetDegrees = offsetPixels * degreesPerPixel;
                                
                                // Calcular la nueva posición centrada en el popup
                                // Restamos latitud para mover el mapa hacia abajo (el popup aparece más arriba visualmente)
                                const centerLat = position.lat() - offsetDegrees;
                                const centerLng = position.lng();
                                
                                const centeredPosition = new window.google.maps.LatLng(centerLat, centerLng);
                                
                                // Centrar el mapa en la nueva posición
                                mapInstanceRef.current.panTo(centeredPosition);
                                
                                // Asegurar un zoom mínimo para visibilidad
                                const currentZoom = mapInstanceRef.current.getZoom() || 15;
                                if (currentZoom < 15) {
                                    mapInstanceRef.current.setZoom(15);
                                }
                            } else {
                                // Fallback: centrar en el marcador
                                mapInstanceRef.current.panTo(position);
                            }
                        } else {
                            // Fallback: centrar en el marcador
                            mapInstanceRef.current.panTo(position);
                        }
                    }
                }
            };
            
            // Abrir el popup primero
            infoWindow.open({ map, anchor: marker });
            
            // Usar el evento domready del InfoWindow para centrar después de que se renderice
            window.google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
                // Esperar a que el popup se renderice completamente
                setTimeout(() => {
                    centerMapWithPopup();
                    // Intentar de nuevo después de más tiempo para asegurar que funcione
                    setTimeout(centerMapWithPopup, 300);
                }, 150);
            });
            
            // También intentar centrar después de que se renderice la ruta (por si el evento no se dispara)
            // Usar múltiples timeouts para asegurar que funcione después de que todo se renderice
            setTimeout(centerMapWithPopup, 250);
            setTimeout(centerMapWithPopup, 600);
            setTimeout(centerMapWithPopup, 1000);
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

        // Si no hay estacionamiento seleccionado, limpiar ruta
        if (!selectedParkingId) {
            clearRoute();
        }

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

                // Mostrar ruta desde ubicación del usuario hasta el estacionamiento
                showRouteToParking(parking);

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

    }, [selectedParkingId, userLocation]);

    // useEffect para notificar al componente padre cuando se cargan los estacionamientos
    useEffect(() => {
        if (parkings.length > 0 && onParkingsLoaded) {
            console.log('📤 Notificando al componente padre sobre estacionamientos cargados:', parkings.length);
            onParkingsLoaded(parkings);
        }
    }, [parkings, onParkingsLoaded]);

    // useEffect para forzar recarga inicial con filtro cuando se obtiene ubicación
    useEffect(() => {
        if (userLocation && vehicleTypeFilter && isLoaded && mapInstanceRef.current) {
            console.log('🎯 Recarga inicial con filtro aplicado:', vehicleTypeFilter, 'Parkings actuales:', parkings.length);
            fetchParkings().then(loadedParkings => {
                console.log('✅ Parkings recargados con filtro:', loadedParkings.length);
                setParkings(loadedParkings);
            });
        }
    }, [userLocation, vehicleTypeFilter, isLoaded]);

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

    // Función para abrir el popup de un estacionamiento específico
    const openParkingPopup = (parkingId: number) => {
        const marker = markersRef.current.find(m => (m as any).parkingData?.id === parkingId);
        if (marker && window.google?.maps) {
            // Simular clic en el marcador para abrir el popup
            window.google.maps.event.trigger(marker, 'click');
        }
    };

    // Exponer función de ubicación y apertura de popup cuando el componente esté montado
    useEffect(() => {
        if (onLocationButtonClick) {
            (window as any).centerMapOnUserLocation = centerMapOnUserLocation;
        }
        // Exponer función global para abrir popup de estacionamiento
        (window as any).openParkingPopup = openParkingPopup;

        return () => {
            // Limpiar en unmount
            delete (window as any).centerMapOnUserLocation;
            delete (window as any).openParkingPopup;
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
        <div className="relative h-full w-full flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-white to-gray-50 border-b border-gray-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 rounded-full p-1.5">
                        <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">
                            Estacionamientos Disponibles
                        </h3>
                        <span className="text-lg font-bold text-blue-600">
                            {getFilteredParkings.length}
                        </span>
                    </div>
                </div>
            </div>

            {/* Contenido del mapa con flex-1 para ocupar altura restante */}
            <div className="relative flex-1">
                {/* Popup para solicitar ubicación */}
                {!userLocation && isLoaded && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg" role="dialog" aria-labelledby="location-prompt-title" aria-describedby="location-prompt-description">
                        <div className="bg-white border border-blue-200 rounded-2xl p-8 shadow-xl max-w-md mx-4 text-center min-h-[400px] flex flex-col justify-center">
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
                    className={className + " rounded-lg border border-gray-200 h-full"}
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
            <div className="px-6 py-3 bg-white border-t">
                <div className="flex items-center gap-4 text-xs" role="group" aria-label="Leyenda del mapa de estacionamientos">
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
            </div>
        </div>
    );
}
