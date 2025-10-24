import { createClient } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { HorarioFranja, validateFranjaHoraria, checkOverlap } from "@/lib/types/horarios";

// GET: Obtener todos los horarios de un estacionamiento
export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar autenticación
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
        const { data: estData, error: estError } = await supabase
            .from('estacionamientos')
            .select('due_id')
            .eq('est_id', estId)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estData) {
            return NextResponse.json({ error: "Estacionamiento no encontrado o no autorizado" }, { status: 404 });
        }

        // Obtener horarios del estacionamiento
        const { data: horarios, error: horariosError } = await supabase
            .from('horarios_estacionamiento')
            .select('*')
            .eq('est_id', estId)
            .order('dia_semana')
            .order('orden');

        if (horariosError) {
            console.error("❌ Error obteniendo horarios:", horariosError);
            return NextResponse.json({ error: "Error obteniendo horarios" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            horarios: horarios || []
        });

    } catch (error) {
        console.error("❌ Error en GET /api/estacionamiento/horarios:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// POST: Crear o actualizar horarios completos de un estacionamiento
export async function POST(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { est_id, horarios } = body as { est_id: number; horarios: Partial<HorarioFranja>[] };

        if (!est_id) {
            return NextResponse.json(
                { error: "est_id es requerido" },
                { status: 400 }
            );
        }

        if (!Array.isArray(horarios)) {
            return NextResponse.json(
                { error: "horarios debe ser un array" },
                { status: 400 }
            );
        }

        // Verificar que el usuario sea dueño
        const userEmail = user.email;
        const { data: usuarioData, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', userEmail)
            .single();

        if (usuarioError || !usuarioData) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const { data: estData, error: estError } = await supabase
            .from('estacionamientos')
            .select('due_id')
            .eq('est_id', est_id)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estData) {
            return NextResponse.json({ error: "Estacionamiento no encontrado o no autorizado" }, { status: 404 });
        }

        // Validar todas las franjas horarias
        for (const franja of horarios) {
            const validation = validateFranjaHoraria(franja);
            if (!validation.valid) {
                return NextResponse.json(
                    { error: `Error en franja horaria: ${validation.error}` },
                    { status: 400 }
                );
            }
        }

        // Verificar que no haya overlaps entre franjas del mismo día
        const horariosPorDia: { [key: number]: Partial<HorarioFranja>[] } = {};
        horarios.forEach(franja => {
            const dia = franja.dia_semana!;
            if (!horariosPorDia[dia]) {
                horariosPorDia[dia] = [];
            }
            horariosPorDia[dia].push(franja);
        });

        for (const dia in horariosPorDia) {
            const franjasDelDia = horariosPorDia[dia];
            for (let i = 0; i < franjasDelDia.length; i++) {
                for (let j = i + 1; j < franjasDelDia.length; j++) {
                    if (checkOverlap(franjasDelDia[i] as HorarioFranja, franjasDelDia[j] as HorarioFranja)) {
                        return NextResponse.json(
                            { error: `Las franjas horarias del día ${dia} se solapan` },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Eliminar horarios existentes del estacionamiento
        const { error: deleteError } = await supabase
            .from('horarios_estacionamiento')
            .delete()
            .eq('est_id', est_id);

        if (deleteError) {
            console.error("❌ Error eliminando horarios anteriores:", deleteError);
            return NextResponse.json({ error: "Error eliminando horarios anteriores" }, { status: 500 });
        }

        // Insertar nuevos horarios si hay alguno
        if (horarios.length > 0) {
            const horariosToInsert = horarios.map(franja => ({
                est_id: est_id,
                dia_semana: franja.dia_semana!,
                hora_apertura: franja.hora_apertura!,
                hora_cierre: franja.hora_cierre!,
                orden: franja.orden!
            }));

            const { error: insertError } = await supabase
                .from('horarios_estacionamiento')
                .insert(horariosToInsert);

            if (insertError) {
                console.error("❌ Error insertando nuevos horarios:", insertError);
                return NextResponse.json({ error: "Error guardando horarios" }, { status: 500 });
            }
        }

        console.log(`✅ Horarios actualizados para estacionamiento ${est_id}: ${horarios.length} franjas`);

        return NextResponse.json({
            success: true,
            message: "Horarios actualizados exitosamente",
            count: horarios.length
        });

    } catch (error) {
        console.error("❌ Error en POST /api/estacionamiento/horarios:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// DELETE: Eliminar una franja horaria específica
export async function DELETE(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);

        // Verificar autenticación
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json(
                { error: "Usuario no autenticado" },
                { status: 401 }
            );
        }

        const url = new URL(request.url);
        const horarioId = Number(url.searchParams.get('horario_id'));

        if (!horarioId) {
            return NextResponse.json(
                { error: "horario_id es requerido" },
                { status: 400 }
            );
        }

        // Obtener la franja para verificar ownership
        const { data: horarioData, error: horarioError } = await supabase
            .from('horarios_estacionamiento')
            .select('est_id')
            .eq('horario_id', horarioId)
            .single();

        if (horarioError || !horarioData) {
            return NextResponse.json({ error: "Horario no encontrado" }, { status: 404 });
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

        const { data: estData, error: estError } = await supabase
            .from('estacionamientos')
            .select('due_id')
            .eq('est_id', horarioData.est_id)
            .eq('due_id', usuarioData.usu_id)
            .single();

        if (estError || !estData) {
            return NextResponse.json({ error: "No autorizado" }, { status: 403 });
        }

        // Eliminar la franja horaria
        const { error: deleteError } = await supabase
            .from('horarios_estacionamiento')
            .delete()
            .eq('horario_id', horarioId);

        if (deleteError) {
            console.error("❌ Error eliminando horario:", deleteError);
            return NextResponse.json({ error: "Error eliminando horario" }, { status: 500 });
        }

        console.log(`✅ Horario ${horarioId} eliminado exitosamente`);

        return NextResponse.json({
            success: true,
            message: "Horario eliminado exitosamente"
        });

    } catch (error) {
        console.error("❌ Error en DELETE /api/estacionamiento/horarios:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
