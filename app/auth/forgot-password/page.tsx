"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await requestPasswordReset({ email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Error al enviar el correo de recuperación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fa] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-8">
        <Logo width={200} height={54} priority />
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-2">Recuperar Contraseña</h2>

        {!success ? (
          <>
            <p className="text-sm text-center text-gray-500 mb-6">
              Ingresá tu correo electrónico y te enviaremos un link para restablecer tu contraseña
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  required
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900 disabled:opacity-50"
                />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md hover:bg-[#174ea6] transition disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar Link de Recuperación"}
              </button>

              <Link
                href="/auth/login"
                className="block text-center text-sm text-[#2563eb] hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </form>
          </>
        ) : (
          <div className="text-center space-y-4">
            {/* Icono de éxito */}
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            {/* Mensaje de éxito */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¡Correo Enviado!
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Te enviamos un link de recuperación a <strong>{email}</strong>
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Revisá tu bandeja de entrada y hacé clic en el link para restablecer tu contraseña.
                Si no lo ves, revisá la carpeta de spam.
              </p>
            </div>

            {/* Botones */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
                className="w-full py-2 text-sm text-[#2563eb] hover:underline"
              >
                Enviar a otro correo
              </button>
              <Link
                href="/auth/login"
                className="block w-full py-2 bg-gray-100 text-gray-700 font-semibold rounded-md text-center border border-gray-300 hover:bg-gray-200 transition"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
