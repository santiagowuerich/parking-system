import { Parking, UserSettings, Capacity, Rates, ParkingHistory, Vehicle } from "./types";
import * as IDBCache from "./indexed-db-cache";

// Almacenamiento de caché
interface ApiCache {
  expiry: number;
  data: any;
  timestamp: number; // Añadir timestamp para estadísticas
  lastAccessed?: number; // Para métricas de uso
  accessCount?: number; // Para métricas de uso
}

// Caché global para datos de API
const apiCache: Record<string, ApiCache> = {};

// Seguimiento de solicitudes en curso
const pendingRequests: Record<string, Promise<any>> = {};

// Métricas del caché
const cacheMetrics = {
  hits: 0,
  misses: 0,
  pendingReuse: 0,
  evictions: 0,
  idbHits: 0, // Nuevas métricas para IndexedDB
  idbMisses: 0
};

// Tiempo de caducidad del caché (2 minutos para dashboard, 5 minutos para el resto)
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;
const DASHBOARD_CACHE_TTL = 2 * 60 * 1000;

// Tamaño máximo del caché (entradas)
const MAX_CACHE_SIZE = 100;

// Función para limpiar entradas expiradas o reducir el tamaño del caché
function pruneCache() {
  const now = Date.now();
  const entries = Object.entries(apiCache);
  
  // Primero eliminar entradas expiradas
  let expiredCount = 0;
  for (const [key, entry] of entries) {
    if (entry.expiry < now) {
      delete apiCache[key];
      expiredCount++;
    }
  }
  
  // Si el caché sigue siendo demasiado grande, eliminar las entradas menos usadas
  if (Object.keys(apiCache).length > MAX_CACHE_SIZE) {
    const remainingEntries = Object.entries(apiCache)
      .sort((a, b) => {
        // Ordenar por número de accesos y último acceso
        const accessCountDiff = (a[1].accessCount || 0) - (b[1].accessCount || 0);
        if (accessCountDiff !== 0) return accessCountDiff;
        return (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0);
      });
      
    // Eliminar el 20% de las entradas menos usadas
    const toRemove = Math.ceil(remainingEntries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      if (i < remainingEntries.length) {
        delete apiCache[remainingEntries[i][0]];
        cacheMetrics.evictions++;
      }
    }
  }
  
  return expiredCount;
}

