"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type SignUpParams = {
  name: string;
  email: string;
  password: string;
};

type User = {
  id: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signUp: (params: SignUpParams) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>(null!);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedId = localStorage.getItem("adminId");
    const savedEmail = localStorage.getItem("adminEmail");

    console.log("🔍 Datos en localStorage:", { savedId, savedEmail });

    if (savedId && savedEmail) {
      setUser({ id: savedId, email: savedEmail });
      console.log("✅ Usuario cargado del localStorage");
    } else {
      console.warn("⛔ No hay sesión activa en localStorage");
    }

    setLoading(false);
  }, []);

  const signUp = async ({ name, email, password }: SignUpParams) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error en el registro");
  };

  const signIn = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Error en el login");

    const adminId = data.adminId;

    if (!adminId || !email) {
      console.error("❌ Datos inválidos del login:", { adminId, email });
      throw new Error("Datos inválidos al iniciar sesión");
    }

    console.log("✅ Login exitoso. Guardando en localStorage:", {
      adminId,
      email,
    });

    localStorage.setItem("adminId", String(adminId));
    localStorage.setItem("adminEmail", String(email));

    setUser({ id: String(adminId), email });

    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn }}>
      {children}
    </AuthContext.Provider>
  );
};
