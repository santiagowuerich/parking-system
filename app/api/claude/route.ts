import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Expresión regular para detectar comandos de modificación de precio
const priceModificationRegex = /(?:modifica|modificar|cambia|cambiar|actualiza|actualizar|pon|poner|establece|establecer|setea|setear|configura|configurar|ajusta|ajustar|define|definir|fija|fijar)\s+(?:el|la)?\s*(?:(?:tarifa|precio|costo|valor|tasa|importe|monto)(?:\s+(?:del?|de\s+l(?:a|as|os)))?)?\s+(auto|carro|automóvil|coche|vehículo|automovil|vehiculo|moto|motocicleta|camioneta|van|pickup|camión|camion)s?\s+(?:a|por|en|hasta|como|de)?\s+\$?\s*(\d+(?:\.\d{1,2})?)/i;

// Expresión regular para detectar consultas sobre tarifas
const rateQueryRegex = /(?:cuál(?:es)?|cual(?:es)?|qué|que|cuánto|cuanto|cuanto cuesta|cuál es el precio|cual es el precio|cuál es el valor|cual es el valor|cuál es la tarifa|cual es la tarifa|dime|muéstrame|muestrame|ver|mostrar|consultar|listar)\s+(?:son|es|están|estan|hay|tienen|tenemos)?\s+(?:las|los)?\s*(?:tarifas?|precios?|costos?|valores?|tasas?|importes?|montos?|cobros?)(?:\s+(?:del?|para|por)\s+(?:estacionamiento|parking|parqueo|aparcamiento))?/i;

// Expresión regular para detectar consultas sobre vehículos estacionados
const parkedVehiclesQueryRegex = /(?:cuántos|cuantos|qué|que|cuáles|cuales|dime|muéstrame|muestrame|ver|mostrar|consultar|listar)\s+(?:los|las)?\s*(?:vehículos|vehiculos|autos|carros|coches|motos|motocicletas|camionetas|vans|pickups|camiones)\s+(?:hay|están|estan|tenemos|tengo|existen|registrados|estacionados|parqueados|aparcados)(?:\s+(?:en|dentro|del?|en el|actualmente|ahora|en este momento)?\s+(?:estacionamiento|parking|parqueo|aparcamiento))?/i;

// Nueva Expresión Regular para modificar disponibilidad total (v8 - Anclada en Tipo y Número)
const availabilityModificationRegex = /(?:che\s+)?(?:cambia|modifica|actualiza|establece|pon|setea|define|tengo|hay|asignar|fijar|ponele|metele|dame|habilita|ajusta|agregale|cambiá|modificá|actualizá|poné|seteá|definí|asigná|fijá|ajustá|habilitá|agregá|quiero\s+tener)\s+(?:.*?\s+)?\b(autos?|carros?|coches?|vehículos?|motos?|motocicletas?|camionetas?|vans?|pickups?)\b(?:\s+.*?)?\s+(\d+)(?:\s+(?:espacios?|lugares?|plazas?|boxes?|cocheras?|puestos?))?/i;

// Función auxiliar para crear un cliente Supabase simple
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role key

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase URL or Service Role Key is not defined in environment variables.");
  }
  
  // Crear cliente con service role key
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Función para actualizar user_rates
async function updateUserRate(userId: string, vehicleType: string, price: number) {
  console.log(`Intentando actualizar user_rates para userId: ${userId}, vehicleType: ${vehicleType}, price: ${price}`);
  try {
    const supabase = getSupabaseClient();

    // Normalizar el tipo de vehículo a los valores de la tabla
    let normalizedType = '';
    if (/auto|carro|automóvil|coche|vehículo|automovil|vehiculo/i.test(vehicleType)) {
      normalizedType = 'Auto';
    } else if (/moto|motocicleta/i.test(vehicleType)) {
      normalizedType = 'Moto';
    } else if (/camioneta|van|pickup/i.test(vehicleType)) {
      normalizedType = 'Camioneta';
    } else {
      console.error(`Tipo de vehículo no reconocido para normalización: ${vehicleType}`);
      return {
        success: false,
        message: `Tipo de vehículo no reconocido: ${vehicleType}`
      };
    }
    console.log(`Normalized vehicle type: ${normalizedType}`);

    // Primero intentar actualizar
    const { data: updateData, error: updateError } = await supabase
      .from('user_rates')
      .update({ rate: price })
      .eq('user_id', userId)
      .eq('vehicle_type', normalizedType)
      .select();

    // Si no se actualizó ninguna fila, intentar insertar
    if (!updateData || updateData.length === 0) {
      console.log('No se encontró tarifa existente, intentando crear una nueva...');
      
      const { data: insertData, error: insertError } = await supabase
        .from('user_rates')
        .insert([
          {
            user_id: userId,
            vehicle_type: normalizedType,
            rate: price
          }
        ])
        .select();

      if (insertError) {
        console.error('Error al insertar nueva tarifa:', insertError);
        return {
          success: false,
          message: `Error al crear nueva tarifa: ${insertError.message}`
        };
      }

      if (insertData && insertData.length > 0) {
        console.log('Nueva tarifa creada exitosamente:', insertData[0]);
        return {
          success: true,
          message: `He creado una nueva tarifa personalizada para ${normalizedType} de $${price}.`
        };
      }
    }

    if (updateError) {
      console.error(`Error al actualizar user_rates:`, updateError);
      return {
        success: false,
        message: `Error al actualizar tu tarifa personalizada: ${updateError.message}`
      };
    }

    console.log(`Tarifa actualizada exitosamente:`, updateData?.[0]);
    return {
      success: true,
      message: `He actualizado tu tarifa personalizada para ${normalizedType} a $${price}.`
    };

  } catch (error) {
    console.error(`Error en updateUserRate:`, error);
    return {
      success: false,
      message: `Error interno al procesar tu tarifa personalizada: ${(error as Error).message}`
    };
  }
}