// Función para obtener datos de API con caché (ahora con soporte IndexedDB)
export async function fetchWithCache<T>(
  url: string, 
  options?: RequestInit, 
  forceFresh = false
): Promise<T> {
  const cacheKey = url;
  const now = Date.now();
  const isDashboard = url.includes('/api/dashboard');
  const cacheTTL = isDashboard ? DASHBOARD_CACHE_TTL : DEFAULT_CACHE_TTL;
  
  // Verificar si hay datos en caché en memoria y si son válidos
  if (
    !forceFresh && 
    apiCache[cacheKey] && 
    apiCache[cacheKey].expiry > now
  ) {
    cacheMetrics.hits++;
    
    // Actualizar métricas de uso
    apiCache[cacheKey].lastAccessed = now;
    apiCache[cacheKey].accessCount = (apiCache[cacheKey].accessCount || 0) + 1;
    
    console.log(`[CACHÉ-MEM] Usando datos en caché para: ${url} (${Math.round((now - apiCache[cacheKey].timestamp)/1000)}s antiguos)`);
    return apiCache[cacheKey].data as T;
  }

  // Verificar si ya hay una solicitud en curso para este URL
  if (pendingRequests[cacheKey] !== undefined) {
    cacheMetrics.pendingReuse++;
    console.log(`[PENDIENTE] Reusando solicitud existente para: ${url}`);
    return pendingRequests[cacheKey] as Promise<T>;
  }

  // Si no está en memoria, verificar en IndexedDB
  if (!forceFresh) {
    try {
      const idbCacheData = await IDBCache.getApiCache(url);
      if (idbCacheData && idbCacheData.expiry > now) {
        cacheMetrics.idbHits++;
        console.log(`[CACHÉ-IDB] Usando datos en IndexedDB para: ${url}`);
        
        // También actualizar la caché en memoria
        apiCache[cacheKey] = {
          expiry: idbCacheData.expiry,
          data: idbCacheData.data,
          timestamp: now - (idbCacheData.expiry - now), // Estimación aproximada
          lastAccessed: now,
          accessCount: 1
        };
        
        return idbCacheData.data as T;
      } else {
        cacheMetrics.idbMisses++;
      }
    } catch (error) {
      console.error("Error al intentar leer caché de IndexedDB:", error);
    }
  }

  // Si el caché está demasiado grande, limpiarlo
  if (Object.keys(apiCache).length > MAX_CACHE_SIZE) {
    const removed = pruneCache();
    if (removed > 0) {
      console.log(`[CACHÉ] Limpieza automática: ${removed} entradas expiradas eliminadas`);
    }
  }

  // Verificar si estamos offline
  if (!navigator.onLine) {
    console.warn(`[OFFLINE] Dispositivo sin conexión. No se puede acceder a ${url}`);
    throw new Error("Sin conexión a Internet. Intenta más tarde.");
  }

  // Si no hay caché o está expirado, realizar la llamada a la API
  cacheMetrics.misses++;
  console.log(`[NUEVA] Realizando solicitud a API: ${url}`);
  
  // Crear la nueva solicitud y almacenarla en pendingRequests
  const fetchPromise = new Promise<T>(async (resolve, reject) => {
    try {
      const requestStart = performance.now();
      const response = await fetch(url, options);
      const requestTime = Math.round(performance.now() - requestStart);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errorData.error || `Error al obtener datos: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[COMPLETADA] Respuesta recibida de ${url} en ${requestTime}ms`);
      
      const expiryTime = now + cacheTTL;
      
      // Almacenar en caché de memoria
      apiCache[cacheKey] = {
        expiry: expiryTime,
        data,
        timestamp: now,
        lastAccessed: now,
        accessCount: 1
      };
      
      // También guardar en IndexedDB para persistencia
      try {
        await IDBCache.saveApiCache(url, data, expiryTime);
        console.log(`[CACHÉ-IDB] Guardado en IndexedDB: ${url}`);
      } catch (idbError) {
        console.error("Error al guardar en IndexedDB:", idbError);
      }
      
      resolve(data as T);
    } catch (error) {
      reject(error);
    } finally {
      // Eliminar esta solicitud de las pendientes una vez completada
      delete pendingRequests[cacheKey];
    }
  });
  
  // Registrar esta solicitud como pendiente
  pendingRequests[cacheKey] = fetchPromise;
  
  return fetchPromise;
}

// Limpiar caché para un usuario específico (útil al cerrar sesión)
export function clearUserCache(userId: string) {
  let clearedEntries = 0;
  Object.keys(apiCache).forEach(key => {
    if (key.includes(`userId=${userId}`)) {
      delete apiCache[key];
      clearedEntries++;
    }
  });
  
  // También limpiar caché de IndexedDB
  IDBCache.clearUserIDBCache(userId).catch(error => {
    console.error("Error al limpiar caché de IndexedDB:", error);
  });
  
  console.log(`🧹 Caché limpiado para usuario ${userId}: ${clearedEntries} entradas eliminadas`);
}

