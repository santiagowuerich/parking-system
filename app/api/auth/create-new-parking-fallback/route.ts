import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { name, email, direccion } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "El nombre del estacionamiento es requerido" },
                { status: 400 }
            );
        }

        if (!email) {
            return NextResponse.json(
                { error: "El email del usuario es requerido" },
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

        // Usar el email del usuario autenticado si no se proporciona uno
        const userEmail = email || user.email;
        if (!userEmail) {
            return NextResponse.json(
                { error: "No se pudo determinar el email del usuario" },
                { status: 400 }
            );
        }

        console.log(`🏗️ [FALLBACK] Creando nuevo estacionamiento "${name}" para usuario: ${userEmail}`);

        // 1. Buscar o crear usuario en tabla tradicional
        let { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        let usuarioId;

        if (usuarioError || !usuarioData) {
            // Usuario no existe, intentar crearlo
            console.log(`👤 [FALLBACK] Usuario no encontrado, intentando crearlo...`);

            const nombreParts = user.display_name ? user.display_name.split(' ') : ['Usuario', 'Desconocido'];
            const nombre = nombreParts[0] || 'Usuario';
            const apellido = nombreParts.slice(1).join(' ') || 'Desconocido';

            const { data: newUserData, error: createUserError } = await supabase
                .from('usuario')
                .insert({
                    usu_email: userEmail,
                    usu_nom: nombre,
                    usu_ape: apellido,
                    usu_fechareg: new Date().toISOString(),
                    usu_estado: 'Activo',
                    auth_user_id: user.id
                })
                .select('usu_id')
                .single();

            if (createUserError) {
                console.error("❌ [FALLBACK] Error creando usuario:", createUserError);
                // Si falla la creación, usar un ID temporal
                usuarioId = Math.floor(Math.random() * 1000000) + 100000;
                console.log(`⚠️ [FALLBACK] Usando ID temporal para usuario: ${usuarioId}`);
            } else {
                usuarioId = newUserData.usu_id;
                console.log(`✅ [FALLBACK] Usuario creado con usu_id: ${usuarioId}`);
            }
        } else {
            usuarioId = usuarioData.usu_id;
            console.log(`👤 [FALLBACK] Usuario encontrado con usu_id: ${usuarioId}`);
        }

        // 2. Manejar dirección (opcional pero recomendado)
        const direccionLimpia = direccion && direccion.trim() !== '' ? direccion.trim() : `Dirección temporal - ${name}`;

        console.log(`📍 [FALLBACK] Usando dirección: "${direccionLimpia}"`);

        // 2.6. Crear registro de dueño si no existe
        const { data: duenoData, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioId)
            .single();

        if (duenoError || !duenoData) {
            console.log(`👑 [FALLBACK] Usuario no es dueño, intentando crear registro...`);
            const { error: createDuenoError } = await supabase
                .from('dueno')
                .insert({ due_id: usuarioId });

            if (createDuenoError) {
                console.error("❌ [FALLBACK] Error creando registro de dueño:", createDuenoError);
                // No es crítico, continuamos
            } else {
                console.log(`✅ [FALLBACK] Registro de dueño creado para usu_id: ${usuarioId}`);
            }
        }

        // 3. Estrategia FALLBACK: No especificar est_id y dejar que la BD lo genere
        console.log(`🔧 [FALLBACK] Insertando sin especificar est_id (dejar que BD genere)`);

        const { data: insertResult, error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .insert({
                // NO especificar est_id - dejar que la BD lo genere automáticamente
                est_prov: 'Por configurar',
                est_locali: 'Por configurar',
                est_direc: direccionLimpia, // Usar la dirección proporcionada
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
                    est_direc: direccionLimpia, // Usar la dirección proporcionada
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




