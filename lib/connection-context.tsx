"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "@/components/ui/use-toast";

interface ConnectionState {
  isOnline: boolean;
  lastOnline: Date | null;
  syncPending: boolean;
}

interface ConnectionContextType {
  connection: ConnectionState;
  updateSyncStatus: (pending: boolean) => void;
}

// Valor por defecto del contexto
const defaultConnectionState: ConnectionState = {
  isOnline: true, // Cambiamos el valor predeterminado para evitar discrepancias
  lastOnline: null,
  syncPending: false
};

// Crear el contexto
const ConnectionContext = createContext<ConnectionContextType>({
  connection: defaultConnectionState,
  updateSyncStatus: () => {}
});

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<ConnectionState>(defaultConnectionState);
  const [isMounted, setIsMounted] = useState(false);

  // Manejar cambios en la conexión
  useEffect(() => {
    setIsMounted(true);
    
    // Actualizar estado de conexión inicial después del montaje para evitar hidratación incorrecta
    setConnection(prev => ({
      ...prev,
      isOnline: navigator.onLine,
      lastOnline: navigator.onLine ? new Date() : null
    }));
    
    const handleOnline = () => {
      setConnection(prev => ({
        ...prev,
        isOnline: true,
        lastOnline: new Date()
      }));
      
      toast({
        title: "Conexión restaurada",
        description: "Se ha restablecido la conexión a Internet. Sincronizando...",
        variant: "default"
      });
    };

    const handleOffline = () => {
      setConnection(prev => ({
        ...prev,
        isOnline: false
      }));
      
      toast({
        title: "Sin conexión",
        description: "Trabajando en modo offline. Tus cambios se sincronizarán cuando vuelvas a tener conexión.",
        variant: "destructive"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Función para actualizar el estado de sincronización
  const updateSyncStatus = (pending: boolean) => {
    setConnection(prev => ({
      ...prev,
      syncPending: pending
    }));
  };

  return (
    <ConnectionContext.Provider value={{ connection, updateSyncStatus }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnection debe usarse dentro de un ConnectionProvider");
  }
  return context;
};

// Componente visual que muestra el estado de conexión
export function ConnectionStatus() {
  const { connection } = useConnection();
  const [isMounted, setIsMounted] = useState(false);
  
  // Evitar renderizado durante SSR
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // No renderizar nada durante SSR para evitar hidratación incorrecta
  if (!isMounted) return null;
  
  // A partir de aquí solo se ejecuta en el cliente
  if (connection.isOnline && !connection.syncPending) return null;
  
  return (
    <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-md
      ${connection.isOnline 
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' 
        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
      }`}>
      {!connection.isOnline ? (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
          Sin conexión - Modo offline
        </span>
      ) : connection.syncPending ? (
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
          Sincronizando cambios...
        </span>
      ) : null}
    </div>
  );
} 