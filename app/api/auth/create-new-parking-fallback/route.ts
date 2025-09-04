import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { name, email } = await request.json();

        if (!name || !email) {
            return NextResponse.json(
                { error: "Nombre y email son requeridos" },
                { status: 400 }
            );
        }

        const { supabase, response } = createClient(request);

        // Verificar que el usuario esté autenticado
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Verificar que el email coincida
        if (user.email !== email) {
            return NextResponse.json(
                { error: "Email no coincide con usuario autenticado" },
                { status: 403 }
            );
        }

        console.log(`🏗️ [FALLBACK] Creando nuevo estacionamiento "${name}" para usuario: ${email}`);

        // 1. Verificar si el usuario existe en tabla tradicional
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado en sistema tradicional" }, { status: 404 });
        }

        const usuarioId = usuarioData.usu_id;

        // 2. Verificar que el usuario sea dueño
        const { data: duenoData, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioId)
            .single();

        if (duenoError || !duenoData) {
            return NextResponse.json({ error: "Usuario no tiene permisos de dueño" }, { status: 403 });
        }

        // 3. Estrategia FALLBACK: No especificar est_id y dejar que la BD lo genere
        console.log(`🔧 [FALLBACK] Insertando sin especificar est_id (dejar que BD genere)`);

        const { data: insertResult, error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .insert({
                // NO especificar est_id - dejar que la BD lo genere automáticamente
                est_prov: 'Por configurar',
                est_locali: 'Por configurar',
                est_direc: 'Dirección por configurar',
                est_nombre: name,
                est_capacidad: 0,
                due_id: usuarioId,
                est_cantidad_espacios_disponibles: 0,
                est_horario_funcionamiento: 24,
                est_tolerancia_min: 15
            })
            .select('est_id') // Obtener el ID generado
            .single();

        if (estacionamientoError) {
            console.error("❌ [FALLBACK] Error creando estacionamiento:", estacionamientoError);

            // Si aún así falla, intentar con una estrategia más agresiva
            console.log("🔄 [FALLBACK] Intentando estrategia alternativa...");

            // Obtener el máximo ID actual
            const { data: maxData } = await supabase
                .from('estacionamientos')
                .select('est_id')
                .order('est_id', { ascending: false })
                .limit(1);

            const maxId = maxData?.[0]?.est_id || 0;
            const newId = maxId + Math.floor(Math.random() * 100) + 1; // Agregar un número aleatorio para evitar conflictos

            console.log(`🎲 [FALLBACK] Intentando con ID aleatorio: ${newId}`);

            const { data: fallbackResult, error: fallbackError } = await supabase
                .from('estacionamientos')
                .insert({
                    est_id: newId,
                    est_prov: 'Por configurar',
                    est_locali: 'Por configurar',
                    est_direc: 'Dirección por configurar',
                    est_nombre: name,
                    est_capacidad: 0,
                    due_id: usuarioId,
                    est_cantidad_espacios_disponibles: 0,
                    est_horario_funcionamiento: 24,
                    est_tolerancia_min: 15
                })
                .select('est_id')
                .single();

            if (fallbackError) {
                console.error("❌ [FALLBACK] Error en estrategia alternativa:", fallbackError);
                return NextResponse.json({
                    error: "Error creando estacionamiento - todas las estrategias fallaron",
                    details: fallbackError.message
                }, { status: 500 });
            }

            const generatedEstId = fallbackResult.est_id;
            console.log(`✅ [FALLBACK] Estacionamiento creado exitosamente con ID: ${generatedEstId}`);

            return NextResponse.json({
                success: true,
                estacionamiento_id: generatedEstId,
                message: `Estacionamiento "${name}" creado exitosamente`,
                details: {
                    est_id: generatedEstId,
                    est_nombre: name,
                    usuario_id: usuarioId,
                    plazas_creadas: 0,
                    strategy: 'fallback_random_id'
                }
            });
        }

        const generatedEstId = insertResult.est_id;
        console.log(`✅ [FALLBACK] Estacionamiento creado exitosamente con ID: ${generatedEstId}`);

        return NextResponse.json({
            success: true,
            estacionamiento_id: generatedEstId,
            message: `Estacionamiento "${name}" creado exitosamente`,
            details: {
                est_id: generatedEstId,
                est_nombre: name,
                usuario_id: usuarioId,
                plazas_creadas: 0,
                strategy: 'auto_generated_id'
            }
        });

    } catch (error) {
        console.error("❌ [FALLBACK] Error general:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
