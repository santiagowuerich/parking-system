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
                dueno(
                    due_id,
                    usuario(
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
            dueno_auth_user_id: (estacionamientoCheck.dueno as any)?.usuario?.[0]?.[0]?.auth_user_id,
            dueno_email: (estacionamientoCheck.dueno as any)?.usuario?.[0]?.[0]?.usu_email
        });

        // Usar service role client si:
        // 1. El usuario actual es legacy, O
        // 2. El estacionamiento pertenece a un usuario legacy
        const usarServiceRole = usuarioActual?.auth_user_id === null || !usuarioActual || (estacionamientoCheck.dueno as any)?.usuario?.[0]?.[0]?.auth_user_id === null;

        if (usarServiceRole) {
            // Usar service role client para evitar problemas con RLS
            const result = await serviceSupabase
                .from('estacionamientos')
                .select(`
                    est_id,
                    est_nombre,
                    due_id,
                    dueno(
                        due_id,
                        usuario(
                            usu_id,
                            auth_user_id,
                            usu_email
                        )
                    )
                `)
                .eq('est_id', est_id)
                .single();

            estacionamientoData = result.data;
            estError = result.error;
        } else {
            // Usuario autenticado normal accediendo a estacionamiento normal - usar cliente regular con RLS
            const result = await supabase
                .from('estacionamientos')
                .select(`
                    est_id,
                    est_nombre,
                    due_id,
                    dueno(
                        due_id,
                        usuario(
                            usu_id,
                            auth_user_id,
                            usu_email
                        )
                    )
                `)
                .eq('est_id', est_id)
                .single();

            estacionamientoData = result.data;
            estError = result.error;
        }

        if (estError || !estacionamientoData) {
            return NextResponse.json({
                error: 'El estacionamiento no existe'
            }, { status: 404 });
        }

        // Verificar acceso del usuario (considerar usuarios legacy y autenticados)
        let userHasAccess = false;

        if ((estacionamientoData.dueno as any)?.usuario?.[0]?.auth_user_id === user.id) {
            // Usuario autenticado con Supabase y vinculado correctamente
            userHasAccess = true;
        } else if ((estacionamientoData.dueno as any)?.usuario?.[0]?.auth_user_id === null) {
            // Usuario legacy - permitir acceso temporal para migración
            console.log('⚠️ Acceso legacy permitido para estacionamiento:', est_id);
            userHasAccess = true;
        }

        if (!userHasAccess) {
            console.log('❌ Acceso denegado:', {
                user_id: user.id,
                user_email: user.email,
                dueno_auth_user_id: (estacionamientoData.dueno as any)?.usuario?.[0]?.auth_user_id,
                dueno_email: (estacionamientoData.dueno as any)?.usuario?.[0]?.usu_email
            });
            return NextResponse.json({
                error: 'No tienes acceso a este estacionamiento'
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

        // Para usuarios legacy (sin auth_user_id), usar el service role client
        let zonaData, zonaError;

        if ((estacionamientoData.dueno as any)?.usuario?.[0]?.auth_user_id === null) {
            // Usuario legacy - usar service role client para bypasear RLS
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

            const result = await serviceSupabase
                .from('zonas')
                .insert(zonaInsertData)
                .select('zona_id')
                .single();

            zonaData = result.data;
            zonaError = result.error;
        } else {
            // Usuario autenticado normal
            const result = await supabase
                .from('zonas')
                .insert(zonaInsertData)
                .select('zona_id')
                .single();

            zonaData = result.data;
            zonaError = result.error;
        }

        if (zonaError || !zonaData) {
            console.error('❌ Error creando zona:', zonaError);

            // Manejar error de zona duplicada
            if (zonaError?.code === '23505' && zonaError.message.includes('zonas_est_id_zona_nombre_key')) {
                return NextResponse.json({
                    error: `La zona "${zona_nombre}" ya existe en este estacionamiento. Por favor elige un nombre diferente.`
                }, { status: 400 });
            }

            return NextResponse.json({
                error: zonaError ? `Error creando zona: ${zonaError.message}` : 'No se pudo crear la zona'
            }, { status: 500 });
        }

        const zona_id = zonaData.zona_id;
        console.log('✅ Zona creada con ID:', zona_id);

        // 7. Crear plazas nuevas para la zona (cada zona tiene sus propias plazas)
        console.log(`📝 Creando ${cantidadTotal} plazas nuevas para la zona "${zona_nombre}"`);

        // Usar el mismo cliente que se usó para crear la zona
        const clienteParaPlazas = (estacionamientoData.dueno as any)?.usuario?.[0]?.auth_user_id === null ?
            createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                {
                    cookies: {
                        get() { return undefined },
                        set() { },
                        remove() { }
                    }
                }
            ) : supabase;

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
