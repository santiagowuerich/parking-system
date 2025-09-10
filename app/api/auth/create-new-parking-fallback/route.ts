import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { name, email: providedEmail, direccion } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "Nombre es requerido" },
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

        // Usar el email del usuario autenticado, normalizado a minúsculas
        const email = user.email?.toLowerCase();

        // Si se proporcionó un email diferente al del usuario autenticado, verificar que coincida (case-insensitive)
        if (providedEmail && user.email && user.email.toLowerCase() !== providedEmail.toLowerCase()) {
            return NextResponse.json(
                { error: "Email proporcionado no coincide con usuario autenticado" },
                { status: 403 }
            );
        }

        console.log(`🏗️ [FALLBACK] Creando nuevo estacionamiento "${name}" para usuario: ${email}`);

        // 1. Usar directamente el email del usuario autenticado (sin validación tradicional)
        console.log(`👤 [FALLBACK] Usuario autenticado con email: ${email}`);

        // 2. Validar dirección única (se debe proporcionar)
        if (!direccion || direccion.trim() === '') {
            return NextResponse.json({
                error: "La dirección es obligatoria y debe ser única",
                details: "Ingresa una dirección válida para el estacionamiento"
            }, { status: 400 });
        }

        const direccionLimpia = direccion.trim();

        // Verificar que la dirección no exista en ningún estacionamiento (única en toda la BD)
        const { data: existingDireccion, error: direccionError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre, est_direc')
            .eq('est_direc', direccionLimpia)
            .single();

        if (existingDireccion && !direccionError) {
            console.error(`❌ [FALLBACK] DIRECCIÓN DUPLICADA: La dirección "${direccionLimpia}" ya existe en estacionamiento ID: ${existingDireccion.est_id} (${existingDireccion.est_nombre})`);
            return NextResponse.json({
                error: `La dirección "${direccionLimpia}" ya está registrada`,
                details: `Esta dirección ya pertenece al estacionamiento "${existingDireccion.est_nombre}". Cada dirección debe ser única en el sistema.`,
                estacionamiento_existente: {
                    id: existingDireccion.est_id,
                    nombre: existingDireccion.est_nombre
                }
            }, { status: 409 });
        }

        if (direccionError && direccionError.code !== 'PGRST116') {
            // PGRST116 es cuando no encuentra registro (lo cual es bueno)
            console.error("❌ [FALLBACK] Error verificando dirección duplicada:", direccionError);
            return NextResponse.json({ error: "Error verificando disponibilidad de la dirección" }, { status: 500 });
        }

        console.log(`✅ [FALLBACK] Dirección "${direccionLimpia}" disponible en el sistema`);

        // 2.6. Verificar límite de estacionamientos por usuario usando email (máximo 5)
        const { count: userParkingCount, error: countError } = await supabase
            .from('estacionamientos')
            .select('*', { count: 'exact', head: true })
            .eq('est_email', email); // Usar email en lugar de due_id

        if (countError) {
            console.error("❌ [FALLBACK] Error verificando límite de estacionamientos:", countError);
            return NextResponse.json({ error: "Error verificando límites de usuario" }, { status: 500 });
        }

        const currentParkingCount = userParkingCount || 0;
        const MAX_PARKINGS_PER_USER = 5;

        if (currentParkingCount >= MAX_PARKINGS_PER_USER) {
            console.error(`❌ [FALLBACK] LÍMITE EXCEDIDO: Usuario ${email} tiene ${currentParkingCount} estacionamientos (máx: ${MAX_PARKINGS_PER_USER})`);
            return NextResponse.json({
                error: `Has alcanzado el límite máximo de estacionamientos (${MAX_PARKINGS_PER_USER})`,
                details: `Actualmente tienes ${currentParkingCount} estacionamientos. Para crear más, contacta al soporte.`,
                current_count: currentParkingCount,
                max_allowed: MAX_PARKINGS_PER_USER
            }, { status: 429 });
        }

        console.log(`✅ [FALLBACK] Usuario puede crear estacionamiento (${currentParkingCount}/${MAX_PARKINGS_PER_USER})`);

        // 3. Obtener el próximo est_id disponible usando función thread-safe (igual que endpoint principal)
        console.log("🔍 [FALLBACK] Obteniendo próximo ID disponible para estacionamiento usando función thread-safe...");

        const { data: idResult, error: idError } = await supabase
            .rpc('get_next_est_id_v2');

        if (idError) {
            console.error("❌ [FALLBACK] Error obteniendo siguiente est_id:", idError);
            return NextResponse.json({
                error: "Error obteniendo ID para el estacionamiento",
                details: idError.message
            }, { status: 500 });
        }

        const nextEstId = idResult;
        console.log(`📍 [FALLBACK] Asignando est_id: ${nextEstId} (obtenido de manera thread-safe)`);

        // 4. Crear estacionamiento con ID específico
        console.log(`🔧 [FALLBACK] Insertando estacionamiento con datos:`, {
            est_id: nextEstId,
            est_nombre: name,
            est_email: email,
            est_capacidad: 0,
            est_cantidad_espacios_disponibles: 0
        });

        const { data: insertResult, error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .insert({
                est_id: nextEstId,
                est_prov: 'Por configurar',
                est_locali: 'Por configurar',
                est_direc: direccionLimpia, // Usar la dirección proporcionada
                est_nombre: name,
                est_email: email, // Usar email del usuario autenticado
                est_capacidad: 0,
                est_cantidad_espacios_disponibles: 0,
                est_horario_funcionamiento: 24,
                est_tolerancia_min: 15
            })
            .select();

        if (estacionamientoError) {
            console.error("❌ [FALLBACK] Error creando estacionamiento:", estacionamientoError);
            console.error("❌ [FALLBACK] Detalles del error:", {
                code: estacionamientoError.code,
                message: estacionamientoError.message,
                details: estacionamientoError.details,
                hint: estacionamientoError.hint
            });
            return NextResponse.json({
                error: "Error creando estacionamiento",
                details: estacionamientoError.message
            }, { status: 500 });
        }

        const generatedEstId = insertResult[0]?.est_id;
        console.log(`✅ [FALLBACK] Estacionamiento creado exitosamente con ID: ${generatedEstId}`);

        return NextResponse.json({
            success: true,
            estacionamiento_id: generatedEstId,
            message: `Estacionamiento "${name}" creado exitosamente`,
            details: {
                est_id: generatedEstId,
                est_nombre: name,
                usuario_email: email,
                plazas_creadas: 0,
                strategy: 'thread_safe_id'
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




