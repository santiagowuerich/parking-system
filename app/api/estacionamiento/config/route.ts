import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

// GET: Obtener configuración actual del estacionamiento
export async function GET(request: NextRequest) {
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

        const url = new URL(request.url);
        const estId = Number(url.searchParams.get('est_id'));

        if (!estId) {
            return NextResponse.json(
                { error: "est_id es requerido" },
                { status: 400 }
            );
        }

        // Verificar que el usuario sea dueño del estacionamiento
        const userEmail = user.email;
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        // Verificar ownership
        const { data: estacionamientoData, error: estError } = await supabase
            .from('estacionamientos')
            .select('*')
            .eq('est_id', estId)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estacionamientoData) {
            return NextResponse.json({ error: "Estacionamiento no encontrado o no autorizado" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            estacionamiento: {
                est_id: estacionamientoData.est_id,
                est_nombre: estacionamientoData.est_nombre,
                est_prov: estacionamientoData.est_prov,
                est_locali: estacionamientoData.est_locali,
                est_direc: estacionamientoData.est_direc,
                est_direccion_completa: estacionamientoData.est_direccion_completa,
                est_latitud: estacionamientoData.est_latitud,
                est_longitud: estacionamientoData.est_longitud,
                est_codigo_postal: estacionamientoData.est_codigo_postal,
                est_telefono: estacionamientoData.est_telefono,
                est_email: estacionamientoData.est_email,
                est_descripcion: estacionamientoData.est_descripcion,
                est_capacidad: estacionamientoData.est_capacidad,
                est_horario_funcionamiento: estacionamientoData.est_horario_funcionamiento,
                est_tolerancia_min: estacionamientoData.est_tolerancia_min
            }
        });

    } catch (error) {
        console.error("❌ Error obteniendo configuración:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// PUT: Actualizar configuración del estacionamiento
export async function PUT(request: NextRequest) {
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

        const body = await request.json();
        const {
            est_id,
            est_nombre,
            est_prov,
            est_locali,
            est_direc,
            est_direccion_completa,
            est_latitud,
            est_longitud,
            est_codigo_postal,
            est_telefono,
            est_email,
            est_descripcion,
            est_horario_funcionamiento,
            est_tolerancia_min
        } = body;

        if (!est_id) {
            return NextResponse.json(
                { error: "est_id es requerido" },
                { status: 400 }
            );
        }

        // Verificar que el usuario sea dueño del estacionamiento
        const userEmail = user.email;
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        // Verificar ownership antes de actualizar
        const { data: existingEst, error: checkError } = await supabase
            .from('estacionamientos')
            .select('due_id')
            .eq('est_id', est_id)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (checkError || !existingEst) {
            return NextResponse.json({ error: "Estacionamiento no encontrado o no autorizado" }, { status: 404 });
        }

        // Actualizar la configuración
        const { data: updatedData, error: updateError } = await supabase
            .from('estacionamientos')
            .update({
                est_nombre,
                est_prov,
                est_locali,
                est_direc,
                est_direccion_completa,
                est_latitud,
                est_longitud,
                est_codigo_postal,
                est_telefono,
                est_email,
                est_descripcion,
                est_horario_funcionamiento,
                est_tolerancia_min,
                est_updated_at: new Date().toISOString()
            })
            .eq('est_id', est_id)
            .eq('due_id', usuarioData.usu_id)
            .select()
            .single();

        if (updateError) {
            console.error("❌ Error actualizando estacionamiento:", updateError);
            return NextResponse.json({ error: "Error actualizando configuración" }, { status: 500 });
        }

        console.log(`✅ Estacionamiento ${est_id} actualizado para usuario ${userEmail}`);

        return NextResponse.json({
            success: true,
            message: "Configuración actualizada exitosamente",
            estacionamiento: updatedData
        });

    } catch (error) {
        console.error("❌ Error actualizando configuración:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
