"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/lib/auth-context";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

export default function PerfilPage() {
  const { user } = useAuth();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Datos personales
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Email cambio
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // Contraseña
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  // Cargar datos del usuario
  const loadUserProfile = async () => {
    try {
      setLoadingProfile(true);
      const response = await fetch("/api/usuario/profile");
      if (response.ok) {
        const data = await response.json();
        setNombre(data.nombre || "");
        setApellido(data.apellido || "");
        setTelefono(data.telefono || "");
        setEmail(data.email || "");
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar los datos del perfil"
        });
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al cargar el perfil"
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <Alert>
            <AlertDescription>
              Debes iniciar sesión para gestionar tu perfil.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // Guardar datos personales
  const handleSaveProfile = async () => {
    if (!nombre || !apellido) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Nombre y apellido son obligatorios"
      });
      return;
    }

    try {
      setSavingProfile(true);
      const response = await fetch("/api/usuario/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, apellido, telefono })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al actualizar");
      }

      toast({
        title: "Información actualizada",
        description: "Tus datos personales fueron actualizados correctamente"
      });
      router.refresh();
    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: e.message || "No se pudo actualizar"
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailMsg(null);
    try {
      if (!email || email === user.email) {
        toast({ title: "Sin cambios", description: "El email es el mismo." });
        return;
      }
      setSavingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: email });
      if (error) throw error;
      setEmailMsg(
        "Te enviamos un correo de confirmación al nuevo email. Seguí el enlace para completar el cambio."
      );
      toast({ title: "Verificá tu correo", description: "Confirmá el cambio de email desde el enlace enviado." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo actualizar el email" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    if (newPassword.length < 6) {
      setPassError("La contraseña nueva debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError("Las contraseñas no coinciden.");
      return;
    }
    if (!user.email) {
      setPassError("No se pudo identificar su email actual.");
      return;
    }
    try {
      setChangingPass(true);
      // Verificar contraseña actual
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signErr) {
        setPassError("La contraseña actual es incorrecta.");
        return;
      }
      // Actualizar a la nueva contraseña
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Contraseña actualizada", description: "Tu contraseña fue cambiada con éxito." });
    } catch (e: any) {
      setPassError(e.message || "No se pudo cambiar la contraseña");
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100">Usuario</h1>
          <p className="text-gray-600 dark:text-zinc-400">Gestiona tu información personal y configuración de seguridad</p>
        </div>

        {/* Card 1: Información Personal */}
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Información Personal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingProfile ? (
              <div className="text-center py-4">
                <p className="text-zinc-500 dark:text-zinc-400">Cargando datos...</p>
              </div>
            ) : (
              <>
                {/* Grid 2 columnas para nombre y apellido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="dark:text-zinc-400">Nombre</Label>
                    <Input
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                      required
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="dark:text-zinc-400">Apellido</Label>
                    <Input
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                      required
                      placeholder="Tu apellido"
                    />
                  </div>
                </div>

                {/* Teléfono */}
                <div className="space-y-1">
                  <Label className="dark:text-zinc-400">Teléfono</Label>
                  <Input
                    type="tel"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    placeholder="Opcional"
                  />
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <Label className="dark:text-zinc-400">Correo electrónico</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    required
                    placeholder="Tu email"
                  />
                  <p className="text-xs text-zinc-400">
                    Si cambias tu email, recibirás un enlace de confirmación
                  </p>
                </div>

                {/* Mensajes */}
                {emailMsg && (
                  <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                    <AlertDescription className="text-emerald-700 dark:text-emerald-400">
                      {emailMsg}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Botones */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile || loadingProfile}
                    className="dark:bg-white dark:text-black dark:hover:bg-gray-200"
                  >
                    {savingProfile ? "Guardando..." : "Guardar información"}
                  </Button>

                  {email !== user?.email && (
                    <Button
                      onClick={handleSaveEmail}
                      disabled={savingEmail}
                      variant="outline"
                      className="dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      {savingEmail ? "Enviando..." : "Actualizar email"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Cambiar Contraseña */}
        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Cambiar Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <Label className="dark:text-zinc-400">Contraseña actual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  required
                  placeholder="Tu contraseña actual"
                />
              </div>
              <div className="space-y-1">
                <Label className="dark:text-zinc-400">Nueva contraseña</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  minLength={6}
                  required
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div className="space-y-1">
                <Label className="dark:text-zinc-400">Confirmar nueva contraseña</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  minLength={6}
                  required
                  placeholder="Confirma tu nueva contraseña"
                />
              </div>
              {passError && (
                <Alert variant="destructive">
                  <AlertDescription>{passError}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={changingPass} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">
                {changingPass ? "Actualizando..." : "Actualizar contraseña"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}


