"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword({ newPassword: password });
      setMessage("Contraseña actualizada correctamente.");
    } catch (err: any) {
      setError(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#bfc3cb] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="absolute top-8 left-12">
        <span className="text-4xl font-bold text-[#2563eb] tracking-tight">Parqeo</span>
      </div>
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Nueva contraseña</h2>
          <Link href="/auth/login" className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</Link>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Ingresá tu nueva contraseña y confirmala para actualizar tu acceso.
        </p>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            />
          </div>
          <div>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              placeholder="Confirmar contraseña"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {message && <p className="text-sm text-green-500">{message}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md hover:bg-[#174ea6] transition disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar contraseña"}
            </button>
            <Link
              href="/auth/login"
              className="w-full py-2 bg-gray-100 text-gray-700 font-semibold rounded-md text-center border border-gray-300 hover:bg-gray-200 transition"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}