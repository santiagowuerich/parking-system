import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedSupabaseClient } from "@/lib/supabase/server";
import { CrearReservaRequest, CrearReservaResponse } from "@/lib/types";
import { validarTiempoReserva, calcularPrecioReserva } from "@/lib/utils/reservas-utils";
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Función auxiliar para generar código de reserva
async function generarCodigoReserva(supabase: any): Promise<string> {
    const fecha = dayjs().tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD');

    // Obtener el último código del día
    const { data: ultimasReservas, error } = await supabase
        .from('reservas')
        .select('res_codigo')
        .like('res_codigo', `RES-${fecha}-%`)
        .order('res_codigo', { ascending: false })
        .limit(1);

    let numero = 1;
    if (!error && ultimasReservas && ultimasReservas.length > 0) {
        const ultimoCodigo = ultimasReservas[0].res_codigo;
        const ultimoNumero = parseInt(ultimoCodigo.split('-')[3] || '0');
        numero = ultimoNumero + 1;
    }

    // Formato: RES-YYYY-MM-DD-NNNN
    return `RES-${fecha}-${String(numero).padStart(4, '0')}`;
}

// Función auxiliar para obtener la API Key del propietario del estacionamiento
async function getApiKey(estId: number): Promise<string> {
    const supabase = await createAuthenticatedSupabaseClient();

    console.log(`🔑 [API_KEY] Obteniendo API Key para estacionamiento: ${estId}`);

    // Obtener el due_id del estacionamiento
    const { data: estData, error: estError } = await supabase
        .from("estacionamientos")
        .select("due_id")
        .eq("est_id", estId)
        .single();

    if (estError || !estData) {
        console.error('❌ [API_KEY] Error al obtener estacionamiento:', estError);
        throw new Error('Error al obtener la información del estacionamiento');
    }

    console.log(`✅ [API_KEY] Estacionamiento encontrado, due_id: ${estData.due_id}`);

    // Obtener el user_id del dueño
    const { data: usuarioData, error: usuarioError } = await supabase
        .from("usuario")
        .select("auth_user_id, usu_email")
        .eq("usu_id", estData.due_id)
        .single();

    if (usuarioError || !usuarioData?.auth_user_id) {
        console.error('❌ [API_KEY] Error al obtener usuario:', usuarioError);
        throw new Error('Usuario del dueño no encontrado');
    }

    console.log(`✅ [API_KEY] Usuario encontrado, email: ${usuarioData.usu_email}, auth_user_id: ${usuarioData.auth_user_id}`);

    // Obtener la API key de user_settings
    const { data: settingsData, error: settingsError } = await supabase
        .from("user_settings")
        .select("mercadopago_api_key")
        .eq("user_id", usuarioData.auth_user_id)
        .maybeSingle();

    if (settingsError) {
        console.error('❌ [API_KEY] Error al obtener settings:', settingsError);
        throw new Error('Error al obtener configuración: ' + settingsError.message);
    }

    if (!settingsData?.mercadopago_api_key) {
        console.error('❌ [API_KEY] No hay API Key configurada en user_settings');
        throw new Error('No se encontró una API Key configurada para este estacionamiento. Por favor, configura tu API Key de MercadoPago en la sección de Configuración de Pagos.');
    }

    const key = settingsData.mercadopago_api_key.trim();
    console.log(`✅ [API_KEY] API Key encontrada, primeros 10 caracteres: ${key.substring(0, 10)}...`);

    if (!key.startsWith('TEST-') && !key.startsWith('APP_USR-')) {
        console.error(`❌ [API_KEY] Formato inválido. Comienza con: ${key.substring(0, 20)}`);
        throw new Error('El formato de la API Key no es válido. Debe comenzar con TEST- o APP_USR-');
    }

    console.log(`✅ [API_KEY] API Key validada correctamente`);
    return key;
}

