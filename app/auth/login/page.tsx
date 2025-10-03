"use client";


import { useState, Suspense } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const resetOk = search?.get('reset') === 'ok';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
      // El middleware se encarga de redirigir según el rol del usuario
    } catch (err: any) {
      if (err.message?.includes("Invalid login credentials")) {
        setError("Email o contraseña incorrectos.");
      } else if (err.message?.includes("Email not confirmed")) {
        setError("Necesitás confirmar tu email antes de iniciar sesión. Revisá tu correo.");
      } else {
        setError(err.message || "Error al iniciar sesión. Verifica tus credenciales.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // El middleware se encarga de redirigir según el rol del usuario
    } catch (err: any) {
      setError("Error al iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f8fa] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-4xl font-bold text-[#2563eb] tracking-tight">Parqueo</span>
      </div>
      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-2">Iniciar Sesión</h2>
        <p className="text-sm text-center text-gray-500 mb-6">
          Ingresa tus credenciales para acceder al sistema
        </p>
        {resetOk && (
          <p className="text-sm text-center text-emerald-500 mb-2">Contraseña actualizada. Iniciá sesión con tu nueva contraseña.</p>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            />
          </div>
          <div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2563eb] text-gray-900"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-[#2563eb] text-white font-semibold rounded-md hover:bg-[#174ea6] transition disabled:opacity-50"
          >
            {loading ? "Iniciando..." : "Iniciar Sesión"}
          </button>
        </form>
        {/* Separador */}
        <div className="flex items-center my-4">
          <hr className="flex-grow border-gray-200" />
          <span className="mx-2 text-gray-400 text-sm">O continúa con</span>
          <hr className="flex-grow border-gray-200" />
        </div>
        {/* Google Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
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
          ¿No tienes una cuenta?{" "}
          <Link href="/auth/register" className="font-medium text-[#2563eb] hover:underline">
            Regístrate
          </Link>
        </p>
        <p className="text-sm text-center text-gray-500 mt-2">
          ¿Olvidaste tu contraseña?{" "}
          <Link href="/auth/forgot-password" className="font-medium text-[#2563eb] hover:underline">
            Recuperar
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f6f8fa] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}