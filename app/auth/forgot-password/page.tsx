"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await requestPasswordReset({ email });
      setMessage("Revisá tu correo y seguí el enlace para restablecer tu contraseña.");
    } catch (err: any) {
      console.error("Error en recuperación de contraseña:", err);
      if (err.message?.includes("User not found")) {
        setError("No encontramos una cuenta con ese email.");
      } else {
        setError(err.message || "No se pudo enviar el correo de recuperación. Verificá que el email sea correcto.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded shadow-md">
        <h2 className="text-2xl font-bold text-center text-zinc-100">Recuperar contraseña</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-400">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md"
            />
          </div>
          {message && (
            <p className="text-sm text-green-300">
              {message} Si no lo ves, revisá la carpeta de spam.
            </p>
          )}
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-medium text-black bg-white rounded-md disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
          {message && (
            <div className="mt-4 text-center">
              <Link href="/auth/reset-password" className="text-zinc-100 underline">
                Ya tengo el enlace, ir a restablecer
              </Link>
            </div>
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