export async function POST(request: NextRequest) {
    try {
        console.log('📥 [RESERVA] Iniciando creación de reserva');
        const supabase = await createAuthenticatedSupabaseClient();
        const body: CrearReservaRequest = await request.json();

        console.log('📥 [RESERVA] Body recibido:', JSON.stringify(body));

        const { est_id, pla_numero, veh_patente, fecha_inicio, duracion_horas, metodo_pago } = body;

        console.log('📥 [RESERVA] Parametros extraídos:', { est_id, pla_numero, veh_patente, fecha_inicio, duracion_horas, metodo_pago });

        // Validar parámetros requeridos
        if (!est_id || !pla_numero || !veh_patente || !fecha_inicio || !duracion_horas || !metodo_pago) {
            console.error('❌ [RESERVA] Parámetros faltantes:', { est_id, pla_numero, veh_patente, fecha_inicio, duracion_horas, metodo_pago });
            return NextResponse.json({
                success: false,
                error: 'Todos los parámetros son requeridos'
            }, { status: 400 });
        }

        console.log('✅ [RESERVA] Parámetros válidos, continuando...');

        // Validar tiempo de reserva
        const validacionTiempo = validarTiempoReserva(fecha_inicio);
        if (!validacionTiempo.valido) {
            console.error(`❌ [RESERVA] Validación de tiempo fallida: ${validacionTiempo.error}`);
            console.error(`   Fecha inicio: ${fecha_inicio}`);
            console.error(`   Hora actual: ${new Date().toISOString()}`);
            return NextResponse.json({
                success: false,
                error: validacionTiempo.error
            }, { status: 400 });
        }

        console.log('✅ [RESERVA] Validación de tiempo exitosa');

        // Validar duración
        if (duracion_horas < 1 || duracion_horas > 24) {
            console.error('❌ [RESERVA] Duración inválida:', duracion_horas);
            return NextResponse.json({
                success: false,
                error: 'La duración debe estar entre 1 y 24 horas'
            }, { status: 400 });
        }

        console.log('✅ [RESERVA] Duración válida');

        // Validar método de pago
        if (!['link_pago', 'qr'].includes(metodo_pago)) {
            console.error('❌ [RESERVA] Método de pago inválido:', metodo_pago);
            return NextResponse.json({
                success: false,
                error: 'Solo se aceptan pagos con MercadoPago (QR o Link de Pago)'
            }, { status: 400 });
        }

        console.log('✅ [RESERVA] Método de pago válido:', metodo_pago);
        console.log(`🔄 [RESERVA] Creando reserva: est_id=${est_id}, plaza=${pla_numero}, vehículo=${veh_patente}, inicio=${fecha_inicio}, duración=${duracion_horas}h`);

        // 1. Verificar que el conductor esté autenticado
        console.log('🔐 [RESERVA] Verificando autenticación...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('❌ [RESERVA] Usuario no autenticado:', authError);
            return NextResponse.json({
                success: false,
                error: 'Usuario no autenticado'
            }, { status: 401 });
        }

        console.log('✅ [RESERVA] Usuario autenticado:', user.id);

        // 2. Obtener datos del conductor
        console.log('🔍 [RESERVA] Buscando datos del conductor...');
        const { data: conductor, error: conductorError } = await supabase
            .from('conductores')
            .select(`
        con_id,
        usuario!inner(
          usu_id,
          usu_nom,
          usu_ape,
          usu_email,
          usu_tel
        )
      `)
            .eq('usuario.auth_user_id', user.id)
            .single();

        if (conductorError || !conductor) {
            console.error('❌ [RESERVA] Conductor no encontrado:', conductorError);
            return NextResponse.json({
                success: false,
                error: 'Conductor no encontrado'
            }, { status: 404 });
        }

        console.log('✅ [RESERVA] Conductor encontrado:', conductor.con_id);

        // 3. Verificar que el vehículo pertenezca al conductor
        console.log('🚗 [RESERVA] Verificando vehículo...');
        const { data: vehiculo, error: vehiculoError } = await supabase
            .from('vehiculos')
            .select('veh_patente, catv_segmento')
            .eq('veh_patente', veh_patente)
            .eq('con_id', conductor.con_id)
            .single();

        if (vehiculoError || !vehiculo) {
            console.error('❌ [RESERVA] Vehículo no encontrado:', vehiculoError);
            return NextResponse.json({
                success: false,
                error: 'Vehículo no encontrado o no pertenece al conductor'
            }, { status: 404 });
        }

        console.log('✅ [RESERVA] Vehículo verificado');

        // 4. Calcular fechas de la nueva reserva
        const fechaInicioDate = dayjs(fecha_inicio).tz('America/Argentina/Buenos_Aires', true).toDate();
        const fechaFinDate = dayjs(fechaInicioDate).add(duracion_horas, 'hours').toDate();

        // Verificar que no tenga reservas activas que se solapen con la nueva
        console.log('🔍 [RESERVA] Verificando reservas activas que se solapen...');

        const { data: reservasActivas, error: reservasError } = await supabase
            .from('reservas')
            .select('res_codigo, res_fh_ingreso, res_fh_fin, pla_numero')
            .eq('con_id', conductor.con_id)
            .in('res_estado', ['pendiente_pago', 'confirmada', 'activa']);

        if (reservasError) {
            console.error('❌ [RESERVA] Error verificando reservas activas:', reservasError);
            return NextResponse.json({
                success: false,
                error: 'Error verificando reservas existentes'
            }, { status: 500 });
        }

        // Verificar solapamiento manualmente
        const reservasSolapadas = reservasActivas?.filter(reserva => {
            const reservaInicio = dayjs(reserva.res_fh_ingreso).tz('America/Argentina/Buenos_Aires', true).toDate();
            const reservaFin = dayjs(reserva.res_fh_fin).tz('America/Argentina/Buenos_Aires', true).toDate();
            // Solapamiento: reserva existente comienza antes de que termine la nueva Y termina después de que comienza la nueva
            return reservaInicio < fechaFinDate && reservaFin > fechaInicioDate;
        }) || [];

        if (reservasSolapadas.length > 0) {
            console.error('❌ [RESERVA] Usuario tiene reservas que se solapan con la nueva');
            console.error('Reservas solapadas:', reservasSolapadas);
            return NextResponse.json({
                success: false,
                error: 'Ya tienes una reserva activa en este horario. No puedes crear otra que se solape.'
            }, { status: 400 });
        }

        console.log('✅ [RESERVA] No hay reservas solapadas');

        // 5. Verificar disponibilidad de la plaza usando la función SQL
        console.log('🔍 [RESERVA] Verificando disponibilidad de plaza...');

        const { data: disponible, error: disponibilidadError } = await supabase
            .rpc('validar_disponibilidad_plaza', {
                p_est_id: est_id,
                p_pla_numero: pla_numero,
                p_fecha_inicio: fechaInicioDate.toISOString(),
                p_fecha_fin: fechaFinDate.toISOString()
            });

        if (disponibilidadError) {
            console.error('❌ [RESERVA] Error verificando disponibilidad:', disponibilidadError);
            return NextResponse.json({
                success: false,
                error: 'Error verificando disponibilidad de la plaza'
            }, { status: 500 });
        }

        if (!disponible) {
            console.error('❌ [RESERVA] Plaza no disponible');
            return NextResponse.json({
                success: false,
                error: 'La plaza no está disponible en el horario seleccionado'
            }, { status: 409 });
        }

        console.log('✅ [RESERVA] Plaza disponible');

        // 6. Obtener tarifa de la plaza
        console.log('💰 [RESERVA] Obteniendo información de la plaza...');
        const { data: plazaData, error: plazaError } = await supabase
            .from('plazas')
            .select('plantilla_id, catv_segmento')
            .eq('est_id', est_id)
            .eq('pla_numero', pla_numero)
            .single();

        if (plazaError || !plazaData) {
            console.error('❌ [RESERVA] Plaza no encontrada:', plazaError);
            return NextResponse.json({
                success: false,
                error: 'Plaza no encontrada'
            }, { status: 404 });
        }

        console.log('✅ [RESERVA] Plaza encontrada, plantilla_id:', plazaData.plantilla_id);

        // 7. Obtener tarifa actual
        console.log('💰 [RESERVA] Obteniendo tarifa...');
        const { data: tarifaData, error: tarifaError } = await supabase
            .from('tarifas')
            .select('tar_precio')
            .eq('plantilla_id', plazaData.plantilla_id)
            .eq('catv_segmento', plazaData.catv_segmento)
            .lte('tar_f_desde', fechaInicioDate.toISOString())
            .order('tar_f_desde', { ascending: false })
            .limit(1)
            .single();

        if (tarifaError || !tarifaData) {
            console.error('❌ [RESERVA] Tarifa no encontrada:', tarifaError);
            return NextResponse.json({
                success: false,
                error: 'No se encontró tarifa para esta plaza'
            }, { status: 404 });
        }

        console.log('✅ [RESERVA] Tarifa encontrada:', tarifaData.tar_precio);

        // HARDCODEADO: Precio fijo de 10 pesos por hora para testing QR
        const precioPorHora = 10; // Hardcodeado para testing
        const precioTotal = calcularPrecioReserva(precioPorHora, duracion_horas);

        console.log('💰 [RESERVA] Precio total calculado (HARDCODEADO):', precioTotal, `(10 pesos x ${duracion_horas} horas)`);

        // 8. Generar código de reserva único
        console.log('📝 [RESERVA] Generando código de reserva...');
        const resCodigoGenerado = await generarCodigoReserva(supabase);
        console.log(`✅ [RESERVA] Código de reserva generado: ${resCodigoGenerado}`);

        // 9. Para métodos de pago online (QR, link_pago): procesar pago ANTES de crear reserva
        // Para transferencia: crear reserva directamente
        console.log(`💳 [RESERVA] Método de pago: ${metodo_pago} - Procesando...`);
        let paymentInfo: any = {};
        let preferenceId = '';

        // Procesar pago PRIMERO si es online
        if (metodo_pago === 'link_pago' || metodo_pago === 'qr') {
            try {
                console.log(`💳 [MERCADOPAGO] Creando preference para validación: ${resCodigoGenerado}`);

                const accessToken = await getApiKey(est_id);
                const { data: estacionamientoData } = await supabase
                    .from('estacionamientos')
                    .select('est_nombre')
                    .eq('est_id', est_id)
                    .single();

                const estacionamientoNombre = estacionamientoData?.est_nombre || 'Estacionamiento';

                const preferenceData: any = {
                    items: [{
                        id: resCodigoGenerado,
                        title: `Reserva ${estacionamientoNombre} - Plaza ${pla_numero}`,
                        description: `Reserva de ${duracion_horas} hora(s) para vehículo ${veh_patente}`,
                        quantity: 1,
                        unit_price: precioTotal,
                        currency_id: 'ARS'
                    }],
                    external_reference: resCodigoGenerado,
                    notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/reservas/procesar-pago?res_codigo=${resCodigoGenerado}`,
                    back_urls: {
                        success: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=success&res_codigo=${resCodigoGenerado}`,
                        failure: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=failure&res_codigo=${resCodigoGenerado}`,
                        pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?status=pending&res_codigo=${resCodigoGenerado}`
                    },
                    auto_return: 'approved',
                    statement_descriptor: 'RESERVA ESTACIONAMIENTO'
                };

                // Configurar métodos de pago para QR si es método QR
                if (metodo_pago === 'qr') {
                    // Para QR, configuramos payment_methods pero NO point_of_interaction
                    // porque MercadoPago no genera QR en preferences regulares
                    preferenceData.payment_methods = {
                        default_payment_method_id: 'account_money',
                        excluded_payment_methods: [
                            { id: 'credit_card' },
                            { id: 'debit_card' },
                            { id: 'bank_transfer' }
                        ],
                        excluded_payment_types: [
                            { id: 'ticket' },
                            { id: 'atm' }
                        ],
                        installments: 1
                    };
                    preferenceData.binary_mode = true;
                }

                console.log(`🔄 [MERCADOPAGO] Enviando preference a MercadoPago...`);

                const mpResponse = await fetch(`https://api.mercadopago.com/checkout/preferences?access_token=${accessToken}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(preferenceData)
                });

                if (!mpResponse.ok) {
                    const errorData = await mpResponse.json();
                    console.error('❌ [MERCADOPAGO] Error:', errorData);
                    return NextResponse.json({
                        success: false,
                        error: 'Error procesando pago con MercadoPago: ' + errorData.message
                    }, { status: 400 });
                }

                const preferenceResult = await mpResponse.json();
                preferenceId = preferenceResult.id;

                // ✅ Actualizar notification_url con el preference_id real
                // NOTA: MercadoPago no permite actualizar notification_url después de crear la preference
                // Por lo tanto, construimos la URL correcta desde el principio usando el preferenceId
                // que obtendremos de la respuesta

                console.log(`✅ [MERCADOPAGO] Preference creada: ${preferenceResult.id}`);
                console.log(`📝 [MERCADOPAGO] Notification URL debería ser: ${process.env.NEXT_PUBLIC_APP_URL}/api/reservas/procesar-pago?preference_id=${preferenceResult.id}`);

                if (metodo_pago === 'link_pago') {
                    paymentInfo = {
                        preference_id: preferenceResult.id,
                        init_point: preferenceResult.init_point,
                        sandbox_init_point: preferenceResult.sandbox_init_point
                    };
                } else if (metodo_pago === 'qr') {
                    // Para QR, MercadoPago no devuelve point_of_interaction en preferences regulares
                    // Necesitamos usar el init_point y generar un QR desde esa URL
                    // O usar el endpoint de QR Dinámico (que requiere configuración adicional)
                    
                    // Por ahora, usamos init_point como código QR
                    // El usuario escaneará y será redirigido a MercadoPago para pagar
                    const qrUrl = preferenceResult.init_point || preferenceResult.sandbox_init_point || '';
                    
                    if (!qrUrl) {
                        console.error('❌ [MERCADOPAGO] No se encontró init_point en la respuesta');
                        return NextResponse.json({
                            success: false,
                            error: 'No se pudo generar el código QR. MercadoPago no devolvió URL de pago.'
                        }, { status: 400 });
                    }
                    
                    console.log(`✅ [MERCADOPAGO] Usando init_point como QR: ${qrUrl.substring(0, 50)}...`);
                    
                    paymentInfo = {
                        preference_id: preferenceResult.id,
                        qr_code: qrUrl, // Usamos la URL de checkout como código QR
                        qr_code_base64: null, // No disponible en preferences regulares
                        init_point: preferenceResult.init_point,
                        sandbox_init_point: preferenceResult.sandbox_init_point
                    };
                    
                    console.log(`✅ [MERCADOPAGO] QR Code configurado (generado desde init_point)`);
                }

            } catch (error) {
                console.error('❌ [MERCADOPAGO] Error:', error);
                return NextResponse.json({
                    success: false,
                    error: 'Error procesando pago con MercadoPago: ' + (error instanceof Error ? error.message : 'Error desconocido')
                }, { status: 500 });
            }
        }

        // 10. NO CREAR la reserva en BD, devolver solo datos temporales
        console.log('📦 [RESERVA] Preparando datos temporales (NO se crea reserva en BD aún)...');

        console.log('🎉 [RESERVA] Datos temporales preparados exitosamente');

        const response: CrearReservaResponse = {
            success: true,
            data: {
                reserva_temporal: {
                    est_id,
                    pla_numero,
                    veh_patente,
                    res_codigo: resCodigoGenerado,
                    res_fh_ingreso: dayjs(fechaInicioDate).tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss'),
                    res_fh_fin: dayjs(fechaFinDate).tz('America/Argentina/Buenos_Aires').format('YYYY-MM-DD HH:mm:ss'),
                    con_id: conductor.con_id,
                    res_monto: precioTotal,
                    res_tiempo_gracia_min: 15,
                    metodo_pago: metodo_pago,
                },
                payment_info: paymentInfo
            }
        };

        return NextResponse.json(response);

    } catch (error) {
        console.error('❌ [RESERVA] Error en creación de reserva:', error);
        console.error('❌ [RESERVA] Error details:', error instanceof Error ? error.message : error);

        // Devolver el error específico si es posible
        const errorMessage = error instanceof Error ? error.message : 'Error interno del servidor';

        return NextResponse.json({
            success: false,
            error: errorMessage
        }, { status: 500 });
    }
}