// Función para actualizar el caché después de cambios
export function updateCache(url: string, newDataOrFn: any | ((prevData: any) => any)) {
  let dataToStore: any;
  let cacheEntryExists = apiCache[url] !== undefined;

  if (typeof newDataOrFn === 'function') {
    if (cacheEntryExists) {
      dataToStore = newDataOrFn(apiCache[url].data);
    } else {
      // Si la entrada no existe en la caché en memoria,
      // podríamos intentar cargarla desde IDB, pasarla a la función,
      // o simplemente no hacer nada si la función depende de datos previos.
      // Por ahora, si no existe y es una función, no actualizaremos para evitar errores.
      // Opcionalmente, la función podría ser diseñada para devolver `undefined` si no puede operar sin datos previos.
      console.warn(`[CACHÉ-MEM] updateCache fue llamado con una función para ${url}, pero no hay entrada en caché en memoria.`);
      // dataToStore = newDataOrFn(undefined); // Si la función puede manejar esto
      // Alternativamente, podríamos decidir no guardar en IndexedDB si la caché en memoria no existe.
      // Para el caso actual con DataCloneError, es crucial que dataToStore no sea una función.
      // Si la función updater devuelve undefined, no la almacenamos.
      const result = newDataOrFn(undefined);
      if (result === undefined) {
          // No actualizamos la caché si la función updater devuelve undefined
          // y no había datos previos en la caché en memoria.
          // Podríamos también optar por no intentar guardar en IDB en este caso.
          return; 
      }
      dataToStore = result;
    }
  } else {
    dataToStore = newDataOrFn;
  }

  // Si después de procesar la función, dataToStore es undefined (y la función lo devolvió así), no hacemos nada.
  if (dataToStore === undefined && typeof newDataOrFn === 'function') {
      console.log(`[CACHÉ-MEM] La función de actualización para ${url} devolvió undefined. No se actualiza la caché.`);
      return;
  }
  
  const now = Date.now();
  const expiry = now + (url.includes('/api/dashboard') ? DASHBOARD_CACHE_TTL : DEFAULT_CACHE_TTL);

  // Actualizar caché en memoria (o crear si no existía y newDataOrFn era valor directo)
  if (cacheEntryExists || typeof newDataOrFn !== 'function') {
      apiCache[url] = {
        ...(apiCache[url] || {}), // Conserva timestamp original si solo se actualizan datos
        data: dataToStore,
        expiry: expiry,
        timestamp: cacheEntryExists ? apiCache[url].timestamp : now, // Conservar timestamp original si la entrada existía
        lastAccessed: now,
        accessCount: ((apiCache[url]?.accessCount || 0) + 1)
      };
      console.log(`[CACHÉ-MEM] ${cacheEntryExists ? 'Actualizada' : 'Creada'} entrada: ${url}`);
  } else if (!cacheEntryExists && typeof newDataOrFn === 'function' && dataToStore !== undefined) {
      // Caso donde la caché no existía en memoria, pero la función de actualización produjo datos válidos.
      apiCache[url] = {
        data: dataToStore,
        expiry: expiry,
        timestamp: now,
        lastAccessed: now,
        accessCount: 1
      };
      console.log(`[CACHÉ-MEM] Creada nueva entrada vía función de actualización: ${url}`);
  }


  // Solo intentamos guardar en IDB si dataToStore no es undefined
  if (dataToStore !== undefined) {
    IDBCache.saveApiCache(url, dataToStore, expiry)
      .then(() => console.log(`[CACHÉ-IDB] Actualizada/Guardada entrada: ${url}`))
      .catch(error => console.error("Error actualizando/guardando en IndexedDB:", error));
  }
}

// Función para invalidar una entrada específica de caché
export function invalidateCache(url: string) {
  let invalidated = false;
  
  if (apiCache[url]) {
    delete apiCache[url];
    invalidated = true;
    console.log(`🗑️ Invalidada entrada de caché (memoria): ${url}`);
  }
  
  // También invalidar en IndexedDB
  IDBCache.invalidateIDBCache(url)
    .then(count => {
      if (count > 0) {
        console.log(`🗑️ Invalidada entrada de caché (IndexedDB): ${url}`);
        invalidated = true;
      }
    })
    .catch(error => console.error("Error invalidando caché de IndexedDB:", error));
  
  return invalidated;
}

// Función para invalidar entradas de caché por patrón
export function invalidateCacheByPattern(pattern: string) {
  let invalidatedCount = 0;
  Object.keys(apiCache).forEach(key => {
    if (key.includes(pattern)) {
      delete apiCache[key];
      invalidatedCount++;
    }
  });
  
  // También invalidar en IndexedDB
  IDBCache.invalidateIDBCache(pattern)
    .then(count => {
      console.log(`🧹 Caché de IndexedDB invalidado por patrón "${pattern}": ${count} entradas`);
      invalidatedCount += count;
    })
    .catch(error => console.error("Error invalidando caché de IndexedDB:", error));
  
  console.log(`🧹 Caché de memoria invalidado por patrón "${pattern}": ${invalidatedCount} entradas eliminadas`);
  return invalidatedCount;
}

// Para depuración - obtener estado actual de caché
export async function getCacheState() {
  try {
    await IDBCache.pruneExpiredCache();
  } catch (error) {
    console.error("Error al limpiar caché expirado de IndexedDB:", error);
  }
  
  return {
    cacheEntries: Object.keys(apiCache).length,
    pendingRequests: Object.keys(pendingRequests).length,
    cacheKeys: Object.keys(apiCache),
    pendingKeys: Object.keys(pendingRequests),
    metrics: { ...cacheMetrics },
    isOnline: navigator.onLine
  };
} 