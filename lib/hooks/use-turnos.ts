import { useTurnosContext } from '@/lib/turnos-context';
import { useUserRole } from '@/lib/use-user-role';
import { useMemo } from 'react';

/**
 * Hook simplificado para manejar turnos de playeros
 * Wrapper sobre TurnosContext con helpers adicionales
 */
export function useTurnos() {
    const turnosContext = useTurnosContext();
    const { isEmployee } = useUserRole();

    return useMemo(() => {
        const { turnoActivo, tieneTurnoActivo, loading, error, checkTurnoActivo, refreshTurnoEstado } = turnosContext;

        /**
         * Helper para verificar si se requiere turno activo
         * Owners no requieren turno, solo empleados
         */
        const requiereTurnoActivo = (): boolean => {
            if (!isEmployee) return false; // Owners no requieren turno
            return !tieneTurnoActivo;
        };

        /**
         * Helper para validar si puede realizar acciones operativas
         */
        const puedeOperar = (): boolean => {
            if (!isEmployee) return true; // Owners siempre pueden operar
            return tieneTurnoActivo;
        };

        return {
            turnoActivo,
            tieneTurnoActivo,
            loading,
            error,
            checkTurnoActivo,
            refreshTurnoEstado,
            requiereTurnoActivo,
            puedeOperar,
            isEmployee, // Exponer para validaciones
        };
    }, [turnosContext, isEmployee]);
}
