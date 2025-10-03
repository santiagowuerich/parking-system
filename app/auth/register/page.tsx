"use client";


import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { Building } from "lucide-react";

export default function RegisterPage() {
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    telefono: "",
    email: "",
    password: "",
    confirm: "",
    terms: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.terms) {
      setError("Debes aceptar los Términos y la Política de Privacidad.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      // 1) Crear en Auth + usuario + dueño vía endpoint específico
      const res = await fetch('/api/auth/register-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          apellido: form.apellido,
          dni: form.dni,
          telefono: form.telefono
        })
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'No se pudo crear la cuenta.' }));
        throw new Error(error || 'No se pudo crear la cuenta.');
      }

      // 2) Iniciar sesión automática para continuar flujo
      await signIn({
        email: form.email,
        password: form.password,
      });
    } catch (err: any) {
      setError(err.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError("No se pudo iniciar con Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fa] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="absolute top-8 left-12">
        <span className="text-4xl font-bold text-[#2563eb] tracking-tight">Parqueo</span>
      </div>

      {/* Back button */}
      <div className="absolute top-8 right-12">
        <Link href="/" className="text-blue-600 hover:text-blue-700 flex items-center font-medium">
          ← Volver al inicio
        </Link>
      </div>
      {/* Card */}
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg p-10 flex flex-col items-center">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-1">Registro de Dueño</h2>
          <p className="text-sm text-gray-500 mb-4">
            Completa tus datos para crear tu cuenta de dueño de estacionamiento
          </p>
          <div className="flex items-center justify-center space-x-2 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            <Building className="w-4 h-4" />
            <span>Permite gestionar estacionamientos y empleados</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              name="nombre"
              type="text"
              placeholder="Tu nombre"
              value={form.nombre}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
            <input
              name="apellido"
              type="text"
              placeholder="Tu apellido"
              value={form.apellido}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              name="dni"
              type="text"
              placeholder="00.000.000"
              value={form.dni}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
            <input
              name="telefono"
              type="text"
              placeholder="+54 9 362 000 0000"
              value={form.telefono}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
          </div>
          <input
            name="email"
            type="email"
            placeholder="tu@correo.com"
            value={form.email}
            onChange={handleChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              name="password"
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
            <input
              name="confirm"
              type="password"
              placeholder="Confirmar contraseña"
              value={form.confirm}
              onChange={handleChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
              required
            />
          </div>
          <div className="flex items-center mb-2">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              checked={form.terms}
              onChange={handleChange}
              className="mr-2"
              required
            />
            <label htmlFor="terms" className="text-sm text-gray-700">
              Acepto los Términos y la Política de Privacidad
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md hover:bg-[#174ea6] transition disabled:opacity-50 mb-2"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>
        <div className="flex items-center my-4 w-full">
          <hr className="flex-grow border-gray-200" />
          <span className="mx-2 text-gray-400 text-sm">O continúa con</span>
          <hr className="flex-grow border-gray-200" />
        </div>
        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-2 flex items-center justify-center border border-gray-300 rounded-md bg-white hover:bg-gray-100 transition mb-2"
        >
          <svg width="20" height="20" viewBox="0 0 48 48" className="mr-2">
            <path fill="#4285F4" d="M24 9.5c3.54 0 6.73 1.22 9.23 3.22l6.9-6.9C36.53 2.36 30.64 0 24 0 14.86 0 6.7 5.74 2.69 14.09l8.06 6.27C12.53 13.13 17.81 9.5 24 9.5z" />
            <path fill="#34A853" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9.02h12.44c-.54 2.92-2.18 5.39-4.64 7.05l7.19 5.59C43.93 37.36 46.1 31.44 46.1 24.5z" />
            <path fill="#FBBC05" d="M10.75 28.36c-1.12-3.29-1.12-6.83 0-10.12l-8.06-6.27C.86 15.86 0 19.81 0 24c0 4.19.86 8.14 2.69 11.77l8.06-6.27z" />
            <path fill="#EA4335" d="M24 48c6.64 0 12.53-2.36 17.13-6.45l-7.19-5.59c-2.01 1.35-4.58 2.14-7.44 2.14-6.19 0-11.47-3.63-13.25-8.86l-8.06 6.27C6.7 42.26 14.86 48 24 48z" />
            <path fill="none" d="M0 0h48v48H0z" />
          </svg>
          Google
        </button>
        <p className="text-sm text-center text-gray-500 mt-2">
          ¿Ya tienes cuenta?{" "}
          <Link href="/auth/login" className="font-medium text-[#2563eb] hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}