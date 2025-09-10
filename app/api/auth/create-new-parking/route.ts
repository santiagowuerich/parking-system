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

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
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

        console.log(`🏗️ Creando nuevo estacionamiento "${name}" para usuario: ${userEmail}`);

        // 1. Obtener el próximo est_id disponible usando función thread-safe
        console.log("🔍 Obteniendo próximo ID disponible para estacionamiento usando función thread-safe...");

        // Usar la función thread-safe para obtener el siguiente ID
        const { data: idResult, error: idError } = await supabase
            .rpc('get_next_est_id_v2');

        if (idError) {
            console.error("❌ Error obteniendo siguiente est_id:", idError);
            return NextResponse.json({
                error: "Error obteniendo ID para el estacionamiento",
                details: idError.message
            }, { status: 500 });
        }

        const nextEstId = idResult;

        console.log(`📍 Asignando est_id: ${nextEstId} (obtenido de manera thread-safe)`);

        // 2. Buscar o crear usuario en tabla tradicional
        let { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        let usuarioId;

        if (usuarioError || !usuarioData) {
            // Usuario no existe, intentar crearlo
            console.log(`👤 Usuario no encontrado, intentando crearlo...`);

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
                console.error("❌ Error creando usuario:", createUserError);
                // Si falla la creación, usar un ID temporal
                usuarioId = Math.floor(Math.random() * 1000000) + 100000;
                console.log(`⚠️ Usando ID temporal para usuario: ${usuarioId}`);
            } else {
                usuarioId = newUserData.usu_id;
                console.log(`✅ Usuario creado con usu_id: ${usuarioId}`);
            }
        } else {
            usuarioId = usuarioData.usu_id;
            console.log(`👤 Usuario encontrado con usu_id: ${usuarioId}`);
        }

        // 2.5. Manejar dirección (opcional pero recomendado)
        const direccionLimpia = direccion && direccion.trim() !== '' ? direccion.trim() : `Dirección temporal - ${name}`;

        console.log(`📍 Usando dirección: "${direccionLimpia}"`);

        // 2.6. Crear registro de dueño si no existe
        const { data: duenoData, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioId)
            .single();

        if (duenoError || !duenoData) {
            console.log(`👑 Usuario no es dueño, intentando crear registro...`);
            const { error: createDuenoError } = await supabase
                .from('dueno')
                .insert({ due_id: usuarioId });

            if (createDuenoError) {
                console.error("❌ Error creando registro de dueño:", createDuenoError);
                // No es crítico, continuamos
            } else {
                console.log(`✅ Registro de dueño creado para usu_id: ${usuarioId}`);
            }
        }

        // 4. Crear nuevo estacionamiento con configuración mínima
        console.log(`🔧 Insertando estacionamiento con datos:`, {
            est_id: nextEstId,
            est_nombre: name,
            due_id: usuarioId,
            est_capacidad: 0,
            est_cantidad_espacios_disponibles: 0
        });

        const { data: insertData, error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .insert({
                est_id: nextEstId,
                est_prov: 'Por configurar',
                est_locali: 'Por configurar',
                est_direc: direccionLimpia, // Usar la dirección proporcionada
                est_nombre: name,
                est_capacidad: 0, // Sin capacidad inicial
                due_id: usuarioId,
                est_cantidad_espacios_disponibles: 0, // Sin espacios disponibles
                est_horario_funcionamiento: 24, // 24 horas por defecto
                est_tolerancia_min: 15 // 15 minutos por defecto
            })
            .select();

        if (estacionamientoError) {
            console.error("❌ Error creando estacionamiento:", estacionamientoError);
            console.error("❌ Detalles del error:", {
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

        console.log(`✅ Estacionamiento insertado exitosamente:`, insertData);

        console.log(`🅿️ Nuevo estacionamiento creado con est_id: ${nextEstId}`);

        // 5. Intentar crear elementos adicionales (no críticos)
        try {
            // Tarifas básicas por defecto
            const { error: tarifasError } = await supabase
                .from('tarifas')
                .insert([
                    { est_id: nextEstId, tiptar_nro: 1, catv_segmento: 'AUT', tar_f_desde: new Date().toISOString(), tar_precio: 500, tar_fraccion: 1, pla_tipo: 'Normal' },
                    { est_id: nextEstId, tiptar_nro: 1, catv_segmento: 'MOT', tar_f_desde: new Date().toISOString(), tar_precio: 300, tar_fraccion: 1, pla_tipo: 'Normal' }
                ]);

            if (!tarifasError) {
                console.log(`💰 Tarifas básicas creadas para est_id: ${nextEstId}`);
            }
        } catch (tarifasErr) {
            console.log(`⚠️ No se pudieron crear tarifas (no crítico):`, tarifasErr.message);
        }

        try {
            // Métodos de pago aceptados
            const { error: metodosError } = await supabase
                .from('est_acepta_metodospago')
                .insert([
                    { est_id: nextEstId, mepa_metodo: 'Efectivo' },
                    { est_id: nextEstId, mepa_metodo: 'Transferencia' }
                ]);

            if (!metodosError) {
                console.log(`💳 Métodos de pago configurados para est_id: ${nextEstId}`);
            }
        } catch (metodosErr) {
            console.log(`⚠️ No se pudieron configurar métodos de pago (no crítico):`, metodosErr.message);
        }

        console.log(`✅ Nuevo estacionamiento "${name}" creado exitosamente`);

        return NextResponse.json({
            success: true,
            estacionamiento_id: nextEstId,
            message: `Estacionamiento "${name}" creado exitosamente`,
            details: {
                est_id: nextEstId,
                est_nombre: name,
                usuario_id: usuarioId,
                plazas_creadas: 0, // Sin plazas predeterminadas
                tarifas_creadas: tarifasError ? 0 : tarifasToCreate.length,
                note: "Estacionamiento creado sin plazas predeterminadas. Configure las plazas desde el Panel de Administrador."
            }
        });

    } catch (error) {
        console.error("❌ Error general en create-new-parking:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
