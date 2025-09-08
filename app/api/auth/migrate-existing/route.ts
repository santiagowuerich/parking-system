import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

// Este endpoint es para migrar usuarios existentes que no tienen estacionamiento
export async function POST(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        console.log(`🔄 Iniciando migración para usuario: ${user.email}`);

        // Verificar si el usuario ya tiene estacionamiento
        const checkResponse = await fetch(`${request.nextUrl.origin}/api/auth/get-parking-id`, {
            headers: {
                'Cookie': request.headers.get('Cookie') || ''
            }
        });

        if (checkResponse.ok) {
            const checkData = await checkResponse.json();

            if (checkData.has_parking) {
                return NextResponse.json({
                    already_migrated: true,
                    message: "Usuario ya tiene estacionamiento configurado",
                    est_id: checkData.est_id
                });
            }
        }

        // Si no tiene estacionamiento, crearlo usando el endpoint setup-parking
        const setupResponse = await fetch(`${request.nextUrl.origin}/api/auth/setup-parking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': request.headers.get('Cookie') || ''
            },
            body: JSON.stringify({
                email: user.email,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario'
            }),
        });

        if (setupResponse.ok) {
            const setupData = await setupResponse.json();
            console.log(`✅ Usuario migrado exitosamente:`, setupData);

            return NextResponse.json({
                migrated: true,
                message: "Usuario migrado exitosamente al nuevo sistema",
                ...setupData
            });
        } else {
            const setupError = await setupResponse.text();
            console.error(`❌ Error en migración:`, setupError);

            return NextResponse.json({
                migrated: false,
                error: "Error durante la migración"
            }, { status: 500 });
        }

    } catch (error) {
        console.error("❌ Error general en migración:", error);
        return NextResponse.json(
            { error: "Error interno del servidor durante migración" },
            { status: 500 }
        );
    }
}
