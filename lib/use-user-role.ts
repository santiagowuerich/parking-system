import { useAuth } from './auth-context';
import { useMemo } from 'react';

/**
 * Hook personalizado para manejar roles de usuario de manera simplificada
 * Proporciona helpers convenientes para validaciones de roles
 */
export function useUserRole() {
    const { userRole, roleLoading, invalidateRoleCache } = useAuth();

    return useMemo(() => {
        const isOwner = userRole === 'owner';
        const isEmployee = userRole === 'playero';

        return {
            // Estado del rol
            role: userRole,
            loading: roleLoading,

            // Helpers booleanos para validaciones comunes
            isOwner,
            isEmployee,

            // Helpers para permisos específicos
            canManageEmployees: userRole === 'owner',
            canManageRates: userRole === 'owner',
            canManageZones: userRole === 'owner',
            canManagePayments: userRole === 'owner',
            canOperateParking: userRole === 'owner' || userRole === 'playero',
            canViewReports: userRole === 'owner',
            canConfigureSystem: userRole === 'owner',

            // Función para refrescar rol (útil después de cambios en asignaciones)
            refreshRole: () => {
                invalidateRoleCache();
            },

            // Función para verificar si el usuario tiene un rol específico
            hasRole: (requiredRole: 'owner' | 'playero') => {
                return userRole === requiredRole;
            },

            // Función para verificar si el usuario tiene alguno de los roles especificados
            hasAnyRole: (roles: ('owner' | 'playero')[]) => {
                return roles.includes(userRole as any);
            },

            // Función para verificar permisos basados en rol
            hasPermission: (permission: string) => {
                const permissionMap: Record<string, ('owner' | 'playero')[]> = {
                    'manage_employees': ['owner'],
                    'manage_rates': ['owner'],
                    'manage_zones': ['owner'],
                    'manage_payments': ['owner'],
                    'operate_parking': ['owner', 'playero'],
                    'view_reports': ['owner'],
                    'configure_system': ['owner'],
                    'view_dashboard': ['owner', 'playero'],
                };

                const allowedRoles = permissionMap[permission];
                return allowedRoles ? allowedRoles.includes(userRole as any) : false;
            },
        };
    }, [userRole, roleLoading, invalidateRoleCache]);
}
