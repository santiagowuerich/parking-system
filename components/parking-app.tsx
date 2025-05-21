"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OperatorPanel from "@/components/operator-panel";
import AdminPanel from "@/components/admin-panel";
import SettingsPanel from "@/components/rates-panel";
import type { Parking, Vehicle, ParkingHistory, VehicleType, Capacity, Rates, ExitInfo, UserSettings } from "@/lib/types";
import { calculateFee, formatDuration } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/lib/auth-context";
import { PaymentMethodDialog } from "./payment-method-dialog";
import { toast } from "@/components/ui/use-toast";
import { QRDialog } from "./qr-dialog";
import { Loader2 } from "lucide-react";
import dayjs from "dayjs";
import utcPlugin from "dayjs/plugin/utc";
import { TransferInfoDialog } from "./ui/transfer-info-dialog";
import { fetchWithCache, clearUserCache, updateCache, getCacheState, invalidateCache } from "@/lib/api-cache";
import { Button } from "@/components/ui/button";
import { useConnection } from "@/lib/connection-context";
import * as IDBCache from "@/lib/indexed-db-cache";
import * as SyncService from "@/lib/sync-service";

dayjs.extend(utcPlugin);

// Define la estructura inicial del estado del parking
const initialParkingState: Parking = {
  capacity: { Auto: 0, Moto: 0, Camioneta: 0 },
  rates: { Auto: 0, Moto: 0, Camioneta: 0 },
  parkedVehicles: [],
  history: [],
};

export default function ParkingApp() {
  const { user, loading: authLoading, supabase } = useAuth();
  const [parking, setParking] = useState<Parking>(initialParkingState);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);

  const [exitInfo, setExitInfo] = useState<ExitInfo | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrData, setQrData] = useState<{ code: string; fee: number; qrCodeBase64?: string } | null>(null);
  
  const [loadingInitialData, setLoadingInitialData] = useState(true);
  const [initialDataFetched, setInitialDataFetched] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paymentMethodDialogOpen, setPaymentMethodDialogOpen] = useState(false);
  const [exitingVehicle, setExitingVehicle] = useState<Vehicle | null>(null);
  const [paymentConfirmationOpen, setPaymentConfirmationOpen] = useState(false);
  const [lastCalculatedFee, setLastCalculatedFee] = useState(0);
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [showTransferInfoDialog, setShowTransferInfoDialog] = useState(false);

  // Estado para debug de cache
  const [cacheDebug, setCacheDebug] = useState<any>(null);
  
  // Añadir un estado para el control de paginación del historial
  const [historyPagination, setHistoryPagination] = useState({
    page: 1,
    limit: 50,
    hasMore: true,
    total: 0,
    loading: false
  });

  const { connection, updateSyncStatus } = useConnection();
  const [offlineMode, setOfflineMode] = useState(false);

  // Registrar montaje/desmontaje para detectar múltiples instancias
  useEffect(() => {
    console.log('🔄 ParkingApp - MONTADO');
    
    return () => {
      console.log('🔄 ParkingApp - DESMONTADO');
    };
  }, []);

  useEffect(() => {
    if (!user && !authLoading && initialDataFetched) {
      clearUserCache("");
      setInitialDataFetched(false);
    }
  }, [user, authLoading, initialDataFetched]);

  // Agregar un efecto para monitorear el estado del caché
  useEffect(() => {
    // Actualizar el estado de debug del caché cada 2 segundos
    const intervalId = setInterval(() => {
      setCacheDebug(getCacheState());
    }, 2000);

    // Imprimir el estado inicial del caché
    console.log('Estado inicial del caché:', getCacheState());

    return () => clearInterval(intervalId);
  }, []);

  // Modificar la carga del historial para soportar paginación
  const fetchHistoryWithPagination = useCallback(async (userId: string, page = 1, append = false) => {
    if (historyPagination.loading || (page > 1 && !historyPagination.hasMore)) {
      return;
    }

    try {
      console.log(`📊 Cargando historial (página ${page})...`);
      setHistoryPagination(prev => ({ ...prev, loading: true }));
      
      const historyStart = performance.now();
      
      // Verificar si estamos en modo offline
      if (!navigator.onLine || offlineMode) {
        console.log(`📱 Modo offline - cargando historial desde IndexedDB`);
        const offlineHistory = await IDBCache.getHistoryEntries(userId, historyPagination.limit, page);
        
        const newHistory = offlineHistory || [];
        
        // Actualizar el estado del historial (añadir o reemplazar)
        setParking(prev => ({
          ...prev,
          history: append 
            ? [...prev.history, ...newHistory] 
            : newHistory,
        }));
        
        // Actualizar estado de paginación
        setHistoryPagination(prev => ({
          ...prev,
          page,
          hasMore: newHistory.length >= historyPagination.limit,
          total: prev.total || newHistory.length * 2, // Estimación aproximada
          loading: false
        }));
        
        const historyLoadTime = Math.round(performance.now() - historyStart);
        console.log(`📊 Historial offline (página ${page}) cargado en ${historyLoadTime}ms (${newHistory.length} registros)`);
        return;
      }
      
      // Modo online normal
      const historyData = await fetchWithCache<{
        history: ParkingHistory[],
        pagination: {
          page: number,
          limit: number,
          total: number | null,
          hasMore: boolean
        },
        _metrics?: { executionTime: number }
      }>(`/api/dashboard/history?userId=${userId}&page=${page}&limit=${historyPagination.limit}`);
      
      const newHistory = historyData.history || [];
      
      // Guardar los datos en IndexedDB para acceso offline
      if (newHistory && newHistory.length > 0) {
        IDBCache.saveHistoryEntries(userId, newHistory)
          .catch(error => console.error("Error guardando historial en IndexedDB:", error));
      }
      
      // Actualizar el estado del historial (añadir o reemplazar)
      setParking(prev => ({
        ...prev,
        history: append 
          ? [...prev.history, ...newHistory] 
          : newHistory,
      }));
      
      // Actualizar estado de paginación
      setHistoryPagination(prev => ({
        ...prev,
        page,
        hasMore: historyData.pagination.hasMore,
        total: historyData.pagination.total || prev.total,
        loading: false
      }));
      
      const historyLoadTime = Math.round(performance.now() - historyStart);
      console.log(`📊 Historial (página ${page}) cargado en ${historyLoadTime}ms (${newHistory.length} registros)`);
      if (historyData._metrics) {
        console.log(`⚡ Tiempo de ejecución del servidor: ${historyData._metrics.executionTime}ms`);
      }
    } catch (historyError) {
      console.error("⚠️ Error al cargar historial:", historyError);
      toast({ 
        title: "Advertencia", 
        description: "Ocurrió un error al cargar el historial",
        variant: "default"
      });
      setHistoryPagination(prev => ({ ...prev, loading: false }));
    }
  }, [historyPagination.limit, historyPagination.loading, historyPagination.hasMore, offlineMode]);

  // Función para cargar más historial (llamada desde el botón "Cargar más")
  const loadMoreHistory = useCallback(() => {
    if (!user?.id || historyPagination.loading || !historyPagination.hasMore) return;
    
    const nextPage = historyPagination.page + 1;
    fetchHistoryWithPagination(user.id, nextPage, true);
  }, [user?.id, historyPagination.page, historyPagination.loading, historyPagination.hasMore, fetchHistoryWithPagination]);

  // Modificar la función fetchInitialData para intentar usar datos offline si no hay conexión
  const fetchInitialData = useCallback(async (userId: string) => {
    const startTime = performance.now();
    setLoadingInitialData(true);
    
    console.log('🔍 Iniciando carga de datos para usuario:', userId);
    console.log('Estado actual del caché:', await getCacheState());
    
    // Verificar si estamos online
    const isOnline = navigator.onLine;
    setOfflineMode(!isOnline);
    
    try {
      if (!isOnline) {
        // Modo offline - intentar cargar desde IndexedDB
        console.log('📱 Modo offline - intentando cargar desde almacenamiento local');
        updateSyncStatus(true);
        
        try {
          // Cargar vehículos desde el almacenamiento local
          const vehicles = await IDBCache.getParkedVehicles(userId);
          console.log(`⚡ Cargados ${vehicles.length} vehículos desde IndexedDB`);
          
          // Obtener datos de settings/capacidad/rates desde la caché
          const cachedSettingsData = await IDBCache.getApiCache(`/api/dashboard/essential?userId=${userId}`);
          
          if (cachedSettingsData && cachedSettingsData.data) {
            const { capacity, rates, userSettings } = cachedSettingsData.data;
            
            // Actualizar UI con datos de caché
            setUserSettings(userSettings);
            setParking(prev => ({
              ...prev,
              capacity: capacity || prev.capacity,
              rates: rates || prev.rates,
              parkedVehicles: vehicles,
            }));
            
            // Cargar historial si está disponible
            try {
              const historyEntries = await IDBCache.getHistoryEntries(userId, historyPagination.limit, 1);
              console.log(`⚡ Cargados ${historyEntries.length} registros de historial desde IndexedDB`);
              
              setParking(prev => ({
                ...prev,
                history: historyEntries,
              }));
              
              setHistoryPagination(prev => ({
                ...prev,
                total: historyEntries.length,
                hasMore: historyEntries.length >= prev.limit
              }));
            } catch (historyError) {
              console.error("Error cargando historial desde IndexedDB:", historyError);
            }
            
            toast({ 
              title: "Modo Offline", 
              description: "Trabajando con datos guardados localmente. Algunas funciones pueden estar limitadas.",
              variant: "default"
            });
          } else {
            throw new Error("No hay datos en caché para cargar en modo offline");
          }
        } catch (offlineError) {
          console.error("Error cargando datos offline:", offlineError);
          toast({ 
            title: "Error en modo offline", 
            description: "No se pudieron cargar datos almacenados. Intenta nuevamente cuando tengas conexión.",
            variant: "destructive"
          });
          setParking(initialParkingState);
        } finally {
          setLoadingInitialData(false);
          setInitialDataFetched(true);
        }
      } else {
        // Modo online - carga normal desde la API
        console.log('⏱️ Solicitando datos esenciales...');
        
        // Primer paso: Cargar datos esenciales sin historial
        const dashboardData = await fetchWithCache<{
          capacity: Capacity,
          vehicles: Vehicle[],
          rates: Rates,
          userSettings: UserSettings | null,
          _metrics?: { executionTime: number }
        }>(`/api/dashboard/essential?userId=${userId}`);
        
        const essentialLoadTime = Math.round(performance.now() - startTime);
        console.log(`⚡ Datos esenciales cargados en ${essentialLoadTime}ms (${dashboardData.vehicles.length} vehículos estacionados)`);
        if (dashboardData._metrics) {
          console.log(`⚡ Tiempo de ejecución del servidor: ${dashboardData._metrics.executionTime}ms`);
        }
        
        // Guardar los vehículos en IndexedDB para acceso offline
        if (dashboardData.vehicles && dashboardData.vehicles.length > 0) {
          IDBCache.saveParkedVehicles(userId, dashboardData.vehicles)
            .catch(error => console.error("Error guardando vehículos en IndexedDB:", error));
        }
        
        // Actualizar la UI con datos esenciales inmediatamente
        setUserSettings(dashboardData.userSettings);
        setParking(prev => ({
          ...prev,
          capacity: dashboardData.capacity,
          parkedVehicles: dashboardData.vehicles,
          rates: dashboardData.rates,
        }));
        
        // Ya podemos marcar que los datos iniciales se cargaron
        setLoadingInitialData(false);
        setInitialDataFetched(true);
        
        // Segundo paso: Cargar el historial por separado (primera página)
        try {
          setLoadingHistory(true);
          await fetchHistoryWithPagination(userId, 1, false);
        } catch (historyError) {
          console.error("⚠️ Error al cargar historial inicial:", historyError);
        } finally {
          setLoadingHistory(false);
        }
      }
    } catch (error) {
      console.error("❌ Error al cargar datos iniciales:", error);
      toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
      setParking(initialParkingState);
      setUserSettings(null);
      setLoadingInitialData(false);
      setInitialDataFetched(false);
      setOfflineMode(false);
    } finally {
      const totalTime = Math.round(performance.now() - startTime);
      console.log(`✅ Proceso completo en ${totalTime}ms`);
      updateSyncStatus(false);
    }
  }, [fetchHistoryWithPagination, historyPagination.limit, updateSyncStatus]);

  useEffect(() => {
    // Solo realizar la carga inicial una vez que el usuario esté autenticado y no esté cargando
    // Y solo si no se han cargado los datos previamente
    if (user?.id && !authLoading && !initialDataFetched) {
      console.log('🔍 Iniciando carga de datos para usuario:', user.id);
      fetchInitialData(user.id);
    } 
    // Resetear estados si no hay usuario y la autenticación ha terminado
    else if (!user && !authLoading) {
      console.log('🧹 Limpiando estados por cierre de sesión');
      setParking(initialParkingState);
      setUserSettings(null);
      setLoadingInitialData(false);
      setInitialDataFetched(false);
    }
    // También registrar cuando no se inicia la carga
    else if (initialDataFetched) {
      console.log('⏭️ Omitiendo carga de datos (ya cargados)');
    }
  }, [user?.id, authLoading, initialDataFetched, fetchInitialData]);

  // Memoizar el cálculo de espacios disponibles para evitar recálculos innecesarios
  const availableSpaces = useMemo(() => {
    const parkedCounts = parking.parkedVehicles.reduce(
      (acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      },
      {} as Record<VehicleType, number>
    );
    return {
      Auto: Math.max(0, (parking.capacity.Auto || 0) - (parkedCounts.Auto || 0)),
      Moto: Math.max(0, (parking.capacity.Moto || 0) - (parkedCounts.Moto || 0)),
      Camioneta: Math.max(0, (parking.capacity.Camioneta || 0) - (parkedCounts.Camioneta || 0)),
    };
  }, [parking.parkedVehicles, parking.capacity]);

  const registerEntry = async (vehicleData: Omit<Vehicle, 'entry_time' | 'user_id' | 'id'>) => {
    if (!user) return;
    
    const vehicle: Vehicle = {
      ...vehicleData,
      entry_time: new Date().toISOString(),
      user_id: user.id,
    };

    // Si estamos offline, guardar la operación pendiente
    if (!navigator.onLine || offlineMode) {
      // Generar un ID temporal para el vehículo
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const tempVehicle = {
        ...vehicle,
        id: tempId,
        _isPendingSync: true
      };
      
      // Agregar a operaciones pendientes
      SyncService.addPendingEntry(vehicle);
      
      // Actualizar UI optimistamente
      const newParkedVehicles = [...parking.parkedVehicles, tempVehicle].sort(
        (a, b) => dayjs(a.entry_time).valueOf() - dayjs(b.entry_time).valueOf()
      );
      
      setParking(prev => ({
        ...prev,
        parkedVehicles: newParkedVehicles,
      }));
      
      // Guardar en IndexedDB para persistencia offline
      try {
        await IDBCache.saveParkedVehicles(user.id, newParkedVehicles);
      } catch (error) {
        console.error("Error guardando vehículos en IndexedDB:", error);
      }
      
      toast({ 
        title: "Entrada Registrada (Offline)", 
        description: `Vehículo ${vehicle.license_plate} ingresado. Se sincronizará cuando vuelva la conexión.` 
      });
      
      return;
    }

    // Modo online normal
    try {
      const response = await fetch("/api/parking/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vehicle),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al registrar entrada");
      }
      // Extraer el objeto 'data' de la respuesta JSON
      const responseData = await response.json();
      const newEntry: Vehicle = responseData.data; 

      if (!newEntry || !newEntry.id) {
        console.error("Error: La respuesta de la API no contiene un ID válido para el vehículo", responseData);
        toast({ variant: "destructive", title: "Error de Sincronización", description: "No se pudo obtener el ID del vehículo desde el servidor." });
        return;
      }
      
      const newParkedVehicles = [...parking.parkedVehicles, newEntry].sort(
        (a, b) => dayjs(a.entry_time).valueOf() - dayjs(b.entry_time).valueOf()
      );
      
      setParking(prev => ({
        ...prev,
        parkedVehicles: newParkedVehicles,
      }));
      
      // Actualizar caché de vehículos estacionados
      updateCache(`/api/parking/parked?userId=${user.id}`, { 
        vehicles: newParkedVehicles 
      });
      
      // Invalidar caché del dashboard
      invalidateCache(`/api/dashboard?userId=${user.id}`);
      
      // Guardar en IndexedDB para acceso offline
      try {
        await IDBCache.saveParkedVehicles(user.id, newParkedVehicles);
      } catch (error) {
        console.error("Error guardando vehículos en IndexedDB:", error);
      }
      
      toast({ title: "Entrada Registrada", description: `Vehículo ${newEntry.license_plate} ingresado.` });
    } catch (error: any) {
      console.error("Error registrando entrada:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  // Función para invalidar todas las cachés relacionadas con el dashboard
  const invalidateDashboardCaches = (userId: string) => {
    invalidateCache(`/api/dashboard/essential?userId=${userId}`);
    invalidateCache(`/api/dashboard/history?userId=${userId}`);
    invalidateCache(`/api/dashboard?userId=${userId}`); // Por si acaso, para compatibilidad
  }

  const updateCapacity = async (newCapacity: Capacity) => {
    if (!user) return;
    try {
      const response = await fetch("/api/capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, capacity: newCapacity }),
      });
      if (!response.ok) throw new Error("Error al actualizar capacidad");
      
      setParking(prev => ({ ...prev, capacity: newCapacity }));
      
      // Actualizar caché del endpoint individual que se usa en fetchInitialData
      updateCache(`/api/dashboard/essential?userId=${user.id}`, (prevData: any) => {
        if (prevData) {
          return {
            ...prevData,
            capacity: newCapacity,
          };
        }
        // Si no hay datos previos, podríamos crear una nueva entrada,
        // pero es mejor asegurarse que fetchInitialData lo llene primero.
        // Por ahora, solo actualizamos si existe.
        // O, alternativamente, podríamos buscar los otros componentes de dashboardData
        // para construir un objeto completo, pero eso es más complejo aquí.
        return undefined; // o prevData para no cambiar nada si no existe
      });
      
      // Invalidar el caché del dashboard para asegurar que otras partes se recarguen si es necesario
      // invalidateDashboardCaches(user.id); // Comentado para evitar invalidación inmediata
      
      toast({ title: "Capacidad Actualizada" });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la capacidad." });
    }
  };
  
  const updateRates = async (newRates: Rates) => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, rates: newRates }),
      });
      if (!response.ok) throw new Error("Error al actualizar tarifas");
      
      setParking(prev => ({ ...prev, rates: newRates }));
      
      // Actualizar caché del endpoint que se usa en fetchInitialData
      updateCache(`/api/dashboard/essential?userId=${user.id}`, (prevData: any) => {
        if (prevData) {
          return {
            ...prevData,
            rates: newRates,
          };
        }
        return undefined; // Si no hay datos previos, no hacemos nada
      });
      
      // Invalidar el caché del dashboard 
      // invalidateCache(`/api/dashboard?userId=${user.id}`); // Comentado para evitar invalidación inmediata
      
      toast({ title: "Tarifas actualizadas" });
    } catch (error) {
      console.error("Error al guardar tarifas:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar las tarifas." });
    }
  };

  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user?.id) return;
    try {
      const response = await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...newSettings }),
      });
      if (!response.ok) throw new Error("Error al guardar configuración del usuario");
      
      setUserSettings((prev) => ({ ...prev, ...newSettings, user_id: user.id! }));
      
      // Actualizar caché del endpoint que se usa en fetchInitialData
      updateCache(`/api/dashboard/essential?userId=${user.id}`, (prevData: any) => {
        if (prevData) {
          return {
            ...prevData,
            userSettings: { ...(prevData.userSettings || {}), ...newSettings }
          };
        }
        return undefined; // Si no hay datos previos, no hacemos nada
      });
      
      // Invalidar caché del dashboard
      // invalidateCache(`/api/dashboard?userId=${user.id}`); // Comentado para evitar invalidación inmediata
      
      toast({ title: "Configuración guardada" });
    } catch (error) {
      console.error("Error al guardar configuración:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar la configuración." });
    }
  };

  const handleExit = async (licensePlate: string) => {
    if (!user) {
      toast({ title: "Error", description: "Debe iniciar sesión...", variant: "destructive" });
      return;
    }
    const vehicle = parking.parkedVehicles.find(v => v.license_plate === licensePlate);
    if (!vehicle || !vehicle.entry_time) {
      toast({ title: "Error", description: "Vehículo no encontrado o sin fecha de entrada.", variant: "destructive" });
      return;
    }

    try {
      const entryTimeDayjs = dayjs.utc(vehicle.entry_time);
      if (!entryTimeDayjs.isValid()) throw new Error("Fecha de entrada inválida");
      
      const entryTime = entryTimeDayjs.toDate();
      const exitTime = new Date();
      const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
      const durationHours = Math.max(diffInMinutes / 60, 1);
      const rate = parking.rates[vehicle.type] || 0;
      let fee = Math.round(calculateFee(durationHours, rate) * 100) / 100;

      if (fee <= 0 && rate > 0) {
         console.warn("Tarifa calculada en handleExit es <= 0 con rate > 0, aplicando tarifa mínima de 1 hora", {durationHours, rate, fee, vehicle});
         fee = Math.round(calculateFee(1, rate) * 100) / 100; 
      }
      setLastCalculatedFee(fee);
      setExitingVehicle(vehicle);
      setPaymentMethodDialogOpen(true);

    } catch (error: any) {
      console.error('Error al iniciar proceso de salida:', error);
      toast({ variant: "destructive", title: "Error", description: error.message || "Error al iniciar el proceso de salida." });
    }
  };

  const handlePaymentMethod = async (method: string) => {
    if (!exitingVehicle || !user) return;
    setPaymentMethodDialogOpen(false); 

    if (method === 'transferencia') {
      setPaymentDetails({ method: 'transferencia', status: 'pending' }); 
        setShowTransferInfoDialog(true);
        return;
    }

    if (method === 'mercadopago' && userSettings?.mercadopagoApiKey) {
      const feeToCharge = lastCalculatedFee;
      const qrCodeDataForMP = `PATENTE:${exitingVehicle.license_plate},MONTO:${feeToCharge}`;
      setQrData({ 
        code: qrCodeDataForMP,
        fee: feeToCharge,
      });
      setPaymentDetails({ method: 'mercadopago', status: 'pending_qr' });
          setShowQRDialog(true);
       return;
    }
    
    if (method === 'qr' && userSettings?.mercadopagoApiKey) {
      try {
        setPaymentDetails({ method: 'qr', status: 'generating' });
        
        // Llamar a la API para generar el QR de MercadoPago
        const response = await fetch('/api/payment/mercadopago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            licensePlate: exitingVehicle.license_plate,
            fee: lastCalculatedFee,
            vehicleType: exitingVehicle.type,
            userId: user.id,
            paymentType: 'qr'
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error al generar el código QR');
        }
        
        const data = await response.json();
        
        // Verificar que tenemos los datos necesarios
        if (!data.qr_code && !data.qr_code_base64) {
          throw new Error('No se pudo generar el código QR de MercadoPago');
        }
        
        // Guardar el código QR y mostrar el diálogo
        setQrData({
          code: data.qr_code || '',
          fee: data.fee || lastCalculatedFee,
          qrCodeBase64: data.qr_code_base64
        });
        
        setPaymentDetails({ 
          method: 'qr', 
          status: 'pending_payment',
          qrData: data
        });
        
        setShowQRDialog(true);
      } catch (error) {
        console.error('Error al generar QR de MercadoPago:', error);
        toast({ 
          variant: "destructive", 
          title: "Error", 
          description: error instanceof Error ? error.message : "No se pudo generar el código QR" 
        });
        
        // Fallback a opción de pago estándar si falla
        setPaymentDetails({ method: 'efectivo', status: 'fallback' });
        setPaymentConfirmationOpen(true);
      }
      return;
    }
    
    setPaymentDetails({ method, status: 'paid' });
    setPaymentConfirmationOpen(true); 
  };
  
  const handleQRSuccess = () => {
    setShowQRDialog(false);
    toast({ title: "Pago QR", description: "Pago con QR procesado (simulado)." });
    setPaymentDetails((prev:any) => ({ ...prev, method: 'mercadopago', status: 'approved_qr' }));
    setPaymentConfirmationOpen(true);
  };

  const handleQRCancel = () => {
    setShowQRDialog(false);
    toast({ title: "Pago QR Cancelado", variant: "default" });
    setExitingVehicle(null); 
    setPaymentDetails(null);
  };

  const handleTransferConfirmed = () => {
      setShowTransferInfoDialog(false);
      setPaymentDetails((prev: any) => ({ ...prev, method: 'transferencia', status: 'transfer_confirmed_by_admin' }));
      setPaymentConfirmationOpen(true);
  };
  
  const finalizeExit = async (confirmedPaymentDetails: any) => {
    if (!exitingVehicle || !user) {
        toast({ title: "Error", description: "No se puede finalizar la salida, falta información.", variant: "destructive"});
        return;
    }

    let feeToCharge = lastCalculatedFee;
    const entryTime = dayjs.utc(exitingVehicle.entry_time).toDate();
    const exitTime = new Date();
    const diffInMinutes = Math.abs(exitTime.getTime() - entryTime.getTime()) / (1000 * 60);
    const durationHours = Math.max(diffInMinutes / 60, 1);
    const rateForVehicle = parking.rates[exitingVehicle.type] || 0;
    let preciseFee = Math.round(calculateFee(durationHours, rateForVehicle) * 100) / 100;

    if (preciseFee <= 0 && rateForVehicle > 0) {
        preciseFee = Math.round(calculateFee(1, rateForVehicle) * 100) / 100; 
        toast({title: "Aviso de Tarifa", description: `Se aplicó tarifa mínima de ${preciseFee} por cálculo inválido.`, variant: "default"});
    }
    feeToCharge = preciseFee;

    // Si estamos en modo offline, guardar como operación pendiente
    if (!navigator.onLine || offlineMode) {
      try {
        // Crear datos para sincronización posterior
        SyncService.addPendingExit(
          exitingVehicle.license_plate,
          user.id,
          feeToCharge,
          confirmedPaymentDetails?.method || 'desconocido'
        );
        
        // Generar un ID temporal para la entrada de historial
        const tempHistoryId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
        // Crear objeto de historial temporal
        const tempExitData: ParkingHistory = {
          id: tempHistoryId,
          license_plate: exitingVehicle.license_plate,
          type: exitingVehicle.type,
          user_id: user.id,
          entry_time: exitingVehicle.entry_time,
          exit_time: new Date().toISOString(),
          duration: diffInMinutes * 60 * 1000, // en milisegundos
          fee: feeToCharge,
          payment_method: confirmedPaymentDetails?.method || 'desconocido',
          payment_details: confirmedPaymentDetails || {},
          _isPendingSync: true
        };
        
        // Actualizar estado local optimistamente
        const updatedParkedVehicles = parking.parkedVehicles.filter(
          v => v.license_plate !== exitingVehicle.license_plate
        );
        
        const updatedHistory = [tempExitData, ...parking.history].sort(
          (a,b) => dayjs(b.exit_time).valueOf() - dayjs(a.exit_time).valueOf()
        );
        
        setParking(prev => ({
          ...prev,
          parkedVehicles: updatedParkedVehicles,
          history: updatedHistory,
        }));
        
        // Guardar en IndexedDB para persistencia offline
        await Promise.all([
          IDBCache.saveParkedVehicles(user.id, updatedParkedVehicles),
          IDBCache.saveHistoryEntries(user.id, updatedHistory)
        ]);
        
        // Mostrar confirmación al usuario
        setExitInfo({
          ...tempExitData,
          duration: formatDuration(diffInMinutes * 60 * 1000)
        });
        
        toast({ 
          title: "Salida Registrada (Offline)", 
          description: `Vehículo ${exitingVehicle.license_plate} ha salido. Tarifa: $${feeToCharge}. Se sincronizará cuando vuelva la conexión.` 
        });
        
        // Asegurarse de que el historial se actualice incluso en modo offline
        try {
          setLoadingHistory(true);
          const updatedOfflineHistory = await IDBCache.getHistoryEntries(user.id, historyPagination.limit, 1);
          setParking(prev => ({
            ...prev,
            history: updatedOfflineHistory || [],
          }));
        } catch (refreshError) {
          console.error("Error al refrescar historial offline después de salida:", refreshError);
        } finally {
          setLoadingHistory(false);
        }
        
      } catch (error: any) {
        console.error("Error registrando salida offline:", error);
        toast({ variant: "destructive", title: "Error", description: error.message });
      } finally {
        setExitingVehicle(null);
        setPaymentDetails(null); 
        setPaymentConfirmationOpen(false); 
        setShowTransferInfoDialog(false); 
        setQrData(null);
        setShowQRDialog(false);
        setLastCalculatedFee(0);
      }
      return;
    }

    // Modo online normal
    try {
      const response = await fetch("/api/parking/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licensePlate: exitingVehicle.license_plate,
          userId: user.id,
          paymentMethod: confirmedPaymentDetails?.method || 'desconocido',
          fee: feeToCharge,
          paymentDetails: confirmedPaymentDetails, 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al registrar salida final");
      }

      const exitDataResponse: ParkingHistory = await response.json();
      const exitDataForState: ExitInfo = {
          ...exitDataResponse,
          duration: formatDuration(diffInMinutes * 60 * 1000)
      };
      
      // Actualizar estado de parkedVehicles e history
      const updatedParkedVehicles = parking.parkedVehicles.filter(
        v => v.license_plate !== exitingVehicle.license_plate
      );
      
      const updatedHistory = [exitDataResponse, ...parking.history].sort(
        (a,b) => dayjs(b.exit_time).valueOf() - dayjs(a.exit_time).valueOf()
      );
      
      setParking(prev => ({
        ...prev,
        parkedVehicles: updatedParkedVehicles,
        history: updatedHistory,
      }));
      
      // Actualizar las cachés
      updateCache(`/api/parking/parked?userId=${user.id}`, { 
        vehicles: updatedParkedVehicles 
      });
      
      // Actualizar la caché del historial
      updateCache(`/api/parking/history?userId=${user.id}`, { 
        history: updatedHistory 
      });
      
      // Invalidar caches del dashboard y del historial específicamente
      invalidateCache(`/api/dashboard?userId=${user.id}`);
      invalidateCache(`/api/dashboard/history?userId=${user.id}`);
      invalidateCache(`/api/dashboard/history?userId=${user.id}&page=1&limit=${historyPagination.limit}`);
      
      // Guardar en IndexedDB para acceso offline
      await Promise.all([
        IDBCache.saveParkedVehicles(user.id, updatedParkedVehicles),
        IDBCache.saveHistoryEntries(user.id, updatedHistory)
      ]);
      
      setExitInfo(exitDataForState); 
      toast({ title: "Salida Registrada", description: `Vehículo ${exitingVehicle.license_plate} ha salido. Tarifa: $${feeToCharge}.` });

      // Refrescar explícitamente el historial completo después de registrar la salida
      try {
        setLoadingHistory(true);
        await fetchHistoryWithPagination(user.id, 1, false);
      } catch (refreshError) {
        console.error("Error al refrescar historial después de salida:", refreshError);
      } finally {
        setLoadingHistory(false);
      }

    } catch (error: any) {
      console.error("Error registrando salida final:", error);
      toast({ variant: "destructive", title: "Error de Salida Final", description: error.message });
    } finally {
      setExitingVehicle(null);
      setPaymentDetails(null); 
      setPaymentConfirmationOpen(false); 
      setShowTransferInfoDialog(false);
      setQrData(null);
      setShowQRDialog(false);
      setLastCalculatedFee(0);
    }
  };

  const handleDeleteHistoryEntry = async (entryId: string) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/parking/history/${entryId}?userId=${user.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Error al eliminar registro del historial");
      
      const updatedHistory = parking.history.filter(entry => entry.id !== entryId);
      
      setParking(prev => ({
        ...prev,
        history: updatedHistory,
      }));
      
      // Actualizar la caché del historial
      updateCache(`/api/parking/history?userId=${user.id}`, { 
        history: updatedHistory 
      });
      
      // Invalidar caché del dashboard
      invalidateCache(`/api/dashboard?userId=${user.id}`);
      
      toast({ title: "Registro Eliminado", description: "El registro del historial ha sido eliminado." });
    } catch (error: any) {
      console.error("Error eliminando historial:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  const handleUpdateHistoryEntry = async (updatedEntry: ParkingHistory) => {
    if (!user) return;
    try {
      const response = await fetch(`/api/parking/history/${updatedEntry.id}?userId=${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedEntry),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al actualizar registro del historial");
      }
      const returnedEntry: ParkingHistory = await response.json();
      
      const updatedHistory = parking.history
        .map(entry => entry.id === returnedEntry.id ? returnedEntry : entry)
        .sort((a,b) => dayjs(b.exit_time).valueOf() - dayjs(a.exit_time).valueOf());
      
      setParking(prev => ({
        ...prev,
        history: updatedHistory,
      }));
      
      // Actualizar la caché del historial
      updateCache(`/api/parking/history?userId=${user.id}`, { 
        history: updatedHistory 
      });
      
      // Invalidar caché del dashboard
      invalidateCache(`/api/dashboard?userId=${user.id}`);
      
      toast({ title: "Registro Actualizado" });
    } catch (error: any) {
      console.error("Error actualizando historial:", error);
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };
  
  const handleReenterVehicle = async (historyEntry: ParkingHistory) => {
    if (!user) return;
    if (parking.parkedVehicles.some(v => v.license_plate === historyEntry.license_plate)) {
        toast({
            title: "Vehículo Ya Estacionado",
            description: `El vehículo ${historyEntry.license_plate} ya se encuentra en el estacionamiento.`,
            variant: "default",
        });
        return;
      }
    const vehicleToReenter: Omit<Vehicle, 'id' | 'user_id' | 'entry_time'> & { notes?: string } = {
      license_plate: historyEntry.license_plate,
      type: historyEntry.type as VehicleType,
      notes: `Reingreso desde historial (Salida anterior: ${dayjs(historyEntry.exit_time).format('YYYY-MM-DD HH:mm')})`,
    };
    await registerEntry(vehicleToReenter);
  };

  // Modificar useEffect para registrar el callback de sincronización
  useEffect(() => {
    // Registrar callback para actualizar estado de sincronización
    SyncService.registerSyncCallback(updateSyncStatus);
    
    // Intentar sincronizar en el montaje si hay operaciones pendientes
    if (SyncService.hasPendingOperations() && navigator.onLine) {
      SyncService.syncPendingOperations().catch(console.error);
    }
  }, [updateSyncStatus]);

  if (authLoading || loadingInitialData) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /> Cargando...</div>;
  }

  if (!user) {
    return <div className="flex justify-center items-center h-screen">Por favor, inicie sesión para usar la aplicación.</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* Indicador de modo offline */}
      {offlineMode && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 rounded shadow-md dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-200">
          <div className="flex items-center">
            <div className="py-1">
              <svg className="h-6 w-6 mr-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <p className="font-bold">Modo Sin Conexión</p>
              <p className="text-sm">Estás trabajando con datos guardados localmente. Algunas funciones pueden estar limitadas hasta que se restablezca la conexión.</p>
            </div>
          </div>
        </div>
      )}
      
      <h1 className="text-3xl font-bold mb-6 text-center">Sistema de Estacionamiento</h1>

      <Tabs defaultValue="operator" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="operator">Panel de Operador</TabsTrigger>
          <TabsTrigger value="admin">Panel de Administrador</TabsTrigger>
          <TabsTrigger value="rates">Gestión de Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="operator">
          <OperatorPanel
            parking={parking}
            availableSpaces={availableSpaces}
            onRegisterEntry={registerEntry}
            onRegisterExit={handleExit}
            exitInfo={exitInfo}
            setExitInfo={setExitInfo}
          />
        </TabsContent>

        <TabsContent value="admin">
          <AdminPanel
            history={parking.history}
            availableSpaces={availableSpaces}
            capacity={parking.capacity}
            onUpdateCapacity={updateCapacity}
            onDeleteHistoryEntry={handleDeleteHistoryEntry}
            onUpdateHistoryEntry={handleUpdateHistoryEntry}
            onReenterVehicle={handleReenterVehicle}
          >
            {/* Botón "Cargar más" para historial */}
            {loadingHistory ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              historyPagination.hasMore && (
                <div className="flex justify-center py-4">
                  <Button 
                    variant="outline" 
                    onClick={loadMoreHistory}
                    disabled={historyPagination.loading}
                  >
                    {historyPagination.loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      `Cargar más (${parking.history.length} de ${historyPagination.total || '?'})`
                    )}
                  </Button>
                </div>
              )
            )}
          </AdminPanel>
        </TabsContent>

        <TabsContent value="rates">
          <SettingsPanel 
            initialRates={parking.rates}
            initialUserSettings={userSettings}
            onSaveRates={updateRates}
            onSaveUserSettings={updateUserSettings}
            userId={user.id}
          />
        </TabsContent>
      </Tabs>

      <Toaster />

      <PaymentMethodDialog
        open={paymentMethodDialogOpen}
        onOpenChange={(open) => {
            setPaymentMethodDialogOpen(open);
            if (!open) {
              setExitingVehicle(null); 
              setPaymentDetails(null);
            }
        }}
        onSelectMethod={handlePaymentMethod}
        fee={lastCalculatedFee}
      />

      <QRDialog
        open={showQRDialog}
        onOpenChange={(open) => {
            setShowQRDialog(open);
            if (!open) {
                handleQRCancel();
            }
        }}
        qrCode={qrData?.code || ""}
        qrCodeBase64={qrData?.qrCodeBase64}
        fee={qrData?.fee || lastCalculatedFee}
        onConfirmPayment={handleQRSuccess}
      />

      <TransferInfoDialog
        isOpen={showTransferInfoDialog}
        onClose={() => {
            setShowTransferInfoDialog(false);
            setExitingVehicle(null); 
            setPaymentDetails(null);
        }}
        onConfirmTransfer={handleTransferConfirmed}
        userId={user?.id}
      />

      <PaymentConfirmationDialogComponent
        open={paymentConfirmationOpen}
        onOpenChange={setPaymentConfirmationOpen}
          onConfirm={(confirmedDetails) => {
            setPaymentConfirmationOpen(false);
            finalizeExit(confirmedDetails);
          }}
          onCancel={() => {
            setPaymentConfirmationOpen(false);
            toast({ title: "Salida Cancelada", variant: "default" });
            setExitingVehicle(null); 
            setPaymentDetails(null);
          }}
          vehicle={exitingVehicle}
          fee={lastCalculatedFee}
          paymentDetails={paymentDetails}
      />

    </div>
  );
}

interface PaymentConfirmationDialogComponentProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (paymentDetails: any) => void;
    onCancel: () => void;
    vehicle: Vehicle | null;
    fee: number;
    paymentDetails: any;
}

function PaymentConfirmationDialogComponent({ open, onOpenChange, onConfirm, onCancel, vehicle, fee, paymentDetails }: PaymentConfirmationDialogComponentProps) {
    if (!open || !vehicle) return null;

    const handleConfirm = () => {
        onConfirm({ 
            ...paymentDetails, 
            feeAtConfirmation: fee, 
            confirmedAt: new Date().toISOString(),
            finalActionBy: "admin_confirmed"
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl max-w-sm w-full">
                <h3 className="text-lg font-semibold mb-2 dark:text-zinc-100">Confirmar Salida y Pago</h3>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">Vehículo: {vehicle.license_plate} ({vehicle.type})</p>
                <p className="text-sm text-gray-600 dark:text-zinc-400 mb-1">Monto a Cobrar: ${fee.toFixed(2)}</p>
                {paymentDetails?.method && <p className="text-sm text-gray-600 dark:text-zinc-400 mb-4">Método: {paymentDetails.method}</p>}
                
                <p className="text-sm text-gray-700 dark:text-zinc-300 mb-4">
                    ¿Confirmas que el pago se ha realizado/recibido y deseas registrar la salida del vehículo?
                </p>
                <div className="flex justify-end space-x-2">
                    <button 
                        onClick={onCancel}
                        className="px-4 py-2 text-sm rounded bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 dark:text-zinc-100"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="px-4 py-2 text-sm rounded bg-green-500 text-white hover:bg-green-600"
                    >
                        Confirmar y Registrar Salida
                    </button>
                </div>
            </div>
        </div>
    );
}
