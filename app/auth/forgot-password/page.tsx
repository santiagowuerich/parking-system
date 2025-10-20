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
      setError(err.message || "No se pudo enviar el correo de recuperación.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#bfc3cb] flex flex-col items-center justify-center">
        {/* Logo */}
        <div className="absolute top-8 left-12">
          <Logo width={200} height={54} />
        </div>
        {/* Card de Éxito */}
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Correo enviado</h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Te enviamos un correo electrónico a <strong>{email}</strong> con las instrucciones para recuperar tu contraseña.
          </p>
          <p className="text-sm text-gray-500 text-center mb-6">
            Si no recibís el correo en unos minutos, revisá tu carpeta de spam o intentá nuevamente.
          </p>
          <Link
            href="/auth/login"
            className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md text-center hover:bg-[#174ea6] transition"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#bfc3cb] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="absolute top-8 left-12">
        <Logo width={200} height={54} />
      </div>
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Recuperar contraseña</h2>
          <Link href="/auth/login" className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Ingresá tu correo electrónico y te enviaremos instrucciones para recuperar tu contraseña.
        </p>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md hover:bg-[#174ea6] transition disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar correo"}
            </button>
            <Link
              href="/auth/login"
              className="w-full py-2 bg-gray-100 text-gray-700 font-semibold rounded-md text-center border border-gray-300 hover:bg-gray-200 transition"
            >
              Cancelar
            </Link>
          </div>
        </form>
        <p className="text-sm text-center text-gray-500 mt-4">
          ¿Ya tenés cuenta?{" "}
          <Link href="/auth/login" className="font-medium text-[#2563eb] hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
