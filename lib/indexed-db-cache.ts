import { ParkingHistory, Vehicle } from "./types";

// Definición de la estructura del almacenamiento
const DB_NAME = "parking_system_cache";
const DB_VERSION = 1;
const STORES = {
  VEHICLES: "vehicles",
  HISTORY: "history", 
  SETTINGS: "settings",
  API_CACHE: "api_cache"
};

// Promesa que se resolverá cuando la base de datos esté lista
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Inicializa la base de datos IndexedDB
 */
function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Tu navegador no soporta IndexedDB, necesario para el modo offline"));
      return;
    }
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    // Crear o actualizar la estructura de la DB
    request.onupgradeneeded = (event) => {
      const db = request.result;
      
      // Crear almacenes si no existen
      if (!db.objectStoreNames.contains(STORES.VEHICLES)) {
        const vehicleStore = db.createObjectStore(STORES.VEHICLES, { keyPath: "id" });
        vehicleStore.createIndex("by_license", "license_plate", { unique: true });
        vehicleStore.createIndex("by_user", "user_id", { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.HISTORY)) {
        const historyStore = db.createObjectStore(STORES.HISTORY, { keyPath: "id" });
        historyStore.createIndex("by_license", "license_plate", { unique: false });
        historyStore.createIndex("by_user", "user_id", { unique: false });
        historyStore.createIndex("by_exit_time", "exit_time", { unique: false });
      }
      
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "userId" });
      }
      
      if (!db.objectStoreNames.contains(STORES.API_CACHE)) {
        const cacheStore = db.createObjectStore(STORES.API_CACHE, { keyPath: "url" });
        cacheStore.createIndex("by_expiry", "expiry", { unique: false });
      }
    };
    
    request.onerror = (event) => {
      console.error("Error abriendo IndexedDB:", request.error);
      reject(request.error);
    };
    
    request.onsuccess = (event) => {
      resolve(request.result);
    };
  });
  
  return dbPromise;
}

/**
 * Guarda vehículos estacionados en IndexedDB
 */
export async function saveParkedVehicles(userId: string, vehicles: Vehicle[]): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.VEHICLES, "readwrite");
    const store = tx.objectStore(STORES.VEHICLES);
    
    // Primero borrar todos los vehículos del usuario
    const userIndex = store.index("by_user");
    const userVehiclesRequest = userIndex.getAll(userId);
    
    userVehiclesRequest.onsuccess = () => {
      const userVehicles = userVehiclesRequest.result;
      
      // Borrar los vehículos existentes
      userVehicles.forEach(vehicle => {
        store.delete(vehicle.id);
      });
      
      // Guardar los nuevos vehículos
      vehicles.forEach(vehicle => {
        store.put(vehicle);
      });
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error guardando vehículos en IndexedDB:", error);
    throw error;
  }
}

/**
 * Obtiene vehículos estacionados de IndexedDB
 */
export async function getParkedVehicles(userId: string): Promise<Vehicle[]> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.VEHICLES, "readonly");
    const store = tx.objectStore(STORES.VEHICLES);
    const index = store.index("by_user");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error obteniendo vehículos desde IndexedDB:", error);
    return [];
  }
}

/**
 * Guarda historial en IndexedDB
 */
export async function saveHistoryEntries(userId: string, entries: ParkingHistory[]): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.HISTORY, "readwrite");
    const store = tx.objectStore(STORES.HISTORY);
    
    // Guardar las entradas de historial
    entries.forEach(entry => {
      if (entry.user_id === userId) {
        store.put(entry);
      }
    });
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error guardando historial en IndexedDB:", error);
    throw error;
  }
}

/**
 * Obtiene historial de IndexedDB
 */
export async function getHistoryEntries(userId: string, limit = 50, page = 1): Promise<ParkingHistory[]> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.HISTORY, "readonly");
    const store = tx.objectStore(STORES.HISTORY);
    const index = store.index("by_user");
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const allEntries = request.result;
        
        // Ordenar por fecha de salida (descendente)
        allEntries.sort((a, b) => 
          new Date(b.exit_time).getTime() - new Date(a.exit_time).getTime()
        );
        
        // Aplicar paginación
        const offset = (page - 1) * limit;
        const paginatedEntries = allEntries.slice(offset, offset + limit);
        
        resolve(paginatedEntries);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error obteniendo historial desde IndexedDB:", error);
    return [];
  }
}

/**
 * Guarda respuestas de API en caché de IndexedDB
 */
export async function saveApiCache(url: string, data: any, expiry: number): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.API_CACHE, "readwrite");
    const store = tx.objectStore(STORES.API_CACHE);
    
    const cacheEntry = {
      url,
      data,
      expiry,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1
    };
    
    store.put(cacheEntry);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error guardando caché de API en IndexedDB:", error);
    throw error;
  }
}

/**
 * Obtiene respuesta de API desde caché de IndexedDB
 */
export async function getApiCache(url: string): Promise<{data: any, expiry: number} | null> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.API_CACHE, "readonly");
    const store = tx.objectStore(STORES.API_CACHE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(url);
      request.onsuccess = () => {
        const entry = request.result;
        if (entry && entry.expiry > Date.now()) {
          // Actualizar timestamp de acceso en una transacción separada
          updateCacheLastAccessed(url).catch(console.error);
          resolve({ data: entry.data, expiry: entry.expiry });
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Error obteniendo caché de API desde IndexedDB:", error);
    return null;
  }
}

/**
 * Actualiza el último acceso a una entrada de caché
 */
async function updateCacheLastAccessed(url: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.API_CACHE, "readwrite");
    const store = tx.objectStore(STORES.API_CACHE);
    
    const getRequest = store.get(url);
    
    getRequest.onsuccess = () => {
      const entry = getRequest.result;
      if (entry) {
        entry.lastAccessed = Date.now();
        entry.accessCount = (entry.accessCount || 0) + 1;
        store.put(entry);
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error actualizando acceso a caché:", error);
  }
}

/**
 * Elimina entradas de caché expiradas
 */
export async function pruneExpiredCache(): Promise<number> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.API_CACHE, "readwrite");
    const store = tx.objectStore(STORES.API_CACHE);
    const index = store.index("by_expiry");
    const now = Date.now();
    
    const range = IDBKeyRange.upperBound(now);
    const request = index.openCursor(range);
    
    let deletedCount = 0;
    
    request.onsuccess = (event) => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        deletedCount++;
        cursor.continue();
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(deletedCount);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error limpiando caché expirado:", error);
    return 0;
  }
}

/**
 * Invalidar una entrada específica o por patrón
 */
export async function invalidateIDBCache(urlPattern: string): Promise<number> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.API_CACHE, "readwrite");
    const store = tx.objectStore(STORES.API_CACHE);
    
    const request = store.openCursor();
    let deletedCount = 0;
    
    request.onsuccess = (event) => {
      const cursor = request.result;
      if (cursor) {
        const url = cursor.value.url;
        if (url.includes(urlPattern)) {
          store.delete(cursor.primaryKey);
          deletedCount++;
        }
        cursor.continue();
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(deletedCount);
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error invalidando caché de IndexedDB:", error);
    return 0;
  }
}

/**
 * Verifica si el navegador está online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Limpia todo el caché para un usuario específico
 */
export async function clearUserIDBCache(userId: string): Promise<void> {
  try {
    await Promise.all([
      invalidateIDBCache(`userId=${userId}`),
      clearUserVehicles(userId),
      clearUserHistory(userId)
    ]);
    console.log(`Caché de IndexedDB limpiado para usuario ${userId}`);
  } catch (error) {
    console.error("Error limpiando caché de IndexedDB:", error);
  }
}

/**
 * Limpia los vehículos de un usuario
 */
async function clearUserVehicles(userId: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.VEHICLES, "readwrite");
    const store = tx.objectStore(STORES.VEHICLES);
    const index = store.index("by_user");
    
    const request = index.openCursor(IDBKeyRange.only(userId));
    
    request.onsuccess = (event) => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error limpiando vehículos de IndexedDB:", error);
  }
}

/**
 * Limpia el historial de un usuario
 */
async function clearUserHistory(userId: string): Promise<void> {
  try {
    const db = await initDB();
    const tx = db.transaction(STORES.HISTORY, "readwrite");
    const store = tx.objectStore(STORES.HISTORY);
    const index = store.index("by_user");
    
    const request = index.openCursor(IDBKeyRange.only(userId));
    
    request.onsuccess = (event) => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Error limpiando historial de IndexedDB:", error);
  }
} 