"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { VehicleType, Vehicle, ParkingHistory } from "@/lib/types";
import { logger, createTimer } from "@/lib/logger";
import { useParkings } from "@/lib/hooks/use-parkings";

type SignUpParams = {
  email: string;
  password: string;
  name: string;
};

type SignInParams = {
  email: string;
  password: string;
};

type PasswordResetRequestParams = {
  email: string;
};

type PasswordUpdateParams = {
  newPassword: string;
};

// Definir la estructura de la configuración del usuario
type UserSettings = {
  mercadopagoApiKey: string | null;
  bankAccountHolder: string | null;
  bankAccountCbu: string | null;
  bankAccountAlias: string | null;
};

// Definir constantes para localStorage
const STORAGE_KEYS = {
  RATES: 'parking_rates',
  RATES_TIMESTAMP: 'parking_rates_timestamp',
  USER_SETTINGS: 'parking_user_settings',
  USER_SETTINGS_TIMESTAMP: 'parking_user_settings_timestamp',
  CAPACITY: 'parking_capacity',
  CAPACITY_TIMESTAMP: 'parking_capacity_timestamp',
  INIT_RATES_DONE: 'parking_init_rates_done',
};

// Tiempo máximo de validez del caché (15 minutos)
const CACHE_MAX_AGE = 15 * 60 * 1000;

