import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
    try {
        const { supabase, response } = createClient(request);
        const url = new URL(request.url);
        const estId = url.searchParams.get('est_id');
        const fechaDesde = url.searchParams.get('fecha_desde');
        const fechaHasta = url.searchParams.get('fecha_hasta');
        const playId = url.searchParams.get('play_id'); // Filtro opcional por empleado

        if (!estId) {
            return NextResponse.json({ error: "est_id es requerido" }, { status: 400 });
        }

        // Verificar que el usuario tenga acceso (debe ser dueño)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Paso 1: Obtener usu_id del usuario autenticado
        const { data: usuario, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id')
            .eq('auth_user_id', user.id)
            .single();

        if (usuarioError || !usuario) {
            logger.error("Usuario no encontrado:", usuarioError);
            return NextResponse.json({ error: "Usuario no encontrado en el sistema" }, { status: 404 });
        }

        logger.info(`Usuario autenticado: usu_id=${usuario.usu_id}, auth_user_id=${user.id}`);

        // Paso 2: Verificar que el usuario sea dueño
        const { data: dueno, error: duenoError } = await supabase
            .from('dueno')
            .select('due_id')
            .eq('due_id', usuario.usu_id)
            .single();

        if (duenoError || !dueno) {
            logger.error("Usuario no es dueño:", duenoError);
            return NextResponse.json({ error: "No tiene permisos de dueño" }, { status: 403 });
        }

        logger.info(`Usuario es dueño: due_id=${dueno.due_id}`);

        // Paso 3: Verificar que el estacionamiento pertenezca al dueño
        const { data: estacionamiento, error: estError } = await supabase
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('est_id', estId)
            .eq('due_id', dueno.due_id)
            .single();

        if (estError || !estacionamiento) {
            logger.error("Estacionamiento no encontrado o no pertenece al dueño:", estError);
            return NextResponse.json({ error: "No tiene permisos para ver los turnos de este estacionamiento" }, { status: 403 });
        }

        logger.info(`Estacionamiento verificado: est_id=${estacionamiento.est_id}, nombre=${estacionamiento.est_nombre}`);

        // Query 1: Obtener todos los turnos del estacionamiento (sin JOIN)
        let query = supabase
            .from('turnos_empleados')
            .select('*')
            .eq('est_id', estId)
            .order('tur_fecha', { ascending: false })
            .order('tur_hora_entrada', { ascending: false });

        // Filtro opcional por empleado
        if (playId) {
            query = query.eq('play_id', playId);
        }

        // Filtros de fecha
        if (fechaDesde) {
            query = query.gte('tur_fecha', fechaDesde);
        }

        if (fechaHasta) {
            query = query.lte('tur_fecha', fechaHasta);
        }

        const { data: turnos, error: turnosError } = await query;

        if (turnosError) {
            logger.error("Error fetching turnos:", turnosError);
            return NextResponse.json({ error: "Error al obtener turnos", details: turnosError }, { status: 500 });
        }

        logger.info(`Turnos encontrados: ${turnos?.length || 0}`);

        // Query 2: Obtener información de usuarios únicos
        const playIds = [...new Set(turnos?.map(t => t.play_id) || [])];
        logger.info(`Play IDs únicos: ${playIds.length}`);

        let usuariosMap: Record<number, any> = {};

        if (playIds.length > 0) {
            const { data: usuarios, error: usuariosError } = await supabase
                .from('usuario')
                .select('usu_id, usu_nom, usu_ape, usu_email')
                .in('usu_id', playIds);

            if (usuariosError) {
                logger.error("Error fetching usuarios:", usuariosError);
            } else {
                logger.info(`Usuarios encontrados: ${usuarios?.length || 0}`);
                // Crear mapa de usu_id -> usuario
                usuarios?.forEach(usuario => {
                    usuariosMap[usuario.usu_id] = usuario;
                });
            }
        }

        // Combinar turnos con información de usuarios
        const turnosTransformados = (turnos || []).map((turno: any) => {
            const usuario = usuariosMap[turno.play_id];
            return {
                ...turno,
                usuario: usuario ? {
                    usu_id: usuario.usu_id,
                    nombre: usuario.usu_nom || '',
                    apellido: usuario.usu_ape || '',
                    email: usuario.usu_email || ''
                } : {
                    usu_id: turno.play_id,
                    nombre: 'Usuario',
                    apellido: 'Desconocido',
                    email: ''
                }
            };
        });

        const jsonResponse = NextResponse.json({
            turnos: turnosTransformados,
            estacionamiento: estacionamiento
        });
        return copyResponseCookies(response, jsonResponse);
    } catch (err) {
        logger.error("Error fetching turnos de gestión:", err);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
