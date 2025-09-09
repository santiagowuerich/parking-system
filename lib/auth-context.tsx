"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { createBrowserClient } from "@supabase/ssr";
import { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { VehicleType, Vehicle, ParkingHistory } from "@/lib/types";

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
  loading: boolean;
  estId: number | null;
  rates: Record<VehicleType, number> | null;
  userSettings: UserSettings | null;
  parkedVehicles: Vehicle[] | null;
  parkingHistory: ParkingHistory[] | null;
  parkingCapacity: Record<VehicleType, number> | null;
  loadingUserData: boolean;
  initRatesDone: boolean;
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
}>({
  user: null,
  loading: true,
  estId: null,
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
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const baseUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        '';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${baseUrl}/`,
        },
      });
      if (error) throw error;

      // Nota: Para Google OAuth, el usuario se creará automáticamente en tabla tradicional
      // cuando se ejecute ensureParkingSetup() después del primer login
      console.log("🔄 Redirigiendo a Google OAuth...");
    } finally {
      setLoading(false);
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
        console.error("Error al cargar vehículos estacionados");
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
  const fetchRates = async () => {
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
  };

  // Función para obtener los datos de configuración del usuario
  const fetchUserSettings = async () => {
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
  };

  // Función para obtener los datos de capacidad
  const fetchCapacity = async () => {
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
  };

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
  const fetchUserData = async () => {
    if (!user?.id || estId === null) return;

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
        console.error("Error al cargar vehículos estacionados");
        setParkedVehicles([]);
      }

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        console.log('✅ Datos del historial recibidos en fetchUserData:', {
          count: historyData.history?.length || 0,
          data: historyData.history?.slice(0, 2) // Mostrar primeros 2 para debug
        });
        setParkingHistory(Array.isArray(historyData.history) ? historyData.history : []);
      } else {
        console.error("❌ Error al cargar historial de estacionamiento en fetchUserData");
        setParkingHistory([]);
      }
    } catch (error) {
      console.error("Error general al cargar datos del usuario:", error);
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
    }
  };

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

  // Efecto para manejar redirecciones basadas en autenticación
  useEffect(() => {
    if (!loading) {
      const isAuthRoute = pathname?.startsWith("/auth/");
      const isPasswordResetRoute = pathname === "/auth/reset-password";
      if (!user && !isAuthRoute) {
        router.push("/auth/login");
      } else if (user && isAuthRoute && !isPasswordResetRoute) {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

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
    if (!user?.email) return;

    try {
      console.log(`🔍 Verificando estacionamiento para usuario: ${user.email}`);
      // Verificar si el usuario ya tiene un estacionamiento
      const checkResponse = await fetch('/api/auth/get-parking-id');

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        console.log('📋 Respuesta de get-parking-id:', checkData);

        if (!checkData.has_parking) {
          console.log("🏗️ Usuario sin estacionamiento, creando...");

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
    if (user?.id) {
      console.log(`👤 Usuario autenticado: ${user.email}, verificando estacionamiento...`);

      // Verificar si hay estId guardado en localStorage
      if (typeof window !== 'undefined') {
        const savedEstId = localStorage.getItem('parking_est_id');
        if (savedEstId) {
          console.log(`📦 estId encontrado en localStorage: ${savedEstId}`);
          setEstId(parseInt(savedEstId));
        } else {
          console.log(`📦 No hay estId en localStorage`);
        }
      }

      // Solo ejecutar ensureParkingSetup si no hay estId válido
      if (estId === null) {
        console.log(`🔍 No hay estId, ejecutando ensureParkingSetup`);
        ensureParkingSetup();
      } else {
        console.log(`✅ Ya hay estId válido: ${estId}, omitiendo ensureParkingSetup`);
      }
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
  }, [user?.id]);

  // Efecto separado para cargar datos cuando estId esté disponible
  useEffect(() => {
    if (user?.id && estId !== null) {
      fetchUserData();
    }
  }, [user?.id, estId]);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setUser(null);
        clearCache(); // Limpiar caché al cerrar sesión
        router.push("/auth/login");
      } else if (session?.user) {
        setUser(session.user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const signUp = async ({ email, password, name }: SignUpParams) => {
    setLoading(true);
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
        console.log("✅ Usuario creado en Supabase Auth, esperando confirmación de email");
        console.log("ℹ️ El usuario se creará en tabla tradicional en el primer login");
      } else if (data.user && data.session) {
        console.log("✅ Usuario creado y autenticado inmediatamente");
        console.log("ℹ️ El usuario se creará en tabla tradicional automáticamente");
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async ({ email, password }: SignInParams) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async ({ email }: PasswordResetRequestParams) => {
    setLoading(true);
    try {
      const baseUrl =
        (typeof window !== 'undefined' ? window.location.origin : '') ||
        process.env.NEXT_PUBLIC_APP_URL ||
        '';
      const redirectTo = `${baseUrl}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async ({ newPassword }: PasswordUpdateParams) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
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

      // Forzar recarga completa de la página para limpiar cualquier estado residual
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      } else {
        router.push("/auth/login");
      }
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
        window.location.href = '/auth/login';
      } else {
        router.push("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null; // O un componente de carga si lo prefieres
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
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
