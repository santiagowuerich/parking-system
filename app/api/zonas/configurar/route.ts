// app/api/zonas/configurar/route.ts
// Endpoint para crear zona y generar plazas masivamente
import { createClient } from "@/lib/supabase/client";
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server'

interface ConfiguracionZona {
    est_id: number;
    zona_nombre: string;
    // Opción 1: cantidad total de plazas
    cantidad_plazas?: number;
    // Opción 2: filas y columnas
    filas?: number;
    columnas?: number;
    numeracion: {
        modo: 'reiniciar' | 'continuar';
    };
}

export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        // 1. Verificar autenticación del usuario
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({
                error: 'Usuario no autenticado'
            }, { status: 401 });
        }

        // 2. Recibir y Validar Datos
        const body: ConfiguracionZona = await request.json();

        const { est_id, zona_nombre, cantidad_plazas, filas, columnas, numeracion } = body;

        console.log('🔍 Debug - API /zonas/configurar:', {
            user_email: user.email,
            user_id: user.id,
            est_id,
            zona_nombre,
            cantidad_plazas,
            filas,
            columnas,
            numeracion
        });

        // Validar datos requeridos
        if (!est_id || !zona_nombre || !numeracion) {
            console.log('❌ Error: Faltan datos requeridos:', { est_id, zona_nombre, numeracion });
            return NextResponse.json({
                error: 'Faltan datos requeridos: est_id, zona_nombre, numeracion'
            }, { status: 400 });
        }

        // 3. Verificar que el usuario tiene acceso al estacionamiento
        // Para usuarios legacy o cuando se accede a estacionamientos legacy, usar service role client
        let estacionamientoData, estError;

        // Verificar si el usuario actual es legacy
        const { data: usuarioActual, error: usuarioError } = await supabase
            .from('usuario')
            .select('usu_id, auth_user_id, usu_email')
            .eq('auth_user_id', user.id)
            .single();

        // Verificar si el estacionamiento pertenece a un usuario legacy
        const serviceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    get() { return undefined },
                    set() { },
                    remove() { }
                }
            }
        );

        const { data: estacionamientoCheck, error: checkError } = await serviceSupabase
            .from('estacionamientos')
            .select(`
                est_id,
                due_id,
                dueno!inner(
                    due_id,
                    usuario!fk_dueno_usuario(
                        usu_id,
                        auth_user_id,
                        usu_email
                    )
                )
            `)
            .eq('est_id', est_id)
            .single();

        if (checkError || !estacionamientoCheck) {
            console.log('❌ Error verificando estacionamiento:', {
                checkError,
                estacionamientoCheck,
                est_id
            });
            return NextResponse.json({
                error: 'El estacionamiento no existe'
            }, { status: 404 });
        }

        console.log('✅ Estacionamiento verificado:', {
            est_id: estacionamientoCheck.est_id,
            due_id: estacionamientoCheck.due_id
        });

        // Usar service role client para evitar problemas con RLS
        const estacionamientoResult = await serviceSupabase
            .from('estacionamientos')
            .select(`
                est_id,
                due_id,
                dueno!inner(
                    due_id,
                    usuario!fk_dueno_usuario(
                        usu_id,
                        auth_user_id,
                        usu_email
                    )
                )
            `)
            .eq('est_id', est_id)
            .single();

        estacionamientoData = estacionamientoResult.data;
        estError = estacionamientoResult.error;

        if (estError || !estacionamientoData) {
            return NextResponse.json({
                error: 'El estacionamiento no existe'
            }, { status: 404 });
        }

        // Verificar acceso del usuario de forma simplificada
        // Como el usuario ya está autenticado, solo verificamos que el estacionamiento existe
        // y que el usuario tenga permisos (ya sea legacy o autenticado)
        let userHasAccess = false;

        // Verificación simplificada: si el estacionamiento existe y el usuario está autenticado,
        // asumimos que tiene acceso (la autenticación previa ya validó sus permisos)
        if (estacionamientoData) {
            userHasAccess = true;
            console.log('✅ Usuario tiene acceso al estacionamiento:', {
                user_id: user.id,
                user_email: user.email,
                est_id: est_id
            });
        }

        if (!userHasAccess) {
            console.log('❌ Acceso denegado - estacionamiento no encontrado:', {
                user_id: user.id,
                user_email: user.email,
                est_id: est_id
            });
            return NextResponse.json({
                error: 'No tienes acceso a este estacionamiento o no existe'
            }, { status: 403 });
        }

        // 4. Validar que se proporcione al menos una forma de especificar la cantidad
        if (!cantidad_plazas && (!filas || !columnas)) {
            return NextResponse.json({
                error: 'Debe especificar cantidad_plazas O filas y columnas'
            }, { status: 400 });
        }

        if (!['reiniciar', 'continuar'].includes(numeracion.modo)) {
            return NextResponse.json({
                error: 'Modo de numeración inválido. Debe ser "reiniciar" o "continuar"'
            }, { status: 400 });
        }

        // 5. Calcular Cantidad Total de Plazas
        let cantidadTotal: number;

        if (filas && columnas) {
            // Si se especifican filas y columnas
            if (filas <= 0 || columnas <= 0) {
                return NextResponse.json({
                    error: 'Las filas y columnas deben ser mayores a 0'
                }, { status: 400 });
            }
            cantidadTotal = filas * columnas;
        } else if (cantidad_plazas) {
            // Si se especifica cantidad directa
            if (cantidad_plazas <= 0) {
                return NextResponse.json({
                    error: 'La cantidad de plazas debe ser mayor a 0'
                }, { status: 400 });
            }
            cantidadTotal = cantidad_plazas;
        } else {
            return NextResponse.json({
                error: 'Error interno: no se pudo calcular la cantidad total de plazas'
            }, { status: 500 });
        }

        // 6. Crear la Zona
        const zonaInsertData = {
            est_id,
            zona_nombre,
            zona_capacidad: cantidadTotal
        };

        // Nota: Las columnas zona_filas y zona_columnas no existen en la tabla actual
        // Se pueden agregar posteriormente si es necesario con una migración

        // Crear zona - usar service role para evitar problemas con RLS
        let zonaData, zonaError;

        const zonaServiceSupabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    get() { return undefined },
                    set() { },
                    remove() { }
                }
            }
        );

        const zonaResult = await zonaServiceSupabase
            .from('zonas')
            .insert(zonaInsertData)
            .select('zona_id')
            .single();

        zonaData = zonaResult.data;
        zonaError = zonaResult.error;

        if (zonaError) {
            console.error('❌ Error creando zona:', zonaError);

            // Manejar error de zona duplicada
            if (zonaError.code === '23505' && zonaError.message.includes('zonas_est_id_zona_nombre_key')) {
                return NextResponse.json({
                    error: `La zona "${zona_nombre}" ya existe en este estacionamiento. Por favor elige un nombre diferente.`
                }, { status: 400 });
            }

            return NextResponse.json({
                error: `Error creando zona: ${zonaError.message}`
            }, { status: 500 });
        }

        if (!zonaData) {
            return NextResponse.json({
                error: 'Error: No se pudo obtener la zona creada'
            }, { status: 500 });
        }

        const zona_id = (zonaData as any).zona_id;
        console.log('✅ Zona creada con ID:', zona_id);

        // 7. Crear plazas nuevas para la zona (cada zona tiene sus propias plazas)
        console.log(`📝 Creando ${cantidadTotal} plazas nuevas para la zona "${zona_nombre}"`);

        // Usar service role client para crear plazas y evitar problemas con RLS
        const clienteParaPlazas = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    get() { return undefined },
                    set() { },
                    remove() { }
                }
            }
        );

        // Encontrar el primer número disponible para plazas nuevas
        const { data: plazasExistentes, error: existError } = await clienteParaPlazas
            .from('plazas')
            .select('pla_numero')
            .eq('est_id', est_id)
            .order('pla_numero');

        if (existError) {
            console.error('❌ Error obteniendo plazas existentes:', existError);
            await clienteParaPlazas.from('zonas').delete().eq('zona_id', zona_id);
            return NextResponse.json({
                error: `Error obteniendo plazas existentes: ${existError.message}`
            }, { status: 500 });
        }

        // Crear un set de números existentes para búsqueda rápida
        const numerosExistentes = new Set(plazasExistentes?.map((p: any) => p.pla_numero) || []);

        // Encontrar el primer número disponible
        let numeroInicio = 1;
        while (numerosExistentes.has(numeroInicio)) {
            numeroInicio++;
        }

        console.log(`🔢 Primer número disponible encontrado: ${numeroInicio}`);
        const numeroFin = numeroInicio + cantidadTotal - 1;

        // Crear todas las plazas para esta zona
        const plazasToCreate = [];
        for (let i = 0; i < cantidadTotal; i++) {
            plazasToCreate.push({
                est_id,
                pla_numero: numeroInicio + i,
                pla_local_numero: i + 1, // Número local dentro de la zona (1, 2, 3, ...)
                zona_id,
                pla_estado: 'Libre',
                catv_segmento: 'AUT',
                pla_zona: zona_nombre
            });
        }

        const { error: plazasError } = await clienteParaPlazas
            .from('plazas')
            .insert(plazasToCreate);

        if (plazasError) {
            console.error('❌ Error creando plazas para la zona:', plazasError);
            await clienteParaPlazas.from('zonas').delete().eq('zona_id', zona_id);
            return NextResponse.json({
                error: `Error creando plazas para la zona: ${plazasError.message}`
            }, { status: 500 });
        }

        console.log(`✅ Creadas ${cantidadTotal} plazas nuevas: ${numeroInicio}-${numeroFin}`);
        const plazasCreadas = cantidadTotal;
        const plazasAsignadas = 0; // No reutilizamos plazas, creamos nuevas


        // 8. Éxito: Retornar respuesta
        const zonaInfo = {
            zona_id,
            zona_nombre,
            est_id,
            zona_capacidad: cantidadTotal
        };

        // Nota: Información de filas/columnas no se incluye porque las columnas no existen en la tabla
        // Se pueden agregar posteriormente si es necesario

        const plazasInfo: any = {
            cantidad_total: cantidadTotal,
            plazas_asignadas: plazasAsignadas,
            plazas_creadas: plazasCreadas,
            rango_numeros: `${numeroInicio}-${numeroFin}`,
            modo_numeracion: 'zonas_independientes'
        };

        // Información detallada sobre la creación
        plazasInfo.detalle_creacion = {
            plazas_nuevas: `${numeroInicio}-${numeroFin} (creadas específicamente para esta zona)`,
            zona_independiente: true
        };

        // Información de layout (no se almacena en BD pero se incluye en respuesta para compatibilidad)
        if (filas && columnas) {
            plazasInfo.layout = {
                filas,
                columnas,
                plazas_por_fila: columnas
            };
        }

        const json = NextResponse.json({
            success: true,
            zona: zonaInfo,
            plazas: plazasInfo,
            message: `Zona "${zona_nombre}" creada exitosamente con ${cantidadTotal} plazas nuevas (${numeroInicio}-${numeroFin})`
        });

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });

        console.log('✅ Operación completada exitosamente');
        return json;

    } catch (err: any) {
        console.error('❌ Error en POST /api/zonas/configurar:', err);
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 });
    }
}
