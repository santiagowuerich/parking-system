import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface Parking {
    est_id: number;
    est_nombre: string;
    est_direc?: string;
    est_capacidad: number;
    plazas_total: number;
    plazas_ocupadas: number;
    plazas_libres: number;
    ingreso_hoy: number;
    vehiculos_activos: number;
}

interface User {
    usu_id: number;
    nombre_completo: string;
    email: string;
}

interface ParkingsData {
    estacionamientos: Parking[];
    usuario: User;
}

export function useParkings() {
    const [parkings, setParkings] = useState<Parking[]>([]);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchParkings = useCallback(async () => {
        // Evitar llamadas concurrentes
        if (loading) {
            logger.debug('fetchParkings: Ya hay una carga en progreso, omitiendo');
            return parkings;
        }

        try {
            setLoading(true);
            setError(null);

            logger.debug('Obteniendo lista de estacionamientos...');

            const response = await fetch('/api/auth/list-parkings');

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const data: ParkingsData = await response.json();

            setParkings(data.estacionamientos || []);
            setUser(data.usuario);

            logger.debug(`Parkings cargados: ${data.estacionamientos?.length || 0} estacionamientos para usuario ${data.usuario?.email}`);

            return data.estacionamientos || [];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
            logger.error('Error obteniendo parkings:', err);
            setError(errorMessage);
            return [];
        } finally {
            setLoading(false);
        }
    }, [loading, parkings]);

    const refreshParkings = useCallback(async () => {
        logger.debug('Refrescando parkings...');
        return await fetchParkings();
    }, [fetchParkings]);

    const getParkingById = useCallback((estId: number) => {
        return parkings.find(p => p.est_id === estId) || null;
    }, [parkings]);

    const clearParkings = useCallback(() => {
        logger.debug('Limpiando estado de parkings');
        setParkings([]);
        setUser(null);
        setError(null);
    }, []);

    return {
        parkings,
        user,
        loading,
        error,
        fetchParkings,
        refreshParkings,
        getParkingById,
        clearParkings
    };
}
