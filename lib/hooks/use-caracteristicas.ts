import { useState, useEffect, useCallback } from 'react';
import type { Caracteristica } from '@/lib/types';

const CACHE_KEY = 'caracteristicas_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

interface CacheData {
    data: Caracteristica[];
    timestamp: number;
}

export function useCaracteristicas() {
    const [caracteristicas, setCaracteristicas] = useState<Caracteristica[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Función para obtener datos del caché
    const getCachedData = useCallback((): Caracteristica[] | null => {
        if (typeof window === 'undefined') return null;

        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const cacheData: CacheData = JSON.parse(cached);
            const now = Date.now();

            // Verificar si el caché no ha expirado
            if (now - cacheData.timestamp < CACHE_DURATION) {
                return cacheData.data;
            } else {
                // Limpiar caché expirado
                localStorage.removeItem(CACHE_KEY);
                return null;
            }
        } catch (error) {
            console.warn('Error leyendo caché de características:', error);
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
    }, []);

    // Función para guardar datos en caché
    const setCachedData = useCallback((data: Caracteristica[]) => {
        if (typeof window === 'undefined') return;

        try {
            const cacheData: CacheData = {
                data,
                timestamp: Date.now()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Error guardando caché de características:', error);
        }
    }, []);

    // Función para cargar características
    const loadCaracteristicas = useCallback(async (forceRefresh = false) => {
        // Si no es refresh forzado, intentar usar caché primero
        if (!forceRefresh) {
            const cachedData = getCachedData();
            if (cachedData) {
                console.log('✅ Características cargadas desde caché');
                setCaracteristicas(cachedData);
                setLoading(false);
                setError(null);
                return cachedData;
            }
        }

        try {
            setLoading(true);
            setError(null);

            console.log('📡 Cargando características desde API...');
            const response = await fetch('/api/caracteristicas');

            if (!response.ok) {
                throw new Error('Error al cargar características');
            }

            const data = await response.json();
            const caracteristicasData = data.caracteristicas || [];

            // Guardar en caché
            setCachedData(caracteristicasData);

            setCaracteristicas(caracteristicasData);
            console.log('✅ Características cargadas desde API:', caracteristicasData.length);

            return caracteristicasData;

        } catch (err: any) {
            console.error('❌ Error cargando características:', err);
            setError(err.message || 'Error al cargar características');
            return [];
        } finally {
            setLoading(false);
        }
    }, [getCachedData, setCachedData]);

    // Función para refrescar datos (forzar recarga desde API)
    const refreshCaracteristicas = useCallback(async () => {
        console.log('🔄 Refrescando características...');
        return await loadCaracteristicas(true);
    }, [loadCaracteristicas]);

    // Función para limpiar caché
    const clearCache = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CACHE_KEY);
        }
        console.log('🗑️ Caché de características limpiado');
    }, []);

    // Función para verificar si hay datos en caché
    const hasCache = useCallback((): boolean => {
        return getCachedData() !== null;
    }, [getCachedData]);

    // Cargar datos al montar el componente
    useEffect(() => {
        loadCaracteristicas();
    }, [loadCaracteristicas]);

    return {
        caracteristicas,
        loading,
        error,
        loadCaracteristicas,
        refreshCaracteristicas,
        clearCache,
        hasCache
    };
}
