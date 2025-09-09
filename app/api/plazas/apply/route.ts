// app/api/plazas/apply/route.ts
// Endpoint para aplicar cambios de plantillas a plazas masivamente
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name) { return request.cookies.get(name)?.value },
                set(name, value, options) { response.cookies.set({ name, value, path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', ...options }) },
                remove(name) { response.cookies.set({ name, value: '', path: '/', expires: new Date(0) }) }
            }
        }
    )

    try {
        console.log('🔄 API /api/plazas/apply - Iniciando procesamiento');
        const body = await request.json()
        console.log('📥 Body recibido:', JSON.stringify(body, null, 2));

        const { est_id, zona_id, acciones } = body

        if (!est_id || !zona_id || !acciones || !Array.isArray(acciones)) {
            console.log('❌ Faltan campos requeridos');
            return NextResponse.json({
                error: 'Faltan campos requeridos: est_id, zona_id, acciones (array)'
            }, { status: 400 })
        }

        console.log(`✅ Procesando ${acciones.length} acciones para zona ${zona_id}`);

        // TODO: Validar que el usuario tenga acceso al estacionamiento
        // const { data: { user } } = await supabase.auth.getUser()
        // if (!user) return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })

        let updated = 0
        const warnings: string[] = []

        // Procesar cada acción
        for (const accion of acciones) {
            try {
                console.log(`🔄 Procesando acción: ${accion.tipo}`, accion);

                if (accion.tipo === 'APLICAR_PLANTILLA') {
                    if (!accion.plantilla_id || !accion.plazas || !Array.isArray(accion.plazas)) {
                        warnings.push(`Acción APLICAR_PLANTILLA inválida: faltan plantilla_id o plazas`)
                        continue
                    }

                    console.log(`📝 Aplicando plantilla ${accion.plantilla_id} a plazas:`, accion.plazas);

                    // Convertir números locales a números globales si es necesario
                    let plazasGlobales = accion.plazas;

                    // Si los números parecen ser locales (1-N), convertirlos a globales
                    if (accion.plazas.every((num: any) => typeof num === 'number' && num > 0 && num <= 60)) {
                        console.log(`🔄 Convirtiendo números locales a globales:`, accion.plazas);

                        // Obtener el mapeo de números locales a globales para esta zona
                        const { data: plazaMapping, error: mappingError } = await supabase
                            .from('plazas')
                            .select('pla_local_numero, pla_numero')
                            .eq('zona_id', zona_id)
                            .eq('est_id', est_id)
                            .in('pla_local_numero', accion.plazas);

                        if (!mappingError && plazaMapping) {
                            const localToGlobal = new Map();
                            plazaMapping.forEach((p: any) => {
                                localToGlobal.set(p.pla_local_numero, p.pla_numero);
                            });

                            plazasGlobales = accion.plazas.map((local: any) => localToGlobal.get(local) || local);
                            console.log(`✅ Conversión completada:`, plazasGlobales);
                        } else {
                            console.log(`⚠️ Error obteniendo mapeo local-global, usando números originales`);
                        }
                    }

                    // Validar que la plantilla existe y pertenece al estacionamiento
                    const { data: plantilla, error: plantillaError } = await supabase
                        .from('plantillas')
                        .select('plantilla_id, nombre_plantilla, catv_segmento')
                        .eq('plantilla_id', accion.plantilla_id)
                        .eq('est_id', est_id)
                        .single()

                    if (plantillaError || !plantilla) {
                        warnings.push(`Plantilla ${accion.plantilla_id} no existe o no pertenece al estacionamiento`)
                        continue
                    }

                    console.log(`✅ Plantilla validada: ${plantilla.nombre_plantilla}`);

                    // Aplicar plantilla usando la función de base de datos
                    const { data: result, error: applyError } = await supabase.rpc(
                        'fn_aplicar_plantilla_a_plazas',
                        {
                            p_est_id: est_id,
                            p_zona_id: zona_id,
                            p_plantilla_id: accion.plantilla_id,
                            p_plazas: plazasGlobales
                        }
                    )

                    if (applyError) {
                        console.error('❌ Error en fn_aplicar_plantilla_a_plazas:', applyError);
                        warnings.push(`Error aplicando plantilla ${plantilla.nombre_plantilla}: ${applyError.message}`)
                        continue
                    }

                    console.log(`✅ Plantilla aplicada, resultado: ${result}`);

                    // Si no se actualizaron todas las plazas, verificar cuáles no se pudieron actualizar
                    if (result !== accion.plazas.length) {
                        const plazasNoActualizadas = accion.plazas.length - (result || 0);
                        console.log(`⚠️ ${plazasNoActualizadas} plazas no se pudieron actualizar`);

                        // Verificar cuáles plazas están ocupadas
                        const { data: plazasOcupadas } = await supabase
                            .from('ocupacion')
                            .select('pla_numero')
                            .eq('est_id', est_id)
                            .in('pla_numero', accion.plazas)
                            .is('ocu_fh_salida', null);

                        if (plazasOcupadas && plazasOcupadas.length > 0) {
                            const ocupadasList = plazasOcupadas.map(p => p.pla_numero).join(', ');
                            console.log(`🏁 Plazas ocupadas (no actualizadas): ${ocupadasList}`);
                            warnings.push(`Plazas ocupadas (no actualizadas): ${ocupadasList}`);
                        }
                    }

                    updated += (result || 0)

                } else if (accion.tipo === 'LIMPIAR_PLANTILLA') {
                    if (!accion.plazas || !Array.isArray(accion.plazas)) {
                        warnings.push(`Acción LIMPIAR_PLANTILLA inválida: faltan plazas`)
                        continue
                    }

                    // Convertir números locales a números globales si es necesario
                    let plazasGlobales = accion.plazas;

                    // Si los números parecen ser locales (1-N), convertirlos a globales
                    if (accion.plazas.every((num: any) => typeof num === 'number' && num > 0 && num <= 60)) {
                        console.log(`🔄 Convirtiendo números locales a globales para limpieza:`, accion.plazas);

                        // Obtener el mapeo de números locales a globales para esta zona
                        const { data: plazaMapping, error: mappingError } = await supabase
                            .from('plazas')
                            .select('pla_local_numero, pla_numero')
                            .eq('zona_id', zona_id)
                            .eq('est_id', est_id)
                            .in('pla_local_numero', accion.plazas);

                        if (!mappingError && plazaMapping) {
                            const localToGlobal = new Map();
                            plazaMapping.forEach((p: any) => {
                                localToGlobal.set(p.pla_local_numero, p.pla_numero);
                            });

                            plazasGlobales = accion.plazas.map((local: any) => localToGlobal.get(local) || local);
                            console.log(`✅ Conversión completada para limpieza:`, plazasGlobales);
                        } else {
                            console.log(`⚠️ Error obteniendo mapeo local-global para limpieza, usando números originales`);
                        }
                    }

                    console.log(`🧹 Limpiando plantillas de plazas:`, plazasGlobales);

                    // Limpiar plantillas usando la función de base de datos
                    const { data: result, error: clearError } = await supabase.rpc(
                        'fn_limpiar_plantilla_de_plazas',
                        {
                            p_est_id: est_id,
                            p_zona_id: zona_id,
                            p_plazas: plazasGlobales
                        }
                    )

                    if (clearError) {
                        console.error('❌ Error en fn_limpiar_plantilla_de_plazas:', clearError);
                        warnings.push(`Error limpiando plantillas: ${clearError.message}`)
                        continue
                    }

                    console.log(`✅ Plantillas limpiadas, resultado: ${result}`);
                    updated += (result || 0)

                } else {
                    warnings.push(`Tipo de acción desconocido: ${accion.tipo}`)
                }

            } catch (actionError: any) {
                console.error('❌ Error procesando acción:', actionError);
                warnings.push(`Error procesando acción ${accion.tipo}: ${actionError.message}`)
            }
        }

        const totalPlazasProcesadas = acciones.reduce((total, accion) => total + accion.plazas.length, 0);
        console.log(`✅ Procesamiento completado: ${updated} plazas actualizadas de ${totalPlazasProcesadas} procesadas, ${warnings.length} warnings`);

        const skipped = totalPlazasProcesadas - updated;

        const result = {
            updated,
            total_processed: totalPlazasProcesadas,
            skipped,
            warnings,
            success: warnings.length === 0,
            message: skipped > 0
                ? `${updated} plazas actualizadas de ${totalPlazasProcesadas} procesadas (${skipped} omitidas - posiblemente ocupadas)`
                : `${updated} plazas actualizadas de ${totalPlazasProcesadas} procesadas`
        };

        console.log('📤 Respuesta final:', JSON.stringify(result, null, 2));

        const jsonResponse = NextResponse.json(result)

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c
            jsonResponse.cookies.set({ name, value, ...opt })
        })

        return jsonResponse

    } catch (err: any) {
        console.error('❌ Error inesperado en POST /api/plazas/apply:', err)
        return NextResponse.json({
            error: err.message || 'Error interno del servidor'
        }, { status: 500 })
    }
}
