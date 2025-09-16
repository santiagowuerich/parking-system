import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

// Expresión regular para detectar comandos de modificación de precio
const priceModificationRegex = /(?:modifica|modificar|cambia|cambiar|actualiza|actualizar|pon|poner|establece|establecer|setea|setear|configura|configurar|ajusta|ajustar|define|definir|fija|fijar)\s+(?:el|la)?\s*(?:(?:tarifa|precio|costo|valor|tasa|importe|monto)(?:\s+(?:del?|de\s+l(?:a|as|os)))?)?\s+(auto|carro|automóvil|coche|vehículo|automovil|vehiculo|moto|motocicleta|camioneta|van|pickup|camión|camion)s?\s+(?:a|por|en|hasta|como|de)?\s+\$?\s*(\d+(?:\.\d{1,2})?)/i;

// Expresión regular para detectar consultas sobre tarifas
const rateQueryRegex = /(?:cuál(?:es)?|cual(?:es)?|qué|que|cuánto|cuanto|cuanto cuesta|cuál es el precio|cual es el precio|cuál es el valor|cual es el valor|cuál es la tarifa|cual es la tarifa|dime|muéstrame|muestrame|ver|mostrar|consultar|listar)\s+(?:son|es|están|estan|hay|tienen|tenemos)?\s+(?:las|los)?\s*(?:tarifas?|precios?|costos?|valores?|tasas?|importes?|montos?|cobros?)(?:\s+(?:del?|para|por)\s+(?:estacionamiento|parking|parqueo|aparcamiento))?/i;

// Expresión regular para detectar consultas sobre vehículos estacionados
const parkedVehiclesQueryRegex = /(?:cuántos|cuantos|qué|que|cuáles|cuales|dime|muéstrame|muestrame|ver|mostrar|consultar|listar)\s+(?:los|las)?\s*(?:vehículos|vehiculos|autos|carros|coches|motos|motocicletas|camionetas|vans|pickups|camiones)\s+(?:hay|están|estan|tenemos|tengo|existen|registrados|estacionados|parqueados|aparcados)(?:\s+(?:en|dentro|del?|en el|actualmente|ahora|en este momento)?\s+(?:estacionamiento|parking|parqueo|aparcamiento))?/i;

// Nueva Expresión Regular para modificar disponibilidad total (v8 - Anclada en Tipo y Número)
const availabilityModificationRegex = /(?:che\s+)?(?:cambia|modifica|actualiza|establece|pon|setea|define|tengo|hay|asignar|fijar|ponele|metele|dame|habilita|ajusta|agregale|cambiá|modificá|actualizá|poné|seteá|definí|asigná|fijá|ajustá|habilitá|agregá|quiero\s+tener)\s+(?:.*?\s+)?\b(autos?|carros?|coches?|vehículos?|motos?|motocicletas?|camionetas?|vans?|pickups?)\b(?:\s+.*?)?\s+(\d+)(?:\s+(?:espacios?|lugares?|plazas?|boxes?|cocheras?|puestos?))?/i;

