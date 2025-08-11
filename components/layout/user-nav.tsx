"use client";

import { useAuth } from "@/lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export function UserNav() {
  const { user, signOut, estId, setEstId } = useAuth();

  if (!user) return null;

  const initials = (user.email?.split("@")[0] ?? "AD")
    .split(".")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const nameToShow = user.email?.split("@")[0] ?? "Administrador";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error: any) {
      console.error("Error al cerrar sesión:", error);
      // Incluso si hay error, forzar la navegación al login
      // ya que la función signOut debería haber limpiado el estado
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={String(estId)} onValueChange={(v)=> setEstId(parseInt(v))}>
        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Est." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Est. 1</SelectItem>
          <SelectItem value="2">Est. 2</SelectItem>
        </SelectContent>
      </Select>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={nameToShow} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{nameToShow}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
