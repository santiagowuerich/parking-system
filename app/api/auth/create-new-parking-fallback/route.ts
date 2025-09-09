import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { name, direccion } = await request.json();

        if (!name) {
            return NextResponse.json(
                { error: "El nombre del estacionamiento es requerido" },
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

        // Obtener el email del usuario autenticado
        const email = user.email;

        console.log(`🏗️ [FALLBACK] Creando nuevo estacionamiento "${name}" para usuario: ${email}`);

        // 1. Verificar si el usuario existe en tabla tradicional, si no existe, crearlo
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        let usuarioId: number;

        if (usuarioError || !usuarioData) {
            console.log(`👤 [FALLBACK] Usuario no encontrado en tabla tradicional, creándolo...`);

            // Crear usuario en tabla tradicional
            const nameParts = user.user_metadata?.name?.split(' ') || email.split('@')[0].split('.');
            const firstName = nameParts[0] || 'Usuario';
            const lastName = nameParts.slice(1).join(' ') || 'Nuevo';

            const { data: newUsuarioData, error: newUsuarioError } = await supabase
                .from('usuario')
                .insert({
                    usu_nom: firstName,
                    usu_ape: lastName,
                    usu_dni: '00000000', // DNI placeholder
                    usu_tel: null,
                    usu_email: email,
                    usu_fechareg: new Date().toISOString(),
                    usu_contrasena: 'supabase_auth', // Placeholder ya que usa Supabase Auth
                    auth_user_id: user.id // Vincular con Supabase Auth
                })
                .select('usu_id')
                .single();

            if (newUsuarioError) {
                console.error("❌ [FALLBACK] Error creando usuario tradicional:", newUsuarioError);
                return NextResponse.json({ error: "Error creando usuario en base de datos" }, { status: 500 });
            }

            usuarioId = newUsuarioData.usu_id;
            console.log(`👤 [FALLBACK] Usuario creado con usu_id: ${usuarioId}`);

            // Crear entrada en tabla dueno
            const { error: duenoError } = await supabase
                .from('dueno')
                .insert({
                    due_id: usuarioId
                });

            if (duenoError) {
                console.error("❌ [FALLBACK] Error creando dueño:", duenoError);
                return NextResponse.json({ error: "Error asignando rol de dueño" }, { status: 500 });
            }
            console.log(`🏢 [FALLBACK] Dueño creado con due_id: ${usuarioId}`);
        } else {
            usuarioId = usuarioData.usu_id;
            console.log(`👤 [FALLBACK] Usuario encontrado con usu_id: ${usuarioId}`);
        }

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

        // 2.6. Verificar límite de estacionamientos por usuario (máximo 5)
        const { count: userParkingCount, error: countError } = await supabase
            .from('estacionamientos')
            .select('*', { count: 'exact', head: true })
            .eq('due_id', usuarioId);

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




