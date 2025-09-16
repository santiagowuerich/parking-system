"use client";

import { useState, useEffect } from "react";
import { useAuth } from "./auth-context";

// Tipos de roles
export type UserRole = 'owner' | 'playero' | 'unknown';

// Hook para determinar el rol del usuario
export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>('unknown');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const determineUserRole = async () => {
      if (!user?.id) {
        console.log('🚫 No hay usuario autenticado');
        setRole('unknown');
        setLoading(false);
        return;
      }

      console.log('🔍 Determinando rol para usuario:', user.id);

      try {
        setLoading(true);
        setError(null);

        // Llamar a la API route para determinar el rol
        // La API route obtendrá el usuario desde la sesión del servidor
        const response = await fetch('/api/auth/get-role', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.log('❌ Error en API get-role:', errorData);
          setRole('unknown');
          setLoading(false);
          return;
        }

        const roleData = await response.json();
        console.log('✅ Rol determinado:', roleData);

        setRole(roleData.role);

      } catch (err) {
        console.error('❌ Error determinando rol:', err);
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setRole('unknown');
      } finally {
        setLoading(false);
      }
    };

    determineUserRole();
  }, [user?.id]);

  // Flags booleanos para facilitar el uso
  const isOwner = role === 'owner';
  const isPlayero = role === 'playero';
  const isUnknown = role === 'unknown';

  return {
    role,
    loading,
    error,
    // Flags booleanos
    isOwner,
    isPlayero,
    isUnknown,
    // Método para refrescar el rol
    refreshRole: () => {
      if (user?.id) {
        // Forzar recarga del efecto
        setLoading(true);
        setError(null);
      }
    }
  };
}