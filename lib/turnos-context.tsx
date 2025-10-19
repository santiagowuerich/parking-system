"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { useUserRole } from "@/lib/use-user-role";

interface TurnoActivo {
  tur_id: number;
  tur_fecha: string;
  tur_hora_entrada: string;
  tur_estado: string;
  tur_observaciones_entrada?: string;
  caja_inicio: number;
  caja_final?: number;
}

interface TurnosContextType {
  turnoActivo: TurnoActivo | null;
  loading: boolean;
  error: string | null;
  checkTurnoActivo: () => Promise<boolean>;
  refreshTurnoEstado: () => Promise<void>;
  tieneTurnoActivo: boolean;
}

const TurnosContext = createContext<TurnosContextType>({
  turnoActivo: null,
  loading: false,
  error: null,
  checkTurnoActivo: async () => false,
  refreshTurnoEstado: async () => {},
  tieneTurnoActivo: false,
});

export function TurnosProvider({ children }: { children: ReactNode }) {
  const { estId, user } = useAuth();
  const { isEmployee } = useUserRole();
  const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTurnoEstado = useCallback(async () => {
    // Solo cargar turnos para empleados
    if (!isEmployee || !estId || !user) {
      setTurnoActivo(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Obtener play_id del usuario
      const response = await fetch(`/api/auth/get-employee-parking?est_id=${estId}`);
      if (!response.ok) {
        throw new Error('Error al obtener datos del empleado');
      }

      const empleadoData = await response.json();
      const playId = empleadoData.usuario_id;

      // Obtener estado del turno
      const turnoResponse = await fetch(`/api/turnos/estado?play_id=${playId}&est_id=${estId}`);
      if (turnoResponse.ok) {
        const data = await turnoResponse.json();
        setTurnoActivo(data.turno_activo);
      } else {
        setTurnoActivo(null);
      }
    } catch (err) {
      console.error('Error loading turno estado:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar estado del turno');
      setTurnoActivo(null);
    } finally {
      setLoading(false);
    }
  }, [isEmployee, estId, user]);

  const checkTurnoActivo = useCallback(async (): Promise<boolean> => {
    if (!isEmployee) return true; // Owners no requieren turno
    await refreshTurnoEstado();
    return turnoActivo !== null;
  }, [isEmployee, refreshTurnoEstado, turnoActivo]);

  // Cargar estado inicial del turno
  useEffect(() => {
    if (isEmployee && estId && user) {
      refreshTurnoEstado();
    }
  }, [isEmployee, estId, user, refreshTurnoEstado]);

  // Refresh automático cada 5 minutos
  useEffect(() => {
    if (!isEmployee || !estId) return;

    const interval = setInterval(() => {
      refreshTurnoEstado();
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [isEmployee, estId, refreshTurnoEstado]);

  const tieneTurnoActivo = turnoActivo !== null;

  return (
    <TurnosContext.Provider
      value={{
        turnoActivo,
        loading,
        error,
        checkTurnoActivo,
        refreshTurnoEstado,
        tieneTurnoActivo,
      }}
    >
      {children}
    </TurnosContext.Provider>
  );
}

export function useTurnosContext() {
  const context = useContext(TurnosContext);
  if (!context) {
    throw new Error('useTurnosContext must be used within TurnosProvider');
  }
  return context;
}
