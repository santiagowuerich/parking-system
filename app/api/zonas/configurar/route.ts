// app/api/zonas/configurar/route.ts
// Endpoint para crear zona y generar plazas masivamente
import { createClient } from "@/lib/supabase/client";
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
        // 1. Recibir y Validar Datos
        const body: ConfiguracionZona = await request.json();

        const { est_id, zona_nombre, cantidad_plazas, filas, columnas, numeracion } = body;

        // Validar datos requeridos
        if (!est_id || !zona_nombre || !numeracion) {
            return NextResponse.json({
                error: 'Faltan datos requeridos: est_id, zona_nombre, numeracion'
            }, { status: 400 });
        }

        // Validar que se proporcione al menos una forma de especificar la cantidad
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

        // 2. Calcular Cantidad Total de Plazas
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

        // 3. Crear la Zona
        const zonaInsertData = {
            est_id,
            zona_nombre,
            zona_capacidad: cantidadTotal
        };

        // Nota: Las columnas zona_filas y zona_columnas no existen en la tabla actual
        // Se pueden agregar posteriormente si es necesario con una migración

        const { data: zonaData, error: zonaError } = await supabase
            .from('zonas')
            .insert(zonaInsertData)
            .select('zona_id')
            .single();

        if (zonaError) {
            console.error('❌ Error creando zona:', zonaError);
            return NextResponse.json({
                error: `Error creando zona: ${zonaError.message}`
            }, { status: 500 });
        }

        const zona_id = zonaData.zona_id;
        console.log('✅ Zona creada con ID:', zona_id);

        // 3. Determinar el Número de Inicio de Plaza
        // Siempre comenzamos desde 1 para cada zona
        const numeroInicio = 1;

        // 4. Buscar plazas libres para reutilizar
        console.log(`🔍 Buscando ${cantidadTotal} plazas libres para asignar a la zona "${zona_nombre}"`);

        const { data: plazasLibres, error: libresError } = await supabase
            .from('plazas')
            .select('pla_numero')
            .eq('est_id', est_id)
            .eq('pla_estado', 'Libre')
            .is('zona_id', null)
            .order('pla_numero')
            .limit(cantidadTotal);

        if (libresError) {
            console.error('❌ Error buscando plazas libres:', libresError);
            await supabase.from('zonas').delete().eq('zona_id', zona_id);
            return NextResponse.json({
                error: `Error buscando plazas libres: ${libresError.message}`
            }, { status: 500 });
        }

        console.log(`✅ Encontradas ${plazasLibres?.length || 0} plazas libres`);

        let plazasAsignadas = 0;
        let plazasCreadas = 0;
        const numeroFin = numeroInicio + cantidadTotal - 1;

        // 5. Asignar plazas libres existentes a la zona
        if (plazasLibres && plazasLibres.length > 0) {
            const plazasParaAsignar = plazasLibres.slice(0, cantidadTotal);

            for (const plaza of plazasParaAsignar) {
                const { error: updateError } = await supabase
                    .from('plazas')
                    .update({
                        zona_id,
                        pla_zona: zona_nombre
                    })
                    .eq('est_id', est_id)
                    .eq('pla_numero', plaza.pla_numero);

                if (updateError) {
                    console.error(`❌ Error asignando plaza ${plaza.pla_numero}:`, updateError);
                    continue;
                }

                plazasAsignadas++;
            }

            console.log(`✅ Asignadas ${plazasAsignadas} plazas libres a la zona`);
        }

        // 6. Crear plazas adicionales si es necesario
        const plazasFaltantes = cantidadTotal - plazasAsignadas;

        if (plazasFaltantes > 0) {
            console.log(`📝 Creando ${plazasFaltantes} plazas adicionales`);

            // Encontrar el siguiente número disponible
            const { data: maxPlazaData } = await supabase
                .from('plazas')
                .select('pla_numero')
                .eq('est_id', est_id)
                .order('pla_numero', { ascending: false })
                .limit(1);

            const numeroInicioNuevo = (maxPlazaData && maxPlazaData.length > 0)
                ? maxPlazaData[0].pla_numero + 1
                : 1;

            const plazasToCreate = [];

            for (let i = 0; i < plazasFaltantes; i++) {
                plazasToCreate.push({
                    est_id,
                    pla_numero: numeroInicioNuevo + i,
                    zona_id,
                    pla_estado: 'Libre',
                    catv_segmento: 'AUT',
                    pla_zona: zona_nombre
                });
            }

            const { error: plazasError } = await supabase
                .from('plazas')
                .insert(plazasToCreate);

            if (plazasError) {
                console.error('❌ Error creando plazas adicionales:', plazasError);
                // No eliminamos la zona aquí porque ya asignamos algunas plazas
                return NextResponse.json({
                    error: `Error creando plazas adicionales: ${plazasError.message}`
                }, { status: 500 });
            }

            plazasCreadas = plazasFaltantes;
            console.log(`✅ Creadas ${plazasCreadas} plazas adicionales: ${numeroInicioNuevo}-${numeroInicioNuevo + plazasFaltantes - 1}`);
        }


        // 7. Éxito: Retornar respuesta
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
            rango_numeros: plazasAsignadas > 0 ? `1-${plazasAsignadas}` : `${numeroInicioNuevo}-${numeroInicioNuevo + plazasCreadas - 1}`,
            modo_numeracion: 'reutilizacion_inteligente'
        };

        // Información detallada sobre la asignación
        if (plazasAsignadas > 0) {
            plazasInfo.detalle_asignacion = {
                plazas_reutilizadas: `1-${plazasAsignadas} (previamente libres)`,
                plazas_nuevas: plazasCreadas > 0 ? `${numeroInicioNuevo}-${numeroInicioNuevo + plazasCreadas - 1}` : null
            };
        }

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
            message: `Zona "${zona_nombre}" creada exitosamente con ${cantidadTotal} plazas (${numeroInicio}-${numeroFin})`
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
