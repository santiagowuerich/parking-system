"use client";


import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function SecuritySettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Nombre (perfil)
  const [name, setName] = useState<string>("");
  const [savingName, setSavingName] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState<string>("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName((user.user_metadata as any)?.name || "");
    setNewEmail(user.email || "");
  }, [user]);

  if (!user) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-4">
          <Alert>
            <AlertDescription>
              Debe iniciar sesión para gestionar la seguridad de su cuenta.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button asChild>
              <Link href="/auth/login">Ir a iniciar sesión</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const handleSaveName = async () => {
    try {
      setSavingName(true);
      const { error } = await supabase.auth.updateUser({ data: { name } });
      if (error) throw error;
      toast({ title: "Nombre actualizado", description: "Se guardó el nombre de perfil." });
      router.refresh();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message || "No se pudo actualizar" });
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    setEmailMsg(null);
    try {
      if (!newEmail || newEmail === user.email) {
        toast({ title: "Sin cambios", description: "El email es el mismo." });
        return;
      }
      setSavingEmail(true);
      const { error } = await supabase.auth.updateUser({ email: newEmail });
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
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold dark:text-zinc-100">Seguridad de la cuenta</h1>
          <Button variant="outline" className="dark:border-zinc-700 dark:text-zinc-100" asChild>
            <Link href="/dashboard">Volver al Dashboard</Link>
          </Button>
        </div>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="dark:text-zinc-400">Nombre para mostrar</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>
            <Button onClick={handleSaveName} disabled={savingName} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">
              {savingName ? "Guardando..." : "Guardar nombre"}
            </Button>
          </CardContent>
        </Card>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Correo electrónico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="dark:text-zinc-400">Nuevo correo</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
              />
            </div>
            {emailMsg && (
              <p className="text-sm text-emerald-400">{emailMsg}</p>
            )}
            <Button onClick={handleSaveEmail} disabled={savingEmail} className="dark:bg-white dark:text-black dark:hover:bg-gray-200">
              {savingEmail ? "Enviando..." : "Guardar email"}
            </Button>
            <p className="text-xs text-zinc-400">Te enviaremos un enlace de verificación al nuevo correo.</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="dark:text-zinc-100">Cambiar contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1">
                <Label className="dark:text-zinc-400">Contraseña actual</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  required
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


