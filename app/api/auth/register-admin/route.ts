import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar si el usuario actual es administrador
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Esta funcionalidad requiere permisos de administrador
        // Por ahora devolver un mensaje de que no está implementado
        return NextResponse.json(
            { error: "Funcionalidad de registro de administrador no implementada" },
            { status: 501 }
        );
    } catch (error) {
        console.error("Error en register-admin:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
