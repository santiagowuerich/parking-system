import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/abonos/create-for-existing
 *
 * Crea un abono para un conductor que YA EXISTE en el sistema
 * Solo accesible por playeros.
 */

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

        // 1. VALIDAR AUTENTICACIÓN
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "No autorizado" },
                { status: 401 }
            );
        }

        // 2. OBTENER DATOS DEL REQUEST
        const body = await request.json();

        console.log('📦 Body recibido en create-for-existing:', JSON.stringify(body, null, 2));

        const {
            conductor_id, // ID del conductor existente
            vehiculos, // Nuevos vehículos si hay (pueden estar vacíos)
            abono
        } = body;

        console.log('🔍 Validando:', {
            conductor_id,
            tiene_abono: !!abono,
            abono_est_id: abono?.est_id,
            abono_tipoAbono: abono?.tipoAbono,
            abono_fechaInicio: abono?.fechaInicio,
            abono_fechaFin: abono?.fechaFin,
            abono_plaza: abono?.plaza
        });

        // Validar datos básicos
        if (!conductor_id || !abono || !abono.est_id || !abono.tipoAbono ||
            !abono.fechaInicio || !abono.fechaFin || !abono.plaza) {
            return NextResponse.json(
                { success: false, error: "Datos incompletos" },
                { status: 400 }
            );
        }

        // 3. VALIDAR QUE EL CONDUCTOR EXISTE
        const { data: conductorData, error: conductorError } = await supabase
            .from('conductores')
            .select('con_id')
            .eq('con_id', conductor_id)
            .single();

        if (conductorError || !conductorData) {
            return NextResponse.json(
                { success: false, error: "Conductor no encontrado" },
                { status: 404 }
            );
        }

        // 4. VALIDAR PLAZA DISPONIBLE
        const { data: plazaData, error: plazaError } = await supabase
            .from('plazas')
            .select('pla_numero, pla_estado, est_id')
            .eq('pla_numero', abono.plaza.pla_numero)
            .eq('est_id', abono.plaza.est_id)
            .single();

        if (plazaError || !plazaData) {
            return NextResponse.json(
                { success: false, error: "Plaza no encontrada" },
                { status: 404 }
            );
        }

        if (plazaData.pla_estado !== 'Libre') {
            return NextResponse.json(
                { success: false, error: `Plaza ${plazaData.pla_numero} no está disponible` },
                { status: 409 }
            );
        }

        // 5. VERIFICAR SI EL CONDUCTOR YA TIENE UN REGISTRO EN ABONADO
        let abonadoId: number;

        const { data: abonadoExistente } = await supabase
            .from('abonado')
            .select('abon_id')
            .eq('con_id', conductor_id)
            .single();

        if (abonadoExistente) {
            // Ya existe registro en abonado
            abonadoId = abonadoExistente.abon_id;
        } else {
            // Crear registro en abonado
            const { data: usuarioData } = await supabase
                .from('usuario')
                .select('usu_nom, usu_ape, usu_dni')
                .eq('usu_id', conductor_id)
                .single();

            if (!usuarioData) {
                return NextResponse.json(
                    { success: false, error: "Datos del conductor no encontrados" },
                    { status: 404 }
                );
            }

            const { data: nuevoAbonado, error: errorAbonado } = await supabase
                .from('abonado')
                .insert({
                    con_id: conductor_id,
                    abon_dni: usuarioData.usu_dni,
                    abon_nombre: usuarioData.usu_nom,
                    abon_apellido: usuarioData.usu_ape
                })
                .select('abon_id')
                .single();

            if (errorAbonado || !nuevoAbonado) {
                return NextResponse.json(
                    { success: false, error: `Error creando registro de abonado: ${errorAbonado?.message}` },
                    { status: 500 }
                );
            }

            abonadoId = nuevoAbonado.abon_id;
        }

        // 6. AGREGAR VEHÍCULOS NUEVOS SI HAY
        let vehiculosPatentes: string[] = [];

        if (vehiculos && vehiculos.length > 0) {
            const tipoMapping: Record<string, string> = {
                'Auto': 'AUT',
                'Moto': 'MOT',
                'Camioneta': 'CAM'
            };

            const vehiculosParaInsertar = vehiculos.map((v: any) => ({
                veh_patente: v.patente.toUpperCase(),
                con_id: conductor_id,
                catv_segmento: tipoMapping[v.tipo] || 'AUT',
                veh_marca: v.marca,
                veh_modelo: v.modelo,
                veh_color: v.color
            }));

            const { data: vehiculosCreados, error: errorVehiculos } = await supabase
                .from('vehiculos')
                .insert(vehiculosParaInsertar)
                .select('veh_patente');

            if (errorVehiculos) {
                console.error('Error creando vehículos:', errorVehiculos);
                // No es crítico, continuar
            } else if (vehiculosCreados) {
                vehiculosPatentes = vehiculosCreados.map((v: any) => v.veh_patente);
            }
        }

        // 7. OBTENER TODOS LOS VEHÍCULOS DEL CONDUCTOR
        const { data: todosLosVehiculos } = await supabase
            .from('vehiculos')
            .select('veh_patente')
            .eq('con_id', conductor_id);

        const todasLasPatentes = todosLosVehiculos?.map((v: any) => v.veh_patente) || [];

        // 8. CREAR ABONO
        const { data: nuevoAbono, error: errorAbono } = await supabase
            .from('abonos')
            .insert({
                est_id: abono.est_id,
                abon_id: abonadoId,
                abo_fecha_inicio: abono.fechaInicio,
                abo_fecha_fin: abono.fechaFin,
                abo_tipoabono: abono.tipoAbono,
                abo_estado: 'activo',
                pag_nro: null,
                pla_numero: abono.plaza.pla_numero
            })
            .select('abo_nro')
            .single();

        if (errorAbono || !nuevoAbono) {
            return NextResponse.json(
                { success: false, error: `Error creando abono: ${errorAbono?.message}` },
                { status: 500 }
            );
        }

        const abonoNro = nuevoAbono.abo_nro;

        // 9. CREAR PAGO INICIAL (NUEVO)
        // Obtener tarifa de la plaza (plantilla)
        const { data: plantillaData } = await supabase
            .from('plazas')
            .select('plantilla_id')
            .eq('pla_numero', abono.plaza.pla_numero)
            .eq('est_id', abono.plaza.est_id)
            .single();

        let pago_nro: number | null = null;

        if (plantillaData?.plantilla_id) {
            // Obtener tarifa por MES (tiptar_nro = 3)
            const { data: tarifaData } = await supabase
                .from('tarifas')
                .select('tar_precio')
                .eq('est_id', abono.est_id)
                .eq('tiptar_nro', 3) // MES
                .eq('plantilla_id', plantillaData.plantilla_id)
                .order('tar_f_desde', { ascending: false })
                .limit(1)
                .single();

            if (tarifaData) {
                // Calcular monto total del abono
                const cantidadDuracion = abono.cantidadDuracion || 1;
                const montoTotal = Number(tarifaData.tar_precio) * cantidadDuracion;

                // Crear pago inicial
                const { data: nuevoPago, error: errorPago } = await supabase
                    .from('pagos')
                    .insert({
                        pag_monto: montoTotal,
                        pag_h_fh: new Date().toISOString(),
                        est_id: abono.est_id,
                        mepa_metodo: 'Efectivo',
                        veh_patente: todasLasPatentes[0] || '',
                        pag_tipo: 'abono_inicial',
                        pag_descripcion: `Abono ${abono.tipoAbono} x${cantidadDuracion}`,
                        pag_estado: 'completado',
                        abo_nro: abonoNro
                    })
                    .select('pag_nro')
                    .single();

                if (nuevoPago && !errorPago) {
                    pago_nro = nuevoPago.pag_nro;

                    // Actualizar abonos.pag_nro
                    await supabase
                        .from('abonos')
                        .update({ pag_nro: pago_nro })
                        .eq('abo_nro', abonoNro);
                } else {
                    console.warn('Error creando pago inicial:', errorPago);
                }
            }
        }

        // 10. ACTUALIZAR ESTADO DE PLAZA
        await supabase
            .from('plazas')
            .update({ pla_estado: 'Abonado' })
            .eq('pla_numero', abono.plaza.pla_numero)
            .eq('est_id', abono.plaza.est_id);

        // 11. CREAR RELACIONES VEHÍCULOS-ABONOS
        if (todasLasPatentes.length > 0) {
            const vehiculosAbonadosParaInsertar = todasLasPatentes.map((patente: string) => ({
                est_id: abono.est_id,
                abo_nro: abonoNro,
                veh_patente: patente
            }));

            await supabase
                .from('vehiculos_abonados')
                .insert(vehiculosAbonadosParaInsertar);
        }

        // 12. RESPUESTA EXITOSA
        return NextResponse.json({
            success: true,
            data: {
                conductor_id: conductor_id,
                abonado_id: abonadoId,
                abono_nro: abonoNro,
                vehiculos_nuevos: vehiculosPatentes,
                vehiculos_total: todasLasPatentes,
                plaza_asignada: {
                    pla_numero: abono.plaza.pla_numero,
                    est_id: abono.plaza.est_id
                }
            }
        }, { status: 201 });

    } catch (error) {
        console.error('Error en /api/abonos/create-for-existing POST:', error);
        return NextResponse.json(
            { success: false, error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