function getSupabaseClient(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

const mapVehToSeg = (vehicleType: string): 'AUT' | 'MOT' | 'CAM' | null => {
  const vt = vehicleType.toLowerCase();
  if (/moto|motocicleta/.test(vt)) return 'MOT';
  if (/camioneta|van|pickup|camión|camion/.test(vt)) return 'CAM';
  if (/auto|carro|coche|vehículo|automovil|vehiculo|automóvil/.test(vt)) return 'AUT';
  return null;
};

async function upsertTarifaHora(estId: number, vehicleType: string, price: number) {
  const supabase = getSupabaseClient();
  const seg = mapVehToSeg(vehicleType);
  if (!seg) {
    return { success: false, message: `Tipo de vehículo no reconocido: ${vehicleType}` };
  }
  const now = new Date().toISOString();
  const row = { est_id: estId, tiptar_nro: 1, catv_segmento: seg, tar_f_desde: now, tar_precio: Number(price), tar_fraccion: 1 };
  const { error } = await supabase.from('tarifas').insert([row]);
  if (error) return { success: false, message: `Error al actualizar tarifa: ${error.message}` };
  return { success: true, message: `Tarifa por hora para ${vehicleType} actualizada a $${price} (Normal).` };
}

async function syncPlazasPorTipo(estId: number, vehicleType: string, totalSpaces: number) {
  const supabase = getSupabaseClient();
  const seg = mapVehToSeg(vehicleType);
  if (!seg) return { success: false, message: `Tipo de vehículo no reconocido: ${vehicleType}` };

  const { data: plazas, error } = await supabase
    .from('plazas')
    .select('pla_numero, catv_segmento')
    .eq('est_id', estId);
  if (error) return { success: false, message: `Error leyendo plazas: ${error.message}` };

  const current = (plazas || []).filter(p => p.catv_segmento === seg);
  const diff = totalSpaces - current.length;
  if (diff === 0) return { success: true, message: `Capacidad para ${vehicleType} ya es ${totalSpaces}.` };

  if (diff > 0) {
    const numbers = (plazas || []).map(p => p.pla_numero);
    let next = (numbers.length ? Math.max(...numbers) : 0) + 1;
    const rows = Array.from({ length: diff }).map(() => ({ est_id: estId, pla_numero: next++, pla_estado: 'Libre', catv_segmento: seg }));
    const { error: insErr } = await supabase.from('plazas').insert(rows);
    if (insErr) return { success: false, message: `Error insertando plazas: ${insErr.message}` };
  } else {
    const toDelete = Math.abs(diff);
    const ids = current.slice(0, toDelete).map(p => p.pla_numero);
    if (ids.length > 0) {
      const { error: delErr } = await supabase.from('plazas').delete().eq('est_id', estId).in('pla_numero', ids);
      if (delErr) return { success: false, message: `Error eliminando plazas: ${delErr.message}` };
    }
  }
  return { success: true, message: `Capacidad de plazas para ${vehicleType} ajustada a ${totalSpaces}.` };
}

async function getCurrentRates(estId: number) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tarifas')
      .select('catv_segmento, tar_precio, tar_f_desde')
      .eq('est_id', estId)
      .eq('tiptar_nro', 1)
      // .eq('pla_tipo', 'Normal') - columna ya no existe
      .order('tar_f_desde', { ascending: false });
    if (error) {
      return { success: false, message: `Error al obtener tarifas: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: false, message: 'No se encontraron tarifas vigentes.' };
    }
    const latestBySeg: Record<string, number> = {};
    for (const row of data) { if (latestBySeg[row.catv_segmento] == null) latestBySeg[row.catv_segmento] = Number(row.tar_precio); }
    const segToName = (s: string) => (s === 'MOT' ? 'Moto' : s === 'CAM' ? 'Camioneta' : 'Auto');
    const lines = Object.entries(latestBySeg).map(([seg, price]) => `${segToName(seg)}: $${Number(price).toFixed(2)}`);
    return { success: true, message: `Tarifas por Hora (Normal):\n${lines.join('\n')}` };
  } catch (error) {
    return { success: false, message: `Error al obtener tarifas: ${(error as Error).message}` };
  }
}

async function getParkedVehicles(estId: number) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('vw_ocupacion_actual')
      .select('*')
      .eq('est_id', estId);
    if (error) {
      return { success: false, message: `Error al obtener vehículos estacionados: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: true, message: 'Actualmente no hay vehículos estacionados.' };
    }
    const vehicleCounts = data.reduce((counts: Record<string, number>, vehicle: any) => {
      const type = vehicle.type || 'desconocido';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    let message = `Actualmente hay ${data.length} vehículo(s) estacionado(s):\n`;
    Object.entries(vehicleCounts).forEach(([type, count]) => { message += `${type}: ${count}\n`; });
    return { success: true, message };
  } catch (error) {
    return { success: false, message: `Error al obtener vehículos estacionados: ${(error as Error).message}` };
  }
}

// Eliminadas funciones legacy basadas en user_rates/user_capacity/rates en favor del nuevo esquema español.

// (función duplicada eliminada)

export async function POST(request: NextRequest) {
  try {
    // --- Extraer userId del body ---
    const body = await request.json();
    const userMessage = body.message;
    const estId = Number(body.est_id) || 1;

    let aiResponse = '';

    console.log('--- DEBUG ---');
    console.log('User Message:', JSON.stringify(userMessage)); // Log con JSON.stringify para ver caracteres ocultos
    console.log('Regex:', priceModificationRegex.toString()); // Log el regex como string
    // Verificar si es un comando de modificación de precio
    const priceModificationMatch = userMessage.match(priceModificationRegex);
    console.log('Match Result Price:', priceModificationMatch); // Log el resultado del match
    console.log('--- END DEBUG ---');

    // Verificar si es un comando de modificación de disponibilidad
    console.log('--- DEBUG AVAILABILITY ---');
    console.log('Regex Availability:', availabilityModificationRegex.toString());
    const availabilityModificationMatch = userMessage.match(availabilityModificationRegex);
    console.log('Match Result Availability:', availabilityModificationMatch);
    console.log('--- END DEBUG AVAILABILITY ---');

    if (priceModificationMatch) {
      console.log('✅ Es un comando de modificación de precio');
      const vehicleType = priceModificationMatch[1];
      const price = parseFloat(priceModificationMatch[2]);

      console.log('Tipo de vehículo detectado (precio):', vehicleType);
      console.log('Precio detectado:', price);

      if (vehicleType && !isNaN(price)) {
        const result = await upsertTarifaHora(estId, vehicleType, price);
        aiResponse = result.message;
        console.log('Resultado de updateUserRate:', result);
      } else {
        aiResponse = 'No pude entender correctamente el tipo de vehículo o el precio. Por favor, intenta de nuevo con un formato como "modificar auto a $10".';
      }
    } else if (availabilityModificationMatch) {
      console.log('✅ Es un comando de modificación de disponibilidad');
      const vehicleType = availabilityModificationMatch[1];
      const totalSpaces = parseInt(availabilityModificationMatch[2], 10);

      console.log('Tipo de vehículo detectado (disponibilidad):', vehicleType);
      console.log('Total espacios detectados:', totalSpaces);

      if (vehicleType && !isNaN(totalSpaces)) {
        const result = await syncPlazasPorTipo(estId, vehicleType, totalSpaces);
        aiResponse = result.message;
        console.log('Resultado de updateUserCapacity:', result);
      } else {
        aiResponse = 'No pude entender correctamente el tipo de vehículo o el número de espacios. Por favor, intenta de nuevo con un formato como "establece la capacidad de motos a 20 espacios".';
      }
    } else {
      console.log('❌ No es un comando de modificación de precio ni disponibilidad');

      // Verificar si es una consulta sobre tarifas (mantiene la lógica original de rates generales)
      const rateQueryMatch = userMessage.match(rateQueryRegex);

      if (rateQueryMatch) {
        console.log('✅ Es una consulta sobre tarifas generales');
        const result = await getCurrentRates(estId);
        aiResponse = result.message;
      } else {
        console.log('❌ No es una consulta sobre tarifas generales');

        // Verificar si es una consulta sobre vehículos estacionados (sin cambios)
        const parkedVehiclesQueryMatch = userMessage.match(parkedVehiclesQueryRegex);

        if (parkedVehiclesQueryMatch) {
          console.log('✅ Es una consulta sobre vehículos estacionados');
          const result = await getParkedVehicles(estId);
          aiResponse = result.message;
        } else {
          console.log('❌ No es una consulta sobre vehículos estacionados ni tarifas generales');

          // Si no es ninguno de los comandos especiales, enviar a Claude
          console.log('Enviando mensaje a Claude API...');
          try {
            const claudeMessages = [{ role: "user", content: userMessage }];
            const systemPrompt = `Eres un asistente amable y servicial para un operador de estacionamiento.
            Tu trabajo es responder consultas sobre el sistema de estacionamiento, ayudar a resolver problemas y proporcionar información útil.
            Sé breve, profesional y cortés en tus respuestas.
            Puedes informar sobre tarifas generales y vehículos estacionados si se te pregunta específicamente.
            IMPORTANTE: Tú NO puedes modificar tarifas ni la capacidad de espacios directamente. Esas acciones solo se realizan si el usuario usa un comando con formato específico que el sistema reconoce internamente.
            Si el usuario intenta modificar algo y el sistema no lo reconoce (es decir, si este mensaje llega a ti), responde indicando que no entendiste el comando específico para modificar y sugiere un formato válido, como por ejemplo: 'modifica la tarifa de [tipo vehículo] a $[monto]' o 'establece la capacidad de [tipo vehículo] a [número] espacios'. NO confirmes ninguna modificación que no haya sido explícitamente procesada por el sistema interno.`; // Prompt actualizado para evitar falsas confirmaciones

            const apiKey = process.env.CLAUDE_API_KEY;
            if (!apiKey) {
              console.error("Error: CLAUDE_API_KEY no está configurada.");
              throw new Error("API key de Claude no configurada.");
            }


            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: "claude-3-haiku-20240307", // Asegúrate que este es el modelo correcto
                max_tokens: 1000,
                system: systemPrompt,
                messages: claudeMessages
              })
            });

            if (!response.ok) {
              const errorBody = await response.text();
              console.error(`Error ${response.status} de Claude API: ${errorBody}`);
              throw new Error(`Error de Claude API: ${response.statusText}`);
            }


            const data = await response.json();
            console.log("Respuesta de Claude API:", data);


            if (data.content && data.content.length > 0 && data.content[0].text) {
              aiResponse = data.content[0].text;
            } else {
              console.warn("Respuesta de Claude API no tuvo contenido esperado:", data);
              aiResponse = "Lo siento, no pude procesar tu consulta con el asistente en este momento.";
            }
          } catch (error) {
            console.error('Error al llamar a Claude API:', error);
            // Devuelve el mensaje de error específico si es una instancia de Error
            const errorMessage = (error instanceof Error) ? error.message : "Error desconocido";
            aiResponse = `Ocurrió un error al procesar tu mensaje con el asistente externo: ${errorMessage}. Por favor, inténtalo de nuevo más tarde.`;
          }
        }
      }
    }

    console.log("Enviando respuesta al frontend:", aiResponse);
    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('Error general en el endpoint POST /api/claude:', error);
    const errorMessage = (error instanceof Error) ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: `Error interno del servidor al procesar la solicitud: ${errorMessage}` },
      { status: 500 }
    );
  }
} 