// Nueva Función para actualizar/insertar capacidad total
async function updateUserCapacity(userId: string, vehicleType: string, totalSpaces: number) {
  console.log(`Intentando actualizar capacidad para userId: ${userId}, vehicleType: ${vehicleType}, totalSpaces: ${totalSpaces}`);
  try {
    const supabase = getSupabaseClient();

    // Normalizar el tipo de vehículo
    let normalizedType = '';
    if (/auto|carro|coche|vehículo/i.test(vehicleType)) {
      normalizedType = 'Auto';
    } else if (/moto|motocicleta/i.test(vehicleType)) {
      normalizedType = 'Moto';
    } else if (/camioneta|van|pickup/i.test(vehicleType)) {
      normalizedType = 'Camioneta';
    } else {
      console.error(`Tipo de vehículo no reconocido para capacidad: ${vehicleType}`);
      return {
        success: false,
        message: `Tipo de vehículo no reconocido para ajustar capacidad: ${vehicleType}`
      };
    }
    console.log(`Normalized vehicle type for capacity: ${normalizedType}`);

    // Upsert: Actualiza si existe, inserta si no
    const { data, error } = await supabase
      .from('user_capacity') // Corregido: Nombre de la tabla
      .upsert(
        {
          user_id: userId,
          vehicle_type: normalizedType,
          capacity: totalSpaces, // Corregido: Nombre de la columna
        },
        {
           onConflict: 'user_id, vehicle_type', // Especifica las columnas del conflicto para actualizar
           ignoreDuplicates: false // Asegúrate que no ignore para que actualice
        }
      )
      .select(); // Devuelve el registro insertado/actualizado

    if (error) {
      console.error(`Error en upsert de user_capacity:`, error); // Corregido: Nombre tabla en log
      return {
        success: false,
        message: `Error al actualizar la capacidad de ${normalizedType}: ${error.message}`
      };
    }

    console.log(`Capacidad actualizada/creada exitosamente:`, data?.[0]);
    return {
      success: true,
      message: `He actualizado la capacidad total para ${normalizedType} a ${totalSpaces} espacios.`
    };

  } catch (error) {
    console.error(`Error en updateUserCapacity:`, error);
    return {
      success: false,
      message: `Error interno al procesar la actualización de capacidad: ${(error as Error).message}`
    };
  }
}

// Función para obtener las tarifas actuales (puede necesitar ajuste si debe leer user_rates)
// Por ahora la dejamos apuntando a 'rates' como estaba originalmente.
async function getCurrentRates() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('rates') // Tabla general de tarifas
      .select('*');

    if (error) {
      console.error('Error al obtener tarifas generales:', error);
      return { success: false, message: `Error al obtener tarifas generales: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: false, message: 'No se encontraron tarifas generales en la base de datos.' };
    }
    const ratesText = data.map(rate => `${rate.type}: $${rate.rate}`).join('\n');
    return { success: true, message: `Las tarifas generales actuales por hora son:\n${ratesText}` };
  } catch (error) {
    console.error('Error al obtener tarifas generales:', error);
    return { success: false, message: `Error al obtener tarifas generales: ${(error as Error).message}` };
  }
}

// Función para obtener vehículos estacionados (sin cambios)
async function getParkedVehicles() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('parked_vehicles')
      .select('*');

    if (error) {
      console.error('Error al obtener vehículos estacionados:', error);
      return { success: false, message: `Error al obtener vehículos estacionados: ${error.message}` };
    }
    if (!data || data.length === 0) {
      return { success: true, message: 'Actualmente no hay vehículos estacionados.' };
    }
    const vehicleCounts = data.reduce((counts: Record<string, number>, vehicle) => {
      const type = vehicle.type || 'desconocido';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    let message = `Actualmente hay ${data.length} vehículo(s) estacionado(s):\n`;
    Object.entries(vehicleCounts).forEach(([type, count]) => { message += `${type}: ${count}\n`; });
    return { success: true, message };
  } catch (error) {
    console.error('Error al obtener vehículos estacionados:', error);
    return { success: false, message: `Error al obtener vehículos estacionados: ${(error as Error).message}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    // --- Extraer userId del body ---
    const body = await request.json();
    const userMessage = body.message;
    const userId = body.userId; // IMPORTANTE: El frontend debe enviar esto

    console.log('Mensaje del usuario:', userMessage);
    console.log('Recibido userId:', userId);

    // --- Validar userId ---
    if (!userId) {
      console.error('Error: userId no proporcionado en la solicitud.');
      return NextResponse.json(
        { error: 'Falta el identificador de usuario (userId) en la solicitud.' },
        { status: 400 } // Bad Request
      );
    }

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
        // --- Llamar a la función updateUserRate ---
        const result = await updateUserRate(userId, vehicleType, price);
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
          // --- Llamar a la nueva función updateUserCapacity ---
          const result = await updateUserCapacity(userId, vehicleType, totalSpaces);
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
        const result = await getCurrentRates();
        aiResponse = result.message;
      } else {
        console.log('❌ No es una consulta sobre tarifas generales');

        // Verificar si es una consulta sobre vehículos estacionados (sin cambios)
        const parkedVehiclesQueryMatch = userMessage.match(parkedVehiclesQueryRegex);

        if (parkedVehiclesQueryMatch) {
          console.log('✅ Es una consulta sobre vehículos estacionados');
          const result = await getParkedVehicles();
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