import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { CrearConductorConAbonoRequest, CrearConductorConAbonoResponse } from "@/lib/types";

/**
 * POST /api/abonos/create-conductor
 *
 * Crea un nuevo conductor con sus vehículos y un abono asociado.
 * Solo accesible por playeros.
 *
 * @body CrearConductorConAbonoRequest
 * @returns CrearConductorConAbonoResponse
 */

// Función auxiliar para eliminar usuario de auth
async function deleteAuthUser(usuarioId: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${usuarioId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            console.error('Error eliminando usuario de auth:', response.statusText);
        }
    } catch (err) {
        console.error('Error eliminando usuario de auth:', err);
    }
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    async get(name: string) {
                        const cookie = await cookieStore.get(name);
                        return cookie?.value;
                    },
                },
            }
        );

        // ========================================
        // 1. VALIDAR AUTENTICACIÓN
        // ========================================
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // ========================================
        // 2. VALIDAR REQUEST BODY
        // ========================================
        const body: CrearConductorConAbonoRequest = await request.json();

        // Validar datos del conductor
        if (!body.conductor || !body.conductor.nombre || !body.conductor.apellido ||
            !body.conductor.email || !body.conductor.dni) {
            return NextResponse.json(
                { success: false, error: "Datos del conductor incompletos" },
                { status: 400 }
            );
        }

        // Validar vehículos (mínimo 1)
        if (!body.vehiculos || body.vehiculos.length === 0) {
            return NextResponse.json(
                { success: false, error: "Debe registrar al menos 1 vehículo" },
                { status: 400 }
            );
        }

        // Validar cada vehículo
        for (const veh of body.vehiculos) {
            if (!veh.patente || !veh.tipo || !veh.marca || !veh.modelo || !veh.color) {
                return NextResponse.json(
                    { success: false, error: "Datos de vehículo incompletos" },
                    { status: 400 }
                );
            }
        }

        // Validar datos del abono
        if (!body.abono || !body.abono.est_id || !body.abono.tipoAbono ||
            !body.abono.fechaInicio || !body.abono.fechaFin) {
            return NextResponse.json(
                { success: false, error: "Datos del abono incompletos" },
                { status: 400 }
            );
        }

        // Validar datos de la plaza
        if (!body.abono.plaza || !body.abono.plaza.pla_numero || !body.abono.plaza.est_id) {
            return NextResponse.json(
                { success: false, error: "Debe seleccionar una plaza" },
                { status: 400 }
            );
        }

        // ========================================
        // 3. VALIDAR PLAZA DISPONIBLE
        // ========================================
        const { data: plazaData, error: plazaError } = await supabase
            .from('plazas')
            .select('pla_numero, pla_estado, est_id')
            .eq('pla_numero', body.abono.plaza.pla_numero)
            .eq('est_id', body.abono.plaza.est_id)
            .single();

        if (plazaError || !plazaData) {
            return NextResponse.json(
                { success: false, error: "Plaza no encontrada" },
                { status: 404 }
            );
        }

        if (plazaData.pla_estado !== 'Libre') {
            return NextResponse.json(
                { success: false, error: `Plaza ${plazaData.pla_numero} no está disponible (estado: ${plazaData.pla_estado})` },
                { status: 409 }
            );
        }

        // ========================================
        // 4. VALIDAR DNI Y EMAIL ÚNICOS
        // ========================================
        const { data: usuarioExistente } = await supabase
            .from('usuario')
            .select('usu_id, usu_dni, usu_email')
            .or(`usu_dni.eq.${body.conductor.dni},usu_email.eq.${body.conductor.email}`);

        if (usuarioExistente && usuarioExistente.length > 0) {
            const existing = usuarioExistente[0];
            if (existing.usu_dni === body.conductor.dni) {
                return NextResponse.json(
                    { success: false, error: "El DNI ya está registrado" },
                    { status: 409 }
                );
            }
            if (existing.usu_email === body.conductor.email) {
                return NextResponse.json(
                    { success: false, error: "El email ya está registrado" },
                    { status: 409 }
                );
            }
        }

        // ========================================
        // 4. VALIDAR PATENTES ÚNICAS
        // ========================================
        const patentes = body.vehiculos.map(v => v.patente.toUpperCase());
        const { data: vehiculosExistentes } = await supabase
            .from('vehiculos')
            .select('veh_patente')
            .in('veh_patente', patentes);

        if (vehiculosExistentes && vehiculosExistentes.length > 0) {
            const patentesExistentes = vehiculosExistentes.map((v: any) => v.veh_patente);
            return NextResponse.json(
                {
                    success: false,
                    error: `Las siguientes patentes ya están registradas: ${patentesExistentes.join(', ')}`
                },
                { status: 409 }
            );
        }

        // ========================================
        // 5. CREAR USUARIO EN AUTENTICACIÓN SUPABASE
        // ========================================
        // Crear cuenta de autenticación con DNI como contraseña inicial
        // Usar el endpoint de auth de Supabase directamente
        let usuarioId: string;
        let authError: any = null;

        try {
            const authResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                },
                body: JSON.stringify({
                    email: body.conductor.email,
                    password: body.conductor.dni, // DNI como contraseña inicial
                    data: {
                        nombre: body.conductor.nombre,
                        apellido: body.conductor.apellido,
                        dni: body.conductor.dni,
                        telefono: body.conductor.telefono || null
                    }
                })
            });

            const authData = await authResponse.json();

            if (!authResponse.ok || authData.error) {
                authError = authData.error || { message: authData.error_description || 'Error creando usuario en auth' };
                throw new Error(authError.message || 'Error creando usuario');
            }

            usuarioId = authData.user.id;
        } catch (err: any) {
            console.error('Error creando usuario en auth:', err.message);
            return NextResponse.json(
                { success: false, error: `Error creando cuenta de usuario: ${err.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 6. CREAR USUARIO EN TABLA USUARIO
        // ========================================
        const { data: nuevoUsuario, error: errorUsuario } = await supabase
            .from('usuario')
            .insert({
                usu_id: usuarioId, // Usar el ID de auth como usu_id
                usu_nom: body.conductor.nombre,
                usu_ape: body.conductor.apellido,
                usu_email: body.conductor.email,
                usu_tel: body.conductor.telefono || null,
                usu_dni: body.conductor.dni,
                usu_fechareg: new Date().toISOString(),
                usu_estado: 'Activo'
            })
            .select('usu_id')
            .single();

        if (errorUsuario || !nuevoUsuario) {
            console.error('Error creando usuario en tabla:', errorUsuario);
            // Si falla la creación en tabla, eliminar el usuario de auth
            try {
                await deleteAuthUser(usuarioId);
            } catch (delErr) {
                console.error('Error eliminando usuario de auth:', delErr);
            }
            return NextResponse.json(
                { success: false, error: `Error creando usuario: ${errorUsuario?.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 7. CREAR REGISTRO EN TABLA CONDUCTORES
        // ========================================
        const { error: errorConductor } = await supabase
            .from('conductores')
            .insert({
                con_id: usuarioId
            });

        if (errorConductor) {
            console.error('Error creando conductor:', errorConductor);
            await deleteAuthUser(usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando conductor: ${errorConductor.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 8. CREAR VEHÍCULOS
        // ========================================
        const tipoMapping: Record<string, string> = {
            'Auto': 'AUT',
            'Moto': 'MOT',
            'Camioneta': 'CAM'
        };

        const vehiculosParaInsertar = body.vehiculos.map(v => ({
            veh_patente: v.patente.toUpperCase(),
            con_id: usuarioId,
            catv_segmento: tipoMapping[v.tipo] || 'AUT',
            veh_marca: v.marca,
            veh_modelo: v.modelo,
            veh_color: v.color
        }));

        const { data: vehiculosCreados, error: errorVehiculos } = await supabase
            .from('vehiculos')
            .insert(vehiculosParaInsertar)
            .select('veh_patente');

        if (errorVehiculos || !vehiculosCreados) {
            console.error('Error creando vehículos:', errorVehiculos);
            await deleteAuthUser(usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando vehículos: ${errorVehiculos?.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 9. CREAR REGISTRO EN TABLA ABONADO
        // ========================================
        const { data: nuevoAbonado, error: errorAbonado } = await supabase
            .from('abonado')
            .insert({
                con_id: usuarioId,
                abon_dni: body.conductor.dni,
                abon_nombre: body.conductor.nombre,
                abon_apellido: body.conductor.apellido
            })
            .select('abon_id')
            .single();

        if (errorAbonado || !nuevoAbonado) {
            console.error('Error creando abonado:', errorAbonado);
            await deleteAuthUser(usuarioId);
            await supabase.from('vehiculos').delete().eq('con_id', usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando abonado: ${errorAbonado?.message}` },
                { status: 500 }
            );
        }

        const abonadoId = nuevoAbonado.abon_id;

        // ========================================
        // 10. CREAR ABONO
        // ========================================
        const { data: nuevoAbono, error: errorAbono } = await supabase
            .from('abonos')
            .insert({
                est_id: body.abono.est_id,
                abon_id: abonadoId,
                abo_fecha_inicio: body.abono.fechaInicio,
                abo_fecha_fin: body.abono.fechaFin,
                abo_tipoabono: body.abono.tipoAbono,
                pag_nro: null,
                pla_numero: body.abono.plaza.pla_numero,
                est_id: body.abono.plaza.est_id
            })
            .select('abo_nro')
            .single();

        if (errorAbono || !nuevoAbono) {
            console.error('Error creando abono:', errorAbono);
            await deleteAuthUser(usuarioId);
            await supabase.from('abonado').delete().eq('abon_id', abonadoId);
            await supabase.from('vehiculos').delete().eq('con_id', usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error creando abono: ${errorAbono?.message}` },
                { status: 500 }
            );
        }

        const abonoNro = nuevoAbono.abo_nro;

        // ========================================
        // 11. ACTUALIZAR ESTADO DE PLAZA A "ABONADO"
        // ========================================
        const { error: errorPlazaUpdate } = await supabase
            .from('plazas')
            .update({ pla_estado: 'Abonado' })
            .eq('pla_numero', body.abono.plaza.pla_numero)
            .eq('est_id', body.abono.plaza.est_id);

        if (errorPlazaUpdate) {
            console.error('Error actualizando estado de plaza:', errorPlazaUpdate);
            // Rollback: eliminar abono creado
            await supabase.from('abonos').delete().eq('abo_nro', abonoNro);
            await supabase.from('abonado').delete().eq('abon_id', abonadoId);
            await supabase.from('vehiculos').delete().eq('con_id', usuarioId);
            await supabase.from('conductores').delete().eq('con_id', usuarioId);
            await supabase.from('usuario').delete().eq('usu_id', usuarioId);
            return NextResponse.json(
                { success: false, error: `Error actualizando plaza: ${errorPlazaUpdate.message}` },
                { status: 500 }
            );
        }

        // ========================================
        // 11. CREAR RELACIONES VEHÍCULOS-ABONOS
        // ========================================
        const vehiculosAbonadosParaInsertar = vehiculosCreados.map((v: any) => ({
            est_id: body.abono.est_id,
            abo_nro: abonoNro,
            veh_patente: v.veh_patente
        }));

        const { error: errorVehiculosAbonados } = await supabase
            .from('vehiculos_abonados')
            .insert(vehiculosAbonadosParaInsertar);

        if (errorVehiculosAbonados) {
            console.error('Error creando relaciones vehículos-abonos:', errorVehiculosAbonados);
            // No hacer rollback aquí, ya que el abono principal fue creado
        }

        // ========================================
        // 12. OBTENER DATOS COMPLETOS DEL ABONO CREADO
        // ========================================
        const { data: abonoCompleto, error: errorAbonoCompleto } = await supabase
            .from('abonos')
            .select(`
                abo_nro,
                est_id,
                abon_id,
                abo_fecha_inicio,
                abo_fecha_fin,
                abo_tipoabono,
                abonado (
                    abon_id,
                    abon_dni,
                    abon_nombre,
                    abon_apellido,
                    con_id
                ),
                estacionamientos (
                    est_nombre,
                    est_direc
                )
            `)
            .eq('abo_nro', abonoNro)
            .eq('est_id', body.abono.est_id)
            .single();

        if (errorAbonoCompleto) {
            console.error('Error obteniendo abono completo:', errorAbonoCompleto);
        }

        // ========================================
        // 13. RESPUESTA EXITOSA
        // ========================================
        const response: CrearConductorConAbonoResponse = {
            success: true,
            data: {
                usuario_id: usuarioId,
                conductor_id: usuarioId,
                vehiculo_ids: vehiculosCreados.map((v: any) => v.veh_patente),
                abonado_id: abonadoId,
                abono_nro: abonoNro,
                plaza_asignada: {
                    pla_numero: body.abono.plaza.pla_numero,
                    est_id: body.abono.plaza.est_id
                },
                abono: abonoCompleto || (nuevoAbono as any)
            }
        };

        return NextResponse.json(response, { status: 201 });

    } catch (error) {
        console.error('Error en /api/abonos/create-conductor POST:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
