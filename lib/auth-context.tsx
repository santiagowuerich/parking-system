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
  fetchUserData: () => Promise<void>;
  refreshParkedVehicles: () => Promise<void>;
  refreshParkingHistory: () => Promise<void>;
  initializeRates: () => Promise<void>;
}>({
  user: null,
  loading: true,
  rates: null,
  userSettings: null,
  parkedVehicles: null,
  parkingHistory: null,
  parkingCapacity: null,
  loadingUserData: false,
  initRatesDone: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  fetchUserData: async () => {},
  refreshParkedVehicles: async () => {},
  refreshParkingHistory: async () => {},
  initializeRates: async () => {},
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
  const router = useRouter();
  const pathname = usePathname();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
    if (!user?.id) return;
    
    try {
      const parkedResponse = await fetch(`/api/parking/parked?userId=${user.id}`);
      
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
    if (!user?.id) return;
    
    try {
      const historyResponse = await fetch(`/api/parking/history?userId=${user.id}`);
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setParkingHistory(Array.isArray(historyData.history) ? historyData.history : []);
      } else {
        console.error("Error al cargar historial de estacionamiento");
        setParkingHistory([]);
      }
    } catch (error) {
      console.error("Error general al cargar historial de estacionamiento:", error);
      setParkingHistory([]);
    }
  };

  // Función para obtener los datos de tarifas
  const fetchRates = async () => {
    if (!user?.id) return null;
    
    // Verificar si hay datos en localStorage y si son recientes
    const cachedRates = localStorage.getItem(STORAGE_KEYS.RATES);
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.RATES_TIMESTAMP);
    
    if (cachedRates && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_MAX_AGE) {
      console.log('Usando tarifas desde localStorage');
      return JSON.parse(cachedRates);
    }
    
    try {
      const ratesResponse = await fetch(`/api/rates?userId=${user.id}`);
      
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
      const settingsResponse = await fetch(`/api/user/settings?userId=${user.id}`);
      
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
    if (!user?.id) return null;
    
    // Verificar si hay datos en localStorage y si son recientes
    const cachedCapacity = localStorage.getItem(STORAGE_KEYS.CAPACITY);
    const cachedTimestamp = localStorage.getItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);
    
    if (cachedCapacity && cachedTimestamp && (Date.now() - parseInt(cachedTimestamp)) < CACHE_MAX_AGE) {
      console.log('Usando capacidad desde localStorage');
      return JSON.parse(cachedCapacity);
    }
    
    try {
      const capacityResponse = await fetch(`/api/capacity?userId=${user.id}`);
      
      if (capacityResponse.ok) {
        const capacityData = await capacityResponse.json();
        const capacity = capacityData.capacity || { Auto: 0, Moto: 0, Camioneta: 0 };
        
        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEYS.CAPACITY, JSON.stringify(capacity));
        localStorage.setItem(STORAGE_KEYS.CAPACITY_TIMESTAMP, Date.now().toString());
        
        return capacity;
      } else {
        console.error("Error al cargar capacidad del estacionamiento");
        return { Auto: 0, Moto: 0, Camioneta: 0 };
      }
    } catch (error) {
      console.error("Error general al cargar capacidad del estacionamiento:", error);
      return { Auto: 0, Moto: 0, Camioneta: 0 };
    }
  };

  // Función para obtener los datos del usuario (usando las funciones optimizadas)
  const fetchUserData = async () => {
    if (!user?.id) return;
    
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
        fetch(`/api/parking/parked?userId=${user.id}`),
        fetch(`/api/parking/history?userId=${user.id}`)
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
        setParkingHistory(Array.isArray(historyData.history) ? historyData.history : []);
      } else {
        console.error("Error al cargar historial de estacionamiento");
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
    localStorage.removeItem(STORAGE_KEYS.RATES);
    localStorage.removeItem(STORAGE_KEYS.RATES_TIMESTAMP);
    localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.USER_SETTINGS_TIMESTAMP);
    localStorage.removeItem(STORAGE_KEYS.CAPACITY);
    localStorage.removeItem(STORAGE_KEYS.CAPACITY_TIMESTAMP);
    // No eliminamos INIT_RATES_DONE, ya que es independiente del usuario
  };

  // Efecto para manejar redirecciones basadas en autenticación
  useEffect(() => {
    if (!loading) {
      const isAuthRoute = pathname?.startsWith("/auth/");
      if (!user && !isAuthRoute) {
        router.push("/auth/login");
      } else if (user && isAuthRoute) {
        router.push("/");
      }
    }
  }, [user, loading, pathname, router]);

  // Efecto para inicializar tarifas al cargar la aplicación
  useEffect(() => {
    initializeRates();
  }, []);

  // Efecto para cargar los datos del usuario cuando esté autenticado
  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    } else {
      // Resetear los datos cuando no hay usuario
      setRates(null);
      setUserSettings(null);
      setParkedVehicles(null);
      setParkingHistory(null);
      setParkingCapacity(null);
    }
  }, [user?.id]);

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
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) throw error;
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

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      clearCache(); // Limpiar caché al cerrar sesión
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
        fetchUserData,
        refreshParkedVehicles,
        refreshParkingHistory,
        initializeRates,
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
