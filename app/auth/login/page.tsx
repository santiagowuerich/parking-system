"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn({ email, password });
      // El AuthContext se encargará de la redirección en el useEffect
      // No necesitamos empujar la ruta aquí explícitamente
       console.log("Inicio de sesión exitoso, esperando redirección...");
      // router.push('/'); // Eliminado para dejar que el contexto maneje la redirección
    } catch (err: any) {
      console.error("Error en el inicio de sesión:", err);
      setError(err.message || "Error al iniciar sesión. Verifica tus credenciales.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 border border-zinc-800 rounded shadow-md">
        <h2 className="text-2xl font-bold text-center text-zinc-100">Iniciar Sesión</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-400"
            >
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm placeholder:text-zinc-400"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-400"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm placeholder:text-zinc-400"
            />
          </div>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 text-sm font-medium text-black bg-white border border-transparent rounded-md shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? "Iniciando..." : "Iniciar Sesión"}
            </button>
          </div>
        </form>
         <p className="text-sm text-center text-zinc-400">
          ¿No tienes cuenta?{" "}
          <Link href="/auth/register" className="font-medium text-zinc-100 hover:text-zinc-300">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
} 