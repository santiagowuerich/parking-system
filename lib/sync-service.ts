import { Vehicle, ParkingHistory } from "./types";

// Tipos para las operaciones pendientes
export type PendingOperation = {
  id: string;
  type: 'entry' | 'exit' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retries: number;
};

// Almacenamiento para operaciones pendientes (en memoria mientras la app está corriendo)
let pendingOperations: PendingOperation[] = [];

// ID para sincronización en progreso
let syncInProgress: boolean = false;

// Callback para notificar cambios en el estado de sincronización
let syncStatusCallback: ((pending: boolean) => void) | null = null;

// Registrar el callback de estado
export function registerSyncCallback(callback: (pending: boolean) => void) {
  syncStatusCallback = callback;
}

// Agregar una operación de entrada de vehículo pendiente
export function addPendingEntry(vehicle: Omit<Vehicle, 'id'>) {
  const operation: PendingOperation = {
    id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: 'entry',
    data: vehicle,
    timestamp: Date.now(),
    retries: 0
  };
  
  pendingOperations.push(operation);
  console.log(`[SYNC] Agregada operación pendiente de entrada: ${operation.id}`);
  notifySyncStatus();
  
  return operation.id;
}

// Agregar una operación de salida de vehículo pendiente
export function addPendingExit(licensePlate: string, userId: string, fee: number, paymentMethod: string) {
  const operation: PendingOperation = {
    id: `exit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: 'exit',
    data: {
      licensePlate,
      userId,
      fee,
      paymentMethod,
      exitTime: new Date().toISOString()
    },
    timestamp: Date.now(),
    retries: 0
  };
  
  pendingOperations.push(operation);
  console.log(`[SYNC] Agregada operación pendiente de salida: ${operation.id}`);
  notifySyncStatus();
  
  return operation.id;
}

// Agregar una operación de actualización de historial pendiente
export function addPendingHistoryUpdate(entry: ParkingHistory) {
  const operation: PendingOperation = {
    id: `update_${entry.id}`,
    type: 'update',
    data: entry,
    timestamp: Date.now(),
    retries: 0
  };
  
  // Evitar duplicados (si ya hay una actualización pendiente para este id, reemplazarla)
  const existingIndex = pendingOperations.findIndex(op => op.id === operation.id);
  if (existingIndex >= 0) {
    pendingOperations[existingIndex] = operation;
    console.log(`[SYNC] Actualizada operación pendiente: ${operation.id}`);
  } else {
    pendingOperations.push(operation);
    console.log(`[SYNC] Agregada operación pendiente de actualización: ${operation.id}`);
  }
  
  notifySyncStatus();
  return operation.id;
}

// Agregar una operación de eliminación de historial pendiente
export function addPendingDelete(entryId: string, userId: string) {
  const operation: PendingOperation = {
    id: `delete_${entryId}`,
    type: 'delete',
    data: { entryId, userId },
    timestamp: Date.now(),
    retries: 0
  };
  
  // Evitar duplicados
  const existingIndex = pendingOperations.findIndex(op => op.id === operation.id);
  if (existingIndex >= 0) {
    pendingOperations[existingIndex] = operation;
  } else {
    pendingOperations.push(operation);
    console.log(`[SYNC] Agregada operación pendiente de eliminación: ${operation.id}`);
  }
  
  notifySyncStatus();
  return operation.id;
}

// Obtener todas las operaciones pendientes
export function getPendingOperations(): PendingOperation[] {
  return [...pendingOperations];
}

// Eliminar una operación pendiente por ID
export function removePendingOperation(id: string): boolean {
  const initialLength = pendingOperations.length;
  pendingOperations = pendingOperations.filter(op => op.id !== id);
  const removed = pendingOperations.length < initialLength;
  
  if (removed) {
    console.log(`[SYNC] Eliminada operación pendiente: ${id}`);
    notifySyncStatus();
  }
  
  return removed;
}

// Verificar si hay operaciones pendientes
export function hasPendingOperations(): boolean {
  return pendingOperations.length > 0;
}

// Notificar al UI sobre cambios en el estado de sincronización
function notifySyncStatus() {
  if (syncStatusCallback) {
    syncStatusCallback(pendingOperations.length > 0);
  }
}

// Intentar sincronizar operaciones pendientes
export async function syncPendingOperations(): Promise<{ success: number; failed: number }> {
  if (syncInProgress || pendingOperations.length === 0 || !navigator.onLine) {
    return { success: 0, failed: 0 };
  }
  
  syncInProgress = true;
  console.log(`[SYNC] Iniciando sincronización de ${pendingOperations.length} operaciones pendientes`);
  
  let successCount = 0;
  let failedCount = 0;
  
  // Crear una copia para iterar mientras posiblemente modificamos el array original
  const operations = [...pendingOperations];
  
  for (const operation of operations) {
    try {
      let success = false;
      
      switch (operation.type) {
        case 'entry':
          success = await syncEntryOperation(operation);
          break;
        case 'exit':
          success = await syncExitOperation(operation);
          break;
        case 'update':
          success = await syncUpdateOperation(operation);
          break;
        case 'delete':
          success = await syncDeleteOperation(operation);
          break;
      }
      
      if (success) {
        removePendingOperation(operation.id);
        successCount++;
      } else {
        // Incrementar intentos
        const opIndex = pendingOperations.findIndex(op => op.id === operation.id);
        if (opIndex >= 0) {
          pendingOperations[opIndex].retries++;
          
          // Si demasiados intentos, tal vez descartar
          if (pendingOperations[opIndex].retries > 5) {
            console.error(`[SYNC] Demasiados intentos fallidos para operación ${operation.id}, descartando`);
            removePendingOperation(operation.id);
          }
        }
        failedCount++;
      }
    } catch (error) {
      console.error(`[SYNC] Error sincronizando operación ${operation.id}:`, error);
      failedCount++;
    }
  }
  
  syncInProgress = false;
  console.log(`[SYNC] Sincronización completada. Éxitos: ${successCount}, Fallos: ${failedCount}`);
  notifySyncStatus();
  
  return { success: successCount, failed: failedCount };
}

// Sincronizar una operación de entrada de vehículo
async function syncEntryOperation(operation: PendingOperation): Promise<boolean> {
  try {
    const response = await fetch("/api/parking/entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operation.data),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al registrar entrada");
    }
    
    return true;
  } catch (error) {
    console.error(`[SYNC] Error sincronizando entrada: ${error}`);
    return false;
  }
}

// Sincronizar una operación de salida de vehículo
async function syncExitOperation(operation: PendingOperation): Promise<boolean> {
  try {
    const response = await fetch("/api/parking/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(operation.data),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al registrar salida");
    }
    
    return true;
  } catch (error) {
    console.error(`[SYNC] Error sincronizando salida: ${error}`);
    return false;
  }
}

// Sincronizar una operación de actualización de historial
async function syncUpdateOperation(operation: PendingOperation): Promise<boolean> {
  try {
    const historyEntry = operation.data;
    const response = await fetch(`/api/parking/history/${historyEntry.id}?userId=${historyEntry.user_id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(historyEntry),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Error al actualizar historial");
    }
    
    return true;
  } catch (error) {
    console.error(`[SYNC] Error sincronizando actualización: ${error}`);
    return false;
  }
}

// Sincronizar una operación de eliminación de historial
async function syncDeleteOperation(operation: PendingOperation): Promise<boolean> {
  try {
    const { entryId, userId } = operation.data;
    const response = await fetch(`/api/parking/history/${entryId}?userId=${userId}`, {
      method: "DELETE",
    });
    
    if (!response.ok) {
      throw new Error("Error al eliminar registro del historial");
    }
    
    return true;
  } catch (error) {
    console.error(`[SYNC] Error sincronizando eliminación: ${error}`);
    return false;
  }
}

// Auto-iniciar el listener para sincronización cuando vuelve la conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SYNC] Conexión recuperada, intentando sincronizar operaciones pendientes');
    setTimeout(() => {
      syncPendingOperations().catch(console.error);
    }, 2000); // Pequeño delay para asegurar que la conexión es estable
  });
} 