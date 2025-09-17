import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Zona {
    id: number;
    nombre: string;
    est_id: number;
}

interface Capacidad {
    Auto: number;
    Moto: number;
    Camioneta: number;
}

interface CreateZoneData {
    nombre: string;
    capacidad: Capacidad;
}

interface AssignPlazaData {
    zona_nombre: string;
    plaza_numeros: number[];
    est_id: number;
}

interface ConfiguracionZona {
    est_id: number;
    zona_nombre: string;
    cantidad_plazas?: number;
    filas?: number;
    columnas?: number;
    numeracion: {
        modo: 'reiniciar' | 'continuar';
    };
}

export function useZoneManagement(estId: number | null) {
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [loading, setLoading] = useState(false);

    // Cargar zonas existentes
    const fetchZonas = async () => {
        if (!estId) return;

        setLoading(true);
        try {
            const response = await fetch(`/api/zonas?est_id=${estId}`);
            if (!response.ok) throw new Error('Error al cargar zonas');

            const data = await response.json();
            const zonasArray = Array.isArray(data.zonas) ? data.zonas : [];
            setZonas(zonasArray);

            console.log('📊 Zonas cargadas:', zonasArray);
        } catch (error: any) {
            console.error('❌ Error al cargar zonas:', error);
            toast.error('Error', { description: error.message });
            setZonas([]);
        } finally {
            setLoading(false);
        }
    };

    // Crear zona con plazas automáticas
    const createZoneWithPlazas = async (data: CreateZoneData) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        if (!data.nombre.trim()) {
            throw new Error('Ingresa un nombre para la zona');
        }

        const totalPlazas = Object.values(data.capacidad).reduce((a, b) => a + b, 0);
        if (totalPlazas === 0) {
            throw new Error('Especifica al menos una plaza para crear');
        }

        const response = await fetch('/api/zonas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zona_nombre: data.nombre,
                est_id: estId,
                capacidad: data.capacidad
            }),
        });

        const result = await response.json();

        if (!response.ok) throw new Error(result.error || 'No se pudo crear la zona');

        return result;
    };

    // Renombrar zona
    const renameZone = async (zonaAntigua: string, zonaNueva: string) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        const response = await fetch('/api/zonas', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                zona_antigua,
                zona_nueva,
                est_id: estId
            }),
        });

        if (!response.ok) throw new Error('No se pudo renombrar la zona');
    };

    // Eliminar zona
    const deleteZone = async (zonaNombre: string) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        const response = await fetch('/api/zonas', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ zona_nombre: zonaNombre, est_id: estId }),
        });

        if (!response.ok) throw new Error('No se pudo eliminar la zona');
    };

    // Asignar plazas a zona
    const assignPlazasToZone = async (data: AssignPlazaData) => {
        if (!data.zona_nombre || data.plaza_numeros.length === 0) {
            throw new Error('Selecciona una zona y al menos una plaza');
        }

        const response = await fetch('/api/zonas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('No se pudieron asignar las plazas');
    };

    // Configurar zona completa (para página dedicada)
    const configureZoneComplete = async (config: ConfiguracionZona) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        const response = await fetch('/api/zonas/configurar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || 'Error al crear la zona');
        }

        return responseData;
    };

    // Verificar si zona existe
    const checkZoneExists = async (nombreZona: string): Promise<boolean> => {
        if (!estId) return false;

        try {
            const response = await fetch(`/api/zonas?est_id=${estId}`);
            if (response.ok) {
                const data = await response.json();
                return data.zonas?.some((zona: any) => zona.zona_nombre === nombreZona) || false;
            }
            return false;
        } catch (error) {
            console.error('Error verificando zona existente:', error);
            return false;
        }
    };

    // Cargar información de zona específica
    const loadZoneInfo = async (zonaNombre: string) => {
        if (!estId) throw new Error('Estacionamiento no disponible');

        const response = await fetch(`/api/zonas?zona=${encodeURIComponent(zonaNombre)}&est_id=${estId}`);

        if (!response.ok) {
            throw new Error('Error al cargar información de la zona');
        }

        const data = await response.json();

        if (!data.success || !data.zona) {
            throw new Error("No se pudo cargar la información de la zona");
        }

        return data.zona;
    };

    useEffect(() => {
        if (estId) {
            fetchZonas();
        }
    }, [estId]);

    return {
        zonas,
        loading,
        fetchZonas,
        createZoneWithPlazas,
        renameZone,
        deleteZone,
        assignPlazasToZone,
        configureZoneComplete,
        checkZoneExists,
        loadZoneInfo
    };
}
