import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { email, name } = await request.json();

        if (!email || !name) {
            return NextResponse.json(
                { error: "Email y nombre son requeridos" },
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

        console.log(`🏗️ Configurando estacionamiento para usuario: ${email}`);

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

        // 2. Verificar si el usuario ya existe en tabla tradicional
        const { data: existingUsuario, error: checkUsuarioError } = await supabase
            .from('usuario')
            .select('usu_id, usu_email')
            .eq('usu_email', email)
            .single();

        let usuarioId: number;

        if (existingUsuario && !checkUsuarioError) {
            console.log(`👤 Usuario ya existe en tabla tradicional: ${existingUsuario.usu_id}`);
            usuarioId = existingUsuario.usu_id;
        } else {
            // Crear entrada en tabla usuario (mapeo a esquema tradicional)
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || 'Usuario';
            const lastName = nameParts.slice(1).join(' ') || 'Nuevo';

            const { data: usuarioData, error: usuarioError } = await supabase
                .from('usuario')
                .insert({
                    usu_nom: firstName,
                    usu_ape: lastName,
                    usu_dni: '00000000', // DNI placeholder
                    usu_tel: null,
                    usu_email: email,
                    usu_fechareg: new Date().toISOString(),
                    usu_contrasena: 'supabase_auth', // Placeholder ya que usa Supabase Auth
                })
                .select('usu_id')
                .single();

            if (usuarioError) {
                console.error("❌ Error creando usuario tradicional:", usuarioError);
                return NextResponse.json({ error: "Error creando usuario en base de datos" }, { status: 500 });
            }

            usuarioId = usuarioData.usu_id;
            console.log(`👤 Usuario creado con usu_id: ${usuarioId}`);
        }

        // 3. Verificar si ya es dueño (por si el usuario existe)
        const { data: existingDueno, error: checkDuenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuarioId)
            .single();

        if (!existingDueno && checkDuenoError) {
            // Crear entrada en tabla dueno solo si no existe
            const { error: duenoError } = await supabase
                .from('dueno')
                .insert({
                    due_id: usuarioId
                });

            if (duenoError) {
                console.error("❌ Error creando dueño:", duenoError);
                return NextResponse.json({ error: "Error asignando rol de dueño" }, { status: 500 });
            }
            console.log(`🏢 Dueño creado con due_id: ${usuarioId}`);
        } else {
            console.log(`🏢 Usuario ya es dueño: ${usuarioId}`);
        }

        // Verificar si el usuario ya tiene estacionamientos
        const { data: existingEstacionamientos, error: checkExistingError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('due_id', usuarioId);

        if (checkExistingError) {
            console.error("❌ Error verificando estacionamientos existentes:", checkExistingError);
            return NextResponse.json({ error: "Error verificando estacionamientos existentes" }, { status: 500 });
        }

        // Si el usuario ya tiene estacionamientos, no crear uno nuevo automáticamente
        if (existingEstacionamientos && existingEstacionamientos.length > 0) {
            console.log(`ℹ️ Usuario ${email} ya tiene ${existingEstacionamientos.length} estacionamiento(s), no se crea uno nuevo automáticamente`);
            return NextResponse.json({
                success: true,
                message: `Usuario ya tiene estacionamientos configurados`,
                estacionamientos_existentes: existingEstacionamientos.length,
                estacionamiento_ids: existingEstacionamientos.map(e => e.est_id)
            });
        }

        // Obtener el nombre para el estacionamiento
        const userName = name.split(' ')[0] || 'Usuario';

        // Generar dirección única para evitar conflictos
        const uniqueDireccion = `Dirección por configurar - Usuario: ${email} - ${new Date().toISOString().split('T')[0]}`;

        // 4. Crear estacionamiento con configuración mínima (SIN plazas predeterminadas)
        const { error: estacionamientoError } = await supabase
            .from('estacionamientos')
            .insert({
                est_id: nextEstId,
                est_prov: 'Por configurar',
                est_locali: 'Por configurar',
                est_direc: uniqueDireccion, // Dirección única para evitar conflictos
                est_nombre: `Estacionamiento de ${userName}`,
                est_capacidad: 0, // Sin capacidad inicial - usuario debe crear plazas
                due_id: usuarioId,
                est_cantidad_espacios_disponibles: 0, // Sin espacios disponibles inicialmente
                est_horario_funcionamiento: 24, // 24 horas
                est_tolerancia_min: 15 // 15 minutos de tolerancia
            });

        if (estacionamientoError) {
            console.error("❌ Error creando estacionamiento:", estacionamientoError);
            return NextResponse.json({ error: "Error creando estacionamiento" }, { status: 500 });
        }

        console.log(`🅿️ Estacionamiento creado con est_id: ${nextEstId} (sin plazas predeterminadas)`);

        // 5. NO crear plazas predeterminadas - El usuario debe crearlas manualmente
        console.log(`🚫 No se crearon plazas predeterminadas - El usuario debe configurarlas manualmente`);

        // 6. Crear tarifas por defecto (opcional - se pueden crear después)
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
            return NextResponse.json({ error: "Error creando tarifas" }, { status: 500 });
        }

        console.log(`💰 Tarifas por defecto creadas para est_id: ${nextEstId}`);

        // 7. Configurar métodos de pago aceptados (todos por defecto)
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
        }

        console.log(`💳 Métodos de pago configurados para est_id: ${nextEstId}`);

        // 8. Crear relación con Supabase Auth user
        const { error: userSettingsError } = await supabase
            .from('user_settings')
            .insert({
                user_id: user.id,
                mercadopago_api_key: null
            });

        if (userSettingsError && !userSettingsError.message?.includes('duplicate')) {
            console.error("❌ Error creando user_settings:", userSettingsError);
            // No es crítico, continuamos
        }

        console.log(`⚙️ Configuración de usuario creada para: ${user.id}`);

        return NextResponse.json({
            success: true,
            estacionamiento_id: nextEstId,
            message: `Estacionamiento ${nextEstId} creado exitosamente para ${email}`,
            details: {
                est_id: nextEstId,
                usuario_id: usuarioId,
                plazas_creadas: 0, // No se crearon plazas predeterminadas
                tarifas_creadas: tarifasToCreate.length,
                note: "Estacionamiento configurado sin plazas predeterminadas. El usuario debe crear las plazas manualmente desde el Panel de Administrador."
            }
        });

    } catch (error) {
        console.error("❌ Error general en setup-parking:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
