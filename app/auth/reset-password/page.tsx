"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mostrar aviso si no hay sesión de recuperación
  const [recoveryReady, setRecoveryReady] = useState(false);
  useEffect(() => {
    const check = async () => {
      try {
        // Si el usuario navegó aquí desde el correo, Supabase abre una "recovery" session
        // Podemos intentar obtener la sesión; si no hay, igualmente permitir cambiar contraseña si está autenticado
        setRecoveryReady(true);
      } catch {
        setRecoveryReady(false);
      }
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      await updatePassword({ newPassword });
      setMessage("Tu contraseña fue actualizada. Ya podés iniciar sesión.");
      // Cerrar sesión de forma silenciosa y redirigir al login (sin recargar la página)
      try { await supabase.auth.signOut({ scope: 'global' }); } catch {}
      setTimeout(() => {
        router.replace('/auth/login?reset=ok');
      }, 1500);
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la contraseña");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded shadow-md">
        <h2 className="text-2xl font-bold text-center text-zinc-100">Restablecer contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-zinc-400">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-400">
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md"
            />
          </div>
          {message && <p className="text-sm text-green-300">{message}</p>}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-black bg-white rounded-md disabled:opacity-50"
          >
            {loading ? "Actualizando..." : "Actualizar contraseña"}
          </button>
          {message && (
            <p className="text-sm text-green-300 text-center mt-3">
              {message} <Link href="/auth/login" className="underline">Ir al inicio de sesión</Link>
            </p>
          )}
          {!recoveryReady && (
            <p className="text-xs text-zinc-400 text-center mt-2">
              Si llegaste aquí sin usar el enlace del correo, volvé a solicitar recuperación o iniciá sesión y cambiá tu contraseña desde Cuenta → Seguridad.
            </p>
          )}
        </form>
        <p className="text-sm text-center text-zinc-400">
          <Link href="/auth/login" className="font-medium text-zinc-100 hover:text-zinc-300">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}



