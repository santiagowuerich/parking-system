import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

/**
 * Hook para manejar redirección automática después del login
 * basado en el rol del usuario
 */
export function useAutoRedirect() {
    const { user, userRole, roleLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Solo ejecutar si hay usuario autenticado y rol determinado
        if (!user || roleLoading || !userRole) {
            return;
        }

        // Redirigir según el rol
        const currentPath = window.location.pathname;

        // Solo redirigir si estamos en páginas de auth (evitar loops)
        if (currentPath.startsWith('/auth') && !currentPath.includes('/reset-password')) {
            let redirectPath = '/dashboard'; // Default

            switch (userRole) {
                case 'owner':
                    redirectPath = '/dashboard';
                    break;
                case 'playero':
                    redirectPath = '/dashboard/mis-turnos'; // Playeros van directo a sus turnos
                    break;
                case 'conductor':
                    redirectPath = '/conductor';
                    break;
                default:
                    redirectPath = '/dashboard';
            }

            console.log(`🔄 Auto-redirigiendo usuario ${userRole} a ${redirectPath}`);
            router.push(redirectPath);
        }
    }, [user, userRole, roleLoading, router]);
}
