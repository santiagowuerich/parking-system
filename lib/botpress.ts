import { Client } from '@botpress/client'

const BOTPRESS_TOKEN = process.env.NEXT_PUBLIC_BOTPRESS_TOKEN

// Solo crea el cliente si el token existe
const botpressClient = BOTPRESS_TOKEN ? new Client({ token: BOTPRESS_TOKEN }) : null

export async function sendMessage(message: string, userId?: string) {
  // Si el cliente no se pudo inicializar (falta token), no hagas nada o retorna un aviso
  if (!botpressClient) {
    console.warn('Botpress client no inicializado. Falta NEXT_PUBLIC_BOTPRESS_TOKEN.')
    return 'Asistente no disponible (falta configuración de token).'; // O simplemente return;
  }

  // Use the real userId if available, otherwise use the nil UUID for anonymous users
  const effectiveUserId = userId || '00000000-0000-0000-0000-000000000000'; 
  // Use userId directly if available (it's 36 chars), otherwise use a short fixed ID.
  const conversationIdToSend = userId ? userId : 'anonymous-config-session' // Max 36 chars
  
  try {
    const response = await botpressClient.createMessage({
      // Use the validated/shortened conversationId
      conversationId: conversationIdToSend, 
      // Pass the potentially modified userId (real or nil UUID)
      userId: effectiveUserId,
      type: 'text',
      payload: { 
        text: message
      },
      tags: {
        source: 'parking-system-config'
      }
    })
    
    console.log('Message sent to Botpress:', response.message.id)
    return 'Mensaje enviado al asistente.'

  } catch (error: any) {
    // Manejar errores específicos de Botpress de forma más detallada si es necesario
    console.error('Error al enviar mensaje a Botpress:', error?.message || error)
    // No relanzar el error para no bloquear el flujo principal del chatbot
    // throw new Error('Error al comunicar con el asistente.') 
    return 'Error al contactar al asistente externo.' // Informar al componente si es necesario
  }
}

// Exporta el cliente (puede ser null)
export { botpressClient } 