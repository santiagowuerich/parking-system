import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// GET - Obtener todos los estacionamientos (solo para debug)
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: estacionamientos, error } = await supabase
            .from('estacionamientos')
            .select('est_id, due_id, est_nombre, est_direc, est_locali')
            .order('est_id');

        if (error) {
            console.error('Error obteniendo todos los estacionamientos:', error);
            return NextResponse.json(
                { error: "Error al obtener estacionamientos" },
                { status: 500 }
            );
        }

        return NextResponse.json(estacionamientos || []);

    } catch (error) {
        console.error('Error en GET /api/estacionamientos:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
