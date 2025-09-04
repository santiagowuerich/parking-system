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

        // Verificar que el usuario esté autenticado (usando getUser para mayor seguridad)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        // Verificar que el email coincida con el usuario autenticado
        if (user.email !== email) {
            return NextResponse.json(
                { error: "Email no coincide con usuario autenticado" },
                { status: 403 }
            );
        }

        console.log(`🏗️ Creando nuevo estacionamiento "${name}" para usuario: ${email}`);

        // 1. Obtener el próximo est_id disponible de manera simple y confiable
        console.log("🔍 Buscando próximo ID disponible para estacionamiento...");

        // Método simple: obtener el máximo ID actual y sumar 1
        const { data: maxIdData, error: maxIdError } = await supabase
            .from('estacionamientos')
            .select('est_id')
            .order('est_id', { ascending: false })
            .limit(1);

        if (maxIdError) {
            console.error("❌ Error obteniendo máximo est_id:", maxIdError);
            return NextResponse.json({ error: "Error consultando IDs de estacionamientos" }, { status: 500 });
        }

        // Calcular el siguiente ID disponible
        const maxId = maxIdData && maxIdData.length > 0 ? maxIdData[0].est_id : 0;
        const nextEstId = maxId + 1;

        console.log(`📍 IDs existentes: máximo = ${maxId}`);
        console.log(`📍 Asignando est_id: ${nextEstId} (siguiente disponible)`);

        // Verificación adicional: confirmar que el ID no existe
        const { data: existingCheck, error: checkError } = await supabase
            .from('estacionamientos')
            .select('est_id')
            .eq('est_id', nextEstId)
            .single();

        if (existingCheck && !checkError) {
            console.error(`❌ CONFLICTO: El ID ${nextEstId} ya existe en la base de datos!`);
            return NextResponse.json({
                error: "Conflicto de ID detectado",
                details: `El ID ${nextEstId} ya está en uso`,
                suggestion: "Intentar nuevamente"
            }, { status: 409 });
        }

        if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 es el código cuando no se encuentra el registro (lo cual es bueno)
            console.error("❌ Error verificando ID:", checkError);
            return NextResponse.json({ error: "Error verificando disponibilidad del ID" }, { status: 500 });
        }

        // 2. Verificar si el usuario existe en tabla tradicional
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado en sistema tradicional" }, { status: 404 });
        }

        const usuarioId = usuarioData.usu_id;
        console.log(`👤 Usuario encontrado con usu_id: ${usuarioId}`);

        // 3. Verificar que el usuario sea dueño (debe existir de setup inicial)
        const { data: duenoData, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioId)
            .single();

        if (duenoError || !duenoData) {
            return NextResponse.json({ error: "Usuario no tiene permisos de dueño" }, { status: 403 });
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
                est_direc: 'Dirección por configurar',
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

        // 5. Crear tarifas básicas por defecto (opcional)
        const tarifasToCreate = [
            // Tarifas por hora (tiptar_nro = 1)
            { est_id: nextEstId, tiptar_nro: 1, catv_segmento: 'AUT', tar_f_desde: new Date().toISOString(), tar_precio: 500, tar_fraccion: 1, pla_tipo: 'Normal' },
            { est_id: nextEstId, tiptar_nro: 1, catv_segmento: 'MOT', tar_f_desde: new Date().toISOString(), tar_precio: 300, tar_fraccion: 1, pla_tipo: 'Normal' },
            { est_id: nextEstId, tiptar_nro: 1, catv_segmento: 'CAM', tar_f_desde: new Date().toISOString(), tar_precio: 700, tar_fraccion: 1, pla_tipo: 'Normal' },
        ];

        const { error: tarifasError } = await supabase
            .from('tarifas')
            .insert(tarifasToCreate);

        if (tarifasError) {
            console.error("❌ Error creando tarifas:", tarifasError);
            // No es crítico para la creación del estacionamiento, continuamos
        } else {
            console.log(`💰 Tarifas básicas creadas para est_id: ${nextEstId}`);
        }

        // 6. Configurar métodos de pago aceptados (todos por defecto)
        const metodosToCreate = [
            { est_id: nextEstId, mepa_metodo: 'Efectivo' },
            { est_id: nextEstId, mepa_metodo: 'Transferencia' },
            { est_id: nextEstId, mepa_metodo: 'MercadoPago' }
        ];

        const { error: metodosError } = await supabase
            .from('est_acepta_metodospago')
            .insert(metodosToCreate);

        if (metodosError) {
            console.error("❌ Error configurando métodos de pago:", metodosError);
            // No es crítico, continuamos
        } else {
            console.log(`💳 Métodos de pago configurados para est_id: ${nextEstId}`);
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