export const AuthContext = createContext<{
  user: User | null;
  estId: number | null;
  userRole: 'owner' | 'playero' | 'conductor' | null;
  roleLoading: boolean;
  invalidateRoleCache: () => void;
  rates: Record<VehicleType, number> | null;
  userSettings: UserSettings | null;
  parkedVehicles: Vehicle[] | null;
  parkingHistory: ParkingHistory[] | null;
  parkingCapacity: Record<VehicleType, number> | null;
  loadingUserData: boolean;
  initRatesDone: boolean;
  // Estado centralizado de parkings
  parkings: any[];
  parkingsUser: any;
  parkingsLoading: boolean;
  parkingsError: string | null;
  fetchParkings: () => Promise<any[]>;
  refreshParkings: () => Promise<any[]>;
  getParkingById: (estId: number) => any;
  clearParkings: () => void;
  signUp: (params: SignUpParams) => Promise<void>;
  signIn: (params: SignInParams) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (params: PasswordResetRequestParams) => Promise<void>;
  updatePassword: (params: PasswordUpdateParams) => Promise<void>;
  fetchUserData: () => Promise<void>;
  refreshParkedVehicles: () => Promise<void>;
  refreshParkingHistory: () => Promise<void>;
  initializeRates: () => Promise<void>;
  refreshCapacity: () => Promise<void>;
  setEstId: (id: number | null) => void;
  ensureParkingSetup: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  clearAuthCompletely: () => Promise<void>;
}>({
  user: null,
  estId: null,
  userRole: null,
  roleLoading: false,
  invalidateRoleCache: () => { },
  // Estado por defecto de parkings
  parkings: [],
  parkingsUser: null,
  parkingsLoading: false,
  parkingsError: null,
  fetchParkings: async () => [],
  refreshParkings: async () => [],
  getParkingById: () => null,
  clearParkings: () => { },
  rates: null,
  userSettings: null,
  parkedVehicles: null,
  parkingHistory: null,
  parkingCapacity: null,
  loadingUserData: false,
  initRatesDone: false,
  signUp: async () => { },
  signIn: async () => { },
  signOut: async () => { },
  requestPasswordReset: async () => { },
  updatePassword: async () => { },
  fetchUserData: async () => { },
  refreshParkedVehicles: async () => { },
  refreshParkingHistory: async () => { },
  initializeRates: async () => { },
  refreshCapacity: async () => { },
  setEstId: () => { },
  ensureParkingSetup: async () => { },
  signInWithGoogle: async () => { },
  clearAuthCompletely: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'owner' | 'playero' | 'conductor' | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false); // Guard para fetchUserData
  const [isInitialized, setIsInitialized] = useState(false); // Flag para saber si ya se inicializó
  const [lastUserId, setLastUserId] = useState<string | null>(null); // Para detectar cambios reales de usuario
  const [rates, setRates] = useState<Record<VehicleType, number> | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [parkedVehicles, setParkedVehicles] = useState<Vehicle[] | null>(null);
  const [parkingHistory, setParkingHistory] = useState<ParkingHistory[] | null>(null);
  const [parkingCapacity, setParkingCapacity] = useState<Record<VehicleType, number> | null>(null);
  const [loadingUserData, setLoadingUserData] = useState(false);
  const [initRatesDone, setInitRatesDone] = useState(false);
  const [estId, setEstId] = useState<number | null>(null); // No asignar por defecto hasta verificar
  const router = useRouter();
  const pathname = usePathname();

  // Hook centralizado para gestionar parkings
  const {
    parkings,
    user: parkingsUser,
    loading: parkingsLoading,
    error: parkingsError,
    fetchParkings,
    refreshParkings,
    getParkingById,
    clearParkings
  } = useParkings();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const signInWithGoogle = async () => {
    try {
      const baseUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${baseUrl}/`,
        },
      });
      if (error) throw error;
    } finally {
    }
  };
  // Función para inicializar tarifas base del sistema (sólo una vez)
  const initializeRates = async () => {
    // Verificar primero si ya se inicializó en esta sesión
    if (initRatesDone) return;

    // Verificar si ya se inicializó en sesiones anteriores (guardado en localStorage)
    const initRatesDoneStored = localStorage.getItem(STORAGE_KEYS.INIT_RATES_DONE);
    if (initRatesDoneStored === 'true') {
      setInitRatesDone(true);
      return;
    }

    try {
      const response = await fetch('/api/parking/init-rates');
      const data = await response.json();

      console.log('Inicialización de tarifas:', data);

      // Marcar como inicializado en el estado y en localStorage
      setInitRatesDone(true);
      localStorage.setItem(STORAGE_KEYS.INIT_RATES_DONE, 'true');
    } catch (error) {
      console.error('Error al inicializar tarifas:', error);
      // Incluso si hay error, marcamos como inicializado para no seguir intentando
      setInitRatesDone(true);
      localStorage.setItem(STORAGE_KEYS.INIT_RATES_DONE, 'true');
    }
  };

  // Función para obtener solo los vehículos estacionados
  const refreshParkedVehicles = async () => {
    if (!user?.id || estId === null) return;

    try {
      const parkedResponse = await fetch(`/api/parking/parked?est_id=${estId}`);

      if (parkedResponse.ok) {
        const parkedData = await parkedResponse.json();
        setParkedVehicles(Array.isArray(parkedData.parkedVehicles) ? parkedData.parkedVehicles : []);
      } else {
        logger.error("Error al cargar vehículos estacionados");
        setParkedVehicles([]);
      }
    } catch (error) {
      console.error("Error general al cargar vehículos estacionados:", error);
      setParkedVehicles([]);
    }
  };

  // Función para obtener solo el historial de estacionamiento
  const refreshParkingHistory = async () => {
    if (!user?.id || estId === null) return;

    try {
      console.log('🔄 Cargando historial de estacionamiento para estId:', estId);
      const historyResponse = await fetch(`/api/parking/history?est_id=${estId}`);

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        console.log('✅ Datos del historial recibidos:', {
          count: historyData.history?.length || 0,
          data: historyData.history?.slice(0, 3) // Mostrar primeros 3 para debug
        });
        setParkingHistory(Array.isArray(historyData.history) ? historyData.history : []);
      } else {
        const errorText = await historyResponse.text();
        console.error("❌ Error al cargar historial de estacionamiento:", {
          status: historyResponse.status,
          statusText: historyResponse.statusText,
          body: errorText
        });
        setParkingHistory([]);
      }
    } catch (error) {
      console.error("❌ Error general al cargar historial de estacionamiento:", error);
      setParkingHistory([]);
    }
  };

  // Función para obtener los datos de tarifas
  const fetchRates = useCallback(async () => {
    if (!user?.id || estId === null) return null;

    // Verificar si hay datos en localStorage y si son recientes
    const cachedRates = localStorage.getItem(STORAGE_KEYS.RATES);
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.RATES_TIMESTAMP);

    if (cachedRates && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_MAX_AGE) {
      console.log('Usando tarifas desde localStorage');
      return JSON.parse(cachedRates);
    }

    try {
      const ratesResponse = await fetch(`/api/rates?est_id=${estId}`);

      if (ratesResponse.ok) {
        const ratesData = await ratesResponse.json();
        const rates = ratesData.rates || { Auto: 0, Moto: 0, Camioneta: 0 };

        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEYS.RATES, JSON.stringify(rates));
        localStorage.setItem(STORAGE_KEYS.RATES_TIMESTAMP, Date.now().toString());

        return rates;
      } else {
        console.error("Error al cargar tarifas");
        return { Auto: 0, Moto: 0, Camioneta: 0 };
      }
    } catch (error) {
      console.error("Error general al cargar tarifas:", error);
      return { Auto: 0, Moto: 0, Camioneta: 0 };
    }
  }, [user?.id, estId]);

  // Función para obtener los datos de configuración del usuario
  const fetchUserSettings = useCallback(async () => {
    if (!user?.id) return null;

    // Verificar si hay datos en localStorage y si son recientes
    const cachedSettings = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS);
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.USER_SETTINGS_TIMESTAMP);

    if (cachedSettings && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_MAX_AGE) {
      console.log('Usando configuración desde localStorage');
      return JSON.parse(cachedSettings);
    }

    try {
      const settingsResponse = await fetch(`/api/user/settings`);

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        const settings = {
          mercadopagoApiKey: settingsData.mercadopagoApiKey || "",
          bankAccountHolder: settingsData.bankAccountHolder || "",
          bankAccountCbu: settingsData.bankAccountCbu || "",
          bankAccountAlias: settingsData.bankAccountAlias || "",
        };

        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEYS.USER_SETTINGS, JSON.stringify(settings));
        localStorage.setItem(STORAGE_KEYS.USER_SETTINGS_TIMESTAMP, Date.now().toString());

        return settings;
      } else {
        console.error("Error al cargar configuración del usuario");
        return {
          mercadopagoApiKey: "",
          bankAccountHolder: "",
          bankAccountCbu: "",
          bankAccountAlias: "",
        };
      }
    } catch (error) {
      console.error("Error general al cargar configuración del usuario:", error);
      return {
        mercadopagoApiKey: "",
        bankAccountHolder: "",
        bankAccountCbu: "",
        bankAccountAlias: "",
      };
    }
  }, [user?.id]);

  // Función para obtener los datos de capacidad
  const fetchCapacity = useCallback(async () => {
    if (!user?.id || estId === null) return null;

    // Verificar si hay datos en localStorage y si son recientes
    const cachedCapacity = localStorage.getItem(STORAGE_KEYS.CAPACITY);
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);

    if (cachedCapacity && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_MAX_AGE) {
      console.log('Usando capacidad desde localStorage:', JSON.parse(cachedCapacity));
      return JSON.parse(cachedCapacity);
    }

    try {
      console.log('Fetching capacity from API');
      const capacityResponse = await fetch(`/api/capacity?est_id=${estId}`);

      if (capacityResponse.ok) {
        const capacityData = await capacityResponse.json();
        const capacity = capacityData.capacity || { Auto: 0, Moto: 0, Camioneta: 0 };

        console.log('Capacity fetched from API:', capacity);

        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEYS.CAPACITY, JSON.stringify(capacity));
        localStorage.setItem(STORAGE_KEYS.CAPACITY_TIMESTAMP, Date.now().toString());

        return capacity;
      } else {
        const errorData = await capacityResponse.json();
        console.error("Error al cargar capacidad del estacionamiento:", errorData);
        return { Auto: 0, Moto: 0, Camioneta: 0 };
      }
    } catch (error) {
      console.error("Error general al cargar capacidad del estacionamiento:", error);
      return { Auto: 0, Moto: 0, Camioneta: 0 };
    }
  }, [user?.id, estId]);

  // Función para refrescar solo la capacidad
  const refreshCapacity = async () => {
    if (!user?.id || estId === null) return;

    // Limpiar caché para forzar nueva consulta
    localStorage.removeItem(STORAGE_KEYS.CAPACITY);
    localStorage.removeItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);

    const capacity = await fetchCapacity();
    setParkingCapacity(capacity);

    console.log('Capacity refreshed:', capacity);
  };

  // Función para obtener los datos del usuario (usando las funciones optimizadas)
  const fetchUserData = useCallback(async () => {
    if (!user?.id || estId === null || loadingData) return;

    setLoadingData(true);
    setLoadingUserData(true);
    try {
      // Obtener datos que pueden venir de caché
      const [ratesData, settingsData, capacityData] = await Promise.all([
        fetchRates(),
        fetchUserSettings(),
        fetchCapacity()
      ]);

      // Obtener datos que siempre se refrescan
      const [parkedResponse, historyResponse] = await Promise.all([
        fetch(`/api/parking/parked?est_id=${estId}`),
        fetch(`/api/parking/history?est_id=${estId}`)
      ]);

      // Actualizar el estado con los datos obtenidos
      setRates(ratesData);
      setUserSettings(settingsData);
      setParkingCapacity(capacityData);

      if (parkedResponse.ok) {
        const parkedData = await parkedResponse.json();
        setParkedVehicles(Array.isArray(parkedData.parkedVehicles) ? parkedData.parkedVehicles : []);
      } else {
        logger.error("Error al cargar vehículos estacionados");
        setParkedVehicles([]);
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        logger.debug(`Historial cargado: ${historyData.history?.length || 0} registros`);
        setParkingHistory(Array.isArray(historyData.history) ? historyData.history : []);
      } else {
        logger.error("Error al cargar historial de estacionamiento");
        setParkingHistory([]);
      }
    } catch (error) {
      logger.error("Error general al cargar datos del usuario:", error);
      setRates({ Auto: 0, Moto: 0, Camioneta: 0 });
      setUserSettings({
        mercadopagoApiKey: "",
        bankAccountHolder: "",
        bankAccountCbu: "",
        bankAccountAlias: "",
      });
      setParkedVehicles([]);
      setParkingHistory([]);
      setParkingCapacity({ Auto: 0, Moto: 0, Camioneta: 0 });
    } finally {
      setLoadingUserData(false);
      setLoadingData(false);
    }
  }, [user?.id, estId, fetchRates, fetchUserSettings, fetchCapacity]);

  // Limpiar el caché al cerrar sesión
  const clearCache = () => {
    // Limpiar datos específicos de la app
    localStorage.removeItem(STORAGE_KEYS.RATES);
    localStorage.removeItem(STORAGE_KEYS.RATES_TIMESTAMP);
    localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS_TIMESTAMP);
    localStorage.removeItem(STORAGE_KEYS.CAPACITY);
    localStorage.removeItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);

    // Limpiar cualquier otro dato de autenticación
    if (typeof window !== 'undefined') {
      // Buscar y eliminar cualquier clave relacionada con supabase
      Object.keys(localStorage).forEach(key => {
        if (key.includes('supabase') || key.includes('sb-') || key.startsWith('supabase.auth.token')) {
          localStorage.removeItem(key);
        }
      });
    }

    // No eliminamos INIT_RATES_DONE, ya que es independiente del usuario
  };

  // Función para limpiar completamente la autenticación (útil para errores de token)
  const clearAuthCompletely = async () => {
    try {
      console.log('🧹 Limpiando autenticación completamente...');

      // Cerrar sesión en Supabase
      await supabase.auth.signOut({ scope: 'global' });

      // Limpiar estado local
      setUser(null);
      setUserRole(null);
      setLastUserId(null);

      // Limpiar caché
      clearCache();

      // Limpiar localStorage adicional
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user_role');
        localStorage.removeItem('parking_est_id');
        sessionStorage.clear();
      }

      console.log('✅ Autenticación limpiada completamente');
    } catch (error) {
      console.error('Error limpiando autenticación:', error);
    }
  };


  // Las redirecciones ahora se manejan completamente en el middleware
  // Este efecto solo se mantiene para casos edge que el middleware no captura
  useEffect(() => {
    if (isInitialized && !user) {
      const isAuthRoute = pathname?.startsWith("/auth/");
      const isMainPage = pathname === "/";
      const isPublicPage = isMainPage || pathname === "/register-selection";

      // Solo redirigir a login si no hay usuario y no está en ruta pública
      if (!isAuthRoute && !isPublicPage) {
        router.push("/auth/login");
      }
    }
  }, [user, isInitialized, pathname, router]);

  // Efecto para inicializar tarifas al cargar la aplicación
  useEffect(() => {
    initializeRates();
  }, []);



  useEffect(() => {
    console.log(`🎯 estId cambió a: ${estId}`);
    if (typeof window !== 'undefined' && estId !== null) {
      localStorage.setItem('parking_est_id', String(estId));
      console.log(`💾 Guardado en localStorage: ${estId}`);
    }
  }, [estId]);

  // Función para verificar y configurar estacionamiento si es necesario
  const ensureParkingSetup = async () => {
    console.log('🔍 ensureParkingSetup llamada para:', user?.email, 'userRole actual:', userRole);

    if (!user?.email) {
      console.log('❌ No hay usuario email en ensureParkingSetup');
      return;
    }

    // No ejecutar estas verificaciones para conductores ya que no necesitan estacionamientos
    if (userRole === 'conductor') {
      console.log('🚗 Usuario es conductor, saltando verificación de estacionamiento');
      return;
    }

    console.log('⚠️ Usuario NO es conductor, continuando con verificación de estacionamiento para:', userRole);

    try {
      console.log(`🔍 Verificando estacionamiento para usuario: ${user.email}`);
      // Verificar si el usuario ya tiene un estacionamiento
      const checkResponse = await fetch('/api/auth/get-parking-id');

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        console.log('📋 Respuesta de get-parking-id:', checkData);

        if (!checkData.has_parking) {
          console.log("👷 Usuario sin estacionamiento propio, verificando si es empleado...");

          // Verificar si el usuario es un empleado asignado a algún estacionamiento
          const employeeResponse = await fetch('/api/auth/get-employee-parking');
          if (employeeResponse.ok) {
            const employeeData = await employeeResponse.json();
            console.log('👷 Respuesta de get-employee-parking:', employeeData);

            if (employeeData.has_assignment) {
              console.log(`✅ Empleado asignado al estacionamiento: ${employeeData.est_id}`);
              setEstId(employeeData.est_id);
              if (typeof window !== 'undefined') {
                localStorage.setItem('parking_est_id', String(employeeData.est_id));
              }
              return; // Salir aquí porque ya configuramos el estacionamiento del empleado
            }
          }

          console.log("🏗️ Usuario sin estacionamiento ni asignación, creando...");

          // Crear el estacionamiento
          const setupResponse = await fetch('/api/auth/setup-parking', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: user.email,
              name: user.user_metadata?.name || 'Usuario'
            }),
          });

          if (setupResponse.ok) {
            const setupData = await setupResponse.json();
            console.log("✅ Configuración de estacionamiento completada:", setupData);

            // Si ya tiene estacionamientos, usar el primer estacionamiento existente
            if (setupData.estacionamientos_existentes > 0) {
              console.log(`ℹ️ Usuario ya tiene ${setupData.estacionamientos_existentes} estacionamiento(s)`);
              // Usar el primer estacionamiento de la lista
              if (setupData.estacionamiento_ids && setupData.estacionamiento_ids.length > 0) {
                setEstId(setupData.estacionamiento_ids[0]);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('parking_est_id', String(setupData.estacionamiento_ids[0]));
                }
              }
            } else {
              // Nuevo estacionamiento creado
              setEstId(setupData.estacionamiento_id);
              if (typeof window !== 'undefined') {
                localStorage.removeItem('parking_est_id');
                localStorage.setItem('parking_est_id', String(setupData.estacionamiento_id));
              }
            }
          } else {
            const errorData = await setupResponse.json().catch(() => ({ error: "Error desconocido" }));
            console.error("❌ Error en configuración de estacionamiento:", errorData);

            // Si el error es porque ya tiene estacionamientos, no es un error real
            if (errorData.message && errorData.message.includes("ya tiene estacionamientos")) {
              console.log("ℹ️ Usuario ya tiene estacionamientos configurados - esto es normal");
            } else {
              // Solo mostrar error si es un error real
              console.error("❌ Error real en configuración:", errorData);
            }
          }
        } else {
          console.log(`✅ Usuario ya tiene estacionamiento: ${checkData.est_id}`);
          // Actualizar el estId con el estacionamiento existente
          console.log(`🔄 Asignando estId: ${checkData.est_id}`);
          setEstId(checkData.est_id);

          // También verificar desde localStorage como fallback
          if (typeof window !== 'undefined') {
            const savedEstId = localStorage.getItem('parking_est_id');
            if (savedEstId && parseInt(savedEstId) !== checkData.est_id) {
              console.log(`🔄 Actualizando localStorage de est_id ${savedEstId} a ${checkData.est_id}`);
              localStorage.setItem('parking_est_id', String(checkData.est_id));
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error verificando configuración de estacionamiento:", error);
    }
  };

  // Efecto para cargar los datos del usuario cuando esté autenticado
  useEffect(() => {
    if (user?.id && !roleLoading && userRole) {
      console.log(`👤 Usuario autenticado: ${user.email}, userRole: ${userRole}, verificando estacionamiento...`);

      // Función para obtener el estId del usuario
      const getUserEstId = async () => {
        try {
          // Si es conductor, no necesita estId
          if (userRole === 'conductor') {
            console.log('🚗 Usuario es conductor, no necesita estId');
            setEstId(null);
            return null;
          }
          // Primero verificar si hay estId guardado en localStorage
          if (typeof window !== 'undefined') {
            const savedEstId = localStorage.getItem('parking_est_id');
            if (savedEstId) {
              console.log(`📦 estId encontrado en localStorage: ${savedEstId}`);
              const parsedEstId = parseInt(savedEstId);
              setEstId(parsedEstId);
              return parsedEstId;
            }
          }

          // Si no hay en localStorage, verificar si es dueño de estacionamiento
          console.log(`🔍 No hay estId en localStorage, consultando API...`);
          const ownerResponse = await fetch('/api/auth/get-parking-id');

          if (ownerResponse.ok) {
            const ownerData = await ownerResponse.json();
            if (ownerData && ownerData.has_parking && ownerData.est_id) {
              console.log(`✅ Usuario es DUEÑO de estacionamiento: ${ownerData.est_id}`);
              setEstId(ownerData.est_id);
              if (typeof window !== 'undefined') {
                localStorage.setItem('parking_est_id', String(ownerData.est_id));
              }
              return ownerData.est_id;
            }
          }

          // Si no es dueño, verificar si es empleado asignado
          console.log(`👷 Usuario no es dueño, verificando si es empleado...`);
          const employeeResponse = await fetch('/api/auth/get-employee-parking');

          if (employeeResponse.ok) {
            const employeeData = await employeeResponse.json();
            if (employeeData.has_assignment && employeeData.est_id) {
              console.log(`✅ Usuario es EMPLEADO asignado a estacionamiento: ${employeeData.est_id}`);
              setEstId(employeeData.est_id);
              if (typeof window !== 'undefined') {
                localStorage.setItem('parking_est_id', String(employeeData.est_id));
              }
              return employeeData.est_id;
            }
          }

          // Si no es dueño ni empleado asignado
          console.log(`⚠️ Usuario no tiene estacionamiento ni asignación`);
          setEstId(null);
          return null;

        } catch (error) {
          console.error(`❌ Error obteniendo estId:`, error);
          setEstId(null);
          return null;
        }
      };

      // Obtener el estId
      getUserEstId();
    } else {
      console.log(`🚪 Usuario no autenticado, reseteando datos`);
      // Resetear los datos cuando no hay usuario
      setEstId(null);
      setRates(null);
      setUserSettings(null);
      setParkedVehicles(null);
      setParkingHistory(null);
      setParkingCapacity(null);
    }
  }, [user?.id, userRole, roleLoading]);


  // Función para obtener el rol del usuario
  const fetchUserRole = async () => {
    console.log('🔍 fetchUserRole llamado - user?.id:', user?.id, 'roleLoading:', roleLoading);
    if (!user?.id || roleLoading) return;

    console.log('🚀 Iniciando determinación de rol...');
    setRoleLoading(true);

    try {
      // Verificar cache primero
      const cachedRole = localStorage.getItem('user_role');
      console.log('📦 Cache role:', cachedRole);
      if (cachedRole) {
        try {
          const { role, timestamp } = JSON.parse(cachedRole);
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            console.log('✅ Usando rol de cache:', role);
            setUserRole(role);
            setRoleLoading(false);
            return;
          }
        } catch (e) {
          localStorage.removeItem('user_role');
        }
      }

      // Consultar API con timeout
      console.log('🌐 Consultando API /api/auth/get-role...');

      // Crear un AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

      try {
        const response = await fetch('/api/auth/get-role', {
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        console.log('📡 Respuesta API status:', response.status);

        if (response.ok) {
          const data = await response.json();
          const role = data.role;

          console.log('🎭 Rol obtenido de API:', role, 'para usuario:', user?.email);

          if (role === 'owner' || role === 'playero' || role === 'conductor') {
            console.log('✅ Estableciendo userRole a:', role);
            setUserRole(role);
            localStorage.setItem('user_role', JSON.stringify({
              role,
              timestamp: Date.now()
            }));
          } else {
            console.log('❌ Rol desconocido:', role, 'estableciendo a null');
            setUserRole(null);
          }
        } else {
          console.log('❌ Error en respuesta API:', response.status, response.statusText);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          console.log('⏰ Timeout en consulta de rol después de 10 segundos');
        } else {
          console.error('❌ Error en consulta de rol:', fetchError);
        }
        throw fetchError; // Re-lanzar para que sea manejado por el catch exterior
      }
    } catch (error) {
      console.error('❌ Error obteniendo rol:', error);
    } finally {
      console.log('🏁 Finalizando fetchUserRole, estableciendo roleLoading=false');
      setRoleLoading(false);
    }
  };

  // Efecto para cargar rol del usuario - solo cuando cambia el ID del usuario
  useEffect(() => {
    console.log('🎯 useEffect de rol ejecutándose - user?.id:', user?.id, 'userRole:', userRole);
    if (!user?.id) {
      console.log('❌ No hay user.id, reseteando rol');
      setUserRole(null);
      setRoleLoading(false);
      return;
    }

    // Solo cargar rol si no tenemos uno o si cambió el usuario
    const cachedRole = localStorage.getItem('user_role');
    console.log('📋 Cache actual:', cachedRole, 'userRole actual:', userRole);
    if (cachedRole && userRole) {
      // Ya tenemos rol, no recargar innecesariamente
      console.log('✅ Ya tenemos rol y cache, no recargar');
      return;
    }

    // Llamar inmediatamente para evitar delays en redirección
    console.log('🚀 Ejecutando fetchUserRole inmediatamente...');
    fetchUserRole();

    // No hay timeout que limpiar
  }, [user?.id, userRole]); // Agregar userRole como dependencia para evitar recargas innecesarias

  // Efecto separado: no cargar datos hasta que tengamos rol y estId
  // Solo cargar automáticamente si no estamos en una página que ya maneje sus propios datos
  useEffect(() => {
    if (!user?.id || loadingData) return;
    if (roleLoading || !userRole) return; // esperar a rol

    // Si es conductor, no necesita cargar datos de estacionamiento
    if (userRole === 'conductor') {
      console.log('🚗 Usuario es conductor, evitando carga de datos de estacionamiento');
      return;
    }

    // Para otros roles, necesitamos estId
    if (estId === null) return;

    // Solo hacer carga automática si estamos en páginas que lo necesitan
    const currentPath = pathname || '';
    const shouldAutoLoad = !currentPath.includes('/dashboard'); // El dashboard maneja sus propios datos

    if (!shouldAutoLoad) return;

    const timeoutId = setTimeout(() => {
      fetchUserData();
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [user?.id, estId, userRole, roleLoading]);

  // Efecto específico para ensureParkingSetup - SOLO para owner y playero
  useEffect(() => {
    if (user && userRole && !roleLoading && (userRole === 'owner' || userRole === 'playero')) {
      console.log('🏢 Usuario es owner/playero, ejecutando ensureParkingSetup');
      ensureParkingSetup();
    } else if (user && userRole && !roleLoading && userRole === 'conductor') {
      console.log('🚗 Usuario es conductor, evitando ensureParkingSetup');
    }
  }, [user, userRole, roleLoading]);

  // Efecto para cargar parkings cuando estId está definido pero parkings vacío
  useEffect(() => {
    // Solo ejecutar si:
    // - estId está definido
    // - parkings está vacío
    // - no está cargando actualmente
    // - no es conductor (conductores no necesitan parkings del estacionamiento)
    if (estId !== null && parkings.length === 0 && !parkingsLoading && userRole !== 'conductor') {
      console.log('🔄 estId definido pero parkings vacío, cargando lista...');
      fetchParkings();
    }
  }, [estId, parkings, parkingsLoading, userRole, fetchParkings]);

  useEffect(() => {
    let mounted = true;
    let hasInitialized = false;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          setLastUserId(session?.user?.id ?? null);
          setIsInitialized(true);
          hasInitialized = true;
        }
      } catch (error: any) {
        console.error("Error initializing auth:", error);

        // Si es un error de refresh token, limpiar completamente la sesión
        if (error?.code === 'refresh_token_not_found' ||
          error?.message?.includes('Invalid Refresh Token')) {
          console.log('🧹 Limpiando tokens inválidos...');
          try {
            await supabase.auth.signOut({ scope: 'global' });
          } catch (signOutError) {
            console.error("Error during cleanup:", signOutError);
          }

          // Limpiar estado local
          setUser(null);
          setLastUserId(null);
          clearCache();
        }

      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      // Solo manejar eventos críticos de autenticación
      if (event === "SIGNED_OUT") {
        setUser(null);
        setLastUserId(null);
        clearCache();
        router.push("/auth/login");
      } else if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        setLastUserId(session.user.id);
      } else if (session?.user) {
        setUser(session.user);
        setLastUserId(session.user.id);
      } else {
        setUser(null);
        setLastUserId(null);
      }
    });

    // Inicializar ANTES de establecer el listener
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Listener para actualizaciones manuales de parkedVehicles
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleUpdateParkedVehicles = (event: CustomEvent) => {
      console.log('🔄 Actualizando parkedVehicles manualmente:', event.detail);
      setParkedVehicles(event.detail);
    };

    window.addEventListener('updateParkedVehicles', handleUpdateParkedVehicles as EventListener);

    return () => {
      window.removeEventListener('updateParkedVehicles', handleUpdateParkedVehicles as EventListener);
    };
  }, []);

  const signUp = async ({ email, password, name }: SignUpParams) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;

      // Si el usuario fue creado pero necesita confirmación
      if (data.user && !data.session) {
        console.log("Usuario creado, esperando confirmación de email");
        // El estacionamiento se creará cuando el usuario inicie sesión por primera vez
      }
    } finally {
    }
  };

  const signIn = async ({ email, password }: SignInParams) => {
    const timer = createTimer('AuthContext.signIn');

    try {
      // Solo hacer el inicio de sesión - Supabase se encarga del resto
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        timer.end();
        throw error;
      }

      // Inicio de sesión exitoso
      // Limpiar cache de rol para forzar refetch
      try {
        localStorage.removeItem('user_role');
      } catch { }

      setUserRole(null);
      timer.end();

      // El onAuthStateChange manejará el resto del flujo
      // La determinación del rol la hará el useEffect cuando detecte el cambio de usuario

    } catch (error) {
      timer.end();
      throw error;
    }
  };

  const requestPasswordReset = async ({ email }: PasswordResetRequestParams) => {
    try {
      const baseUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        'http://localhost:3000';
      const redirectTo = `${baseUrl}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
    } finally {
    }
  };

  const updatePassword = async ({ newPassword }: PasswordUpdateParams) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } finally {
    }
  };

  const signOut = async () => {
    try {
      // Primero limpiar el estado local y caché
      setUser(null);
      clearCache();

      // Limpiar cualquier dato adicional que pueda quedar
      if (typeof window !== 'undefined') {
        // Limpiar todo el localStorage relacionado con la app
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('parking_') || key.startsWith('supabase') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });

        // Limpiar sessionStorage también
        sessionStorage.clear();
      }

      // Intentar cerrar sesión en Supabase con scope global
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      // Si hay un error de sesión faltante, no es crítico
      // ya que significa que no había sesión activa para cerrar
      if (error && !error.message.includes("Auth session missing")) {
        console.error("Error al cerrar sesión:", error);
      }

      // Usar router para navegación consistente
      router.push("/auth/login");
    } catch (error: any) {
      console.error("Error durante el cierre de sesión:", error);

      // Incluso si hay error, limpiar el estado local completamente
      setUser(null);
      clearCache();

      // Limpiar localStorage y sessionStorage
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('parking_') || key.startsWith('supabase') || key.startsWith('sb-')) {
            localStorage.removeItem(key);
          }
        });
        sessionStorage.clear();
      }
      router.push("/auth/login");
    } finally {
    }
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        estId,
        rates,
        userSettings,
        parkedVehicles,
        parkingHistory,
        parkingCapacity,
        loadingUserData,
        initRatesDone,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
        fetchUserData,
        refreshParkedVehicles,
        refreshParkingHistory,
        initializeRates,
        refreshCapacity,
        setEstId,
        ensureParkingSetup,
        signInWithGoogle,
        userRole,
        roleLoading,
        invalidateRoleCache: () => {
          localStorage.removeItem('user_role');
          setUserRole(null);
          setRoleLoading(false);
        },
        // Estado centralizado de parkings
        parkings,
        parkingsUser,
        parkingsLoading,
        parkingsError,
        fetchParkings,
        refreshParkings,
        getParkingById,
        clearParkings,
        clearAuthCompletely,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return context;
};
