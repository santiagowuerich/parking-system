'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { MessageSquare, Send, X, AlertCircle, RefreshCw } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { Session } from '@supabase/supabase-js'
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: string
  isError?: boolean
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'initial-1',
    content: 'Hola! Soy tu asistente de estacionamiento. ¿En qué puedo ayudarte hoy? (puedes pedirme actualizar tarifas, ver vehículos, etc.)',
    isUser: false,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
];

export function OperatorChat() {
  const { initializeRates, initRatesDone } = useAuth();
  const [session, setSession] = useState<Session | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Usar el estado del contexto en lugar del estado local
  const [isInitialized, setIsInitialized] = useState(initRatesDone);

  // Agregar estado para detectar comandos especiales
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);

  // --- Obtener el ID del usuario desde la sesión --- 
  // Ya no es un placeholder, usamos el estado 'session'
  const currentUserId = session?.user?.id; 

  useEffect(() => {
    const fetchSession = async () => {
      console.log("Fetching session...");
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Error fetching session:", error);
        toast.error("Error al obtener la sesión del usuario.");
      } else {
         console.log("Session fetched:", session);
        setSession(session);
      }
    };
    fetchSession();
  }, [supabase]); // Dependencia solo de supabase

  // Efecto para sincronizar el estado local con el contexto
  useEffect(() => {
    setIsInitialized(initRatesDone);
  }, [initRatesDone]);

  // Actualizar el efecto que inicializa las tarifas
  useEffect(() => {
    if (!isInitialized) {
      // Llamar a la función del contexto en lugar de la función local
      initializeRates();
      setIsInitialized(true);
    }
  }, [isInitialized, initializeRates]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  // Función para detectar si es un comando para el sistema
  const isSystemCommand = (text: string): boolean => {
    // Regex para detectar comandos de modificación de precios
    const priceModRegex = /(?:modificar|cambiar|actualizar|poner|fijar|establecer|setear)\s+(?:la\s+)?(?:tarifa|precio|costo|valor\s+)?(?:de\s+)?(?:auto|coche|carro|automóvil|moto|motocicleta|camioneta|van|pickup)s?\s+(?:a|por|en)?\s+\$?(\d+)/i;
    
    // Regex para consulta de tarifas
    const ratesQueryRegex = /(?:ver|mostrar|cuáles son|consultar)\s+(?:las\s+)?(?:tarifas|precios)/i;
    
    // Regex para consulta de vehículos
    const vehiclesQueryRegex = /(?:ver|mostrar|cuáles son|cuantos|consultar)\s+(?:los\s+)?(?:vehículos|autos|motos|camionetas)\s+(?:estacionados|en el estacionamiento)/i;
    
    // Añadir logs para ayudar a depurar
    if (priceModRegex.test(text)) {
      console.log('✅ Detectado comando de modificación de precio en frontend:', text);
      return true;
    }
    return ratesQueryRegex.test(text) || vehiclesQueryRegex.test(text);
  };

  const sendMessageToClaude = async (userMessage: string) => {
    setIsLoading(true);
    setError(null);

    // --- Validar que tenemos el userId antes de enviar --- 
    if (!currentUserId) {
       console.error("sendMessageToClaude: No se pudo obtener el ID del usuario de la sesión.");
       setError("No se pudo identificar al usuario. Por favor, recarga la página.");
       toast.error("Error de autenticación: No se pudo identificar al usuario.");
       setIsLoading(false);
       return null; 
    }
    console.log(`sendMessageToClaude: Enviando mensaje como userId: ${currentUserId}`);

    try {
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: userMessage,
          userId: currentUserId // <--- Ahora usa el ID real de la sesión
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error al parsear respuesta del servidor' }));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.response;

    } catch (err: any) {
      console.error("Error sending message to /api/claude:", err);
      const errorMessage = err.message || 'Error al comunicar con el servidor.';
      setError(errorMessage);
      toast.error(`Error al enviar mensaje: ${errorMessage}`); // Mostrar toast de error
      return null; // Devolver null en caso de error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    const isCommand = isSystemCommand(inputValue.trim());
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    if (isCommand) {
      setIsProcessingCommand(true);
    }

    const aiResponseContent = await sendMessageToClaude(userMessage.content);

    if (aiResponseContent !== null) { // Solo añadir respuesta si no hubo error
       const assistantMessage: Message = {
         id: (Date.now() + 1).toString(),
         content: aiResponseContent,
         isUser: false,
         timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
       };
       setMessages(prev => [...prev, assistantMessage]);
    } else {
        // Opcional: añadir un mensaje de error al chat si falló la llamada
        const errorMessageContent = error || 'No se pudo obtener respuesta del asistente.'; // Usar el estado de error
        const errorMessage: Message = {
           id: (Date.now() + 1).toString(),
           content: errorMessageContent,
           isUser: false,
           timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
           isError: true // Añadir una propiedad opcional para estilizar diferente
        };
        setMessages(prev => [...prev, errorMessage]);
        toast.error(errorMessageContent);
    }
  };

  // Función para reintentar conexión
  const retryConnection = async () => {
    if (messages.length < 2) return; // No hay suficientes mensajes para reintentar
    
    const lastUserMessage = [...messages].reverse().find(m => m.isUser);
    if (!lastUserMessage) return;
    
    // Mostrar mensaje de reintento
    setMessages(prev => [
      ...prev.filter(m => !m.content.includes("Error: Configuración")), // Quitar mensajes de error anteriores
      {
        id: Date.now().toString(),
        content: 'Reintentando conexión...',
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    
    setIsLoading(true);
    
    try {
      // Llamar al endpoint del backend
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: lastUserMessage.content })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido al procesar la respuesta del servidor.' }));
        throw new Error(errorData.error || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();

      // Reemplazar el mensaje de "Reintentando conexión..." con la respuesta
      setMessages(prev => {
        const filtered = prev.filter(m => !m.content.includes("Reintentando conexión..."));
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            content: data.response || 'No se recibió respuesta.',
            isUser: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
    } catch (error: any) {
      console.error('Error al reintentar:', error);
      // Actualizar el mensaje de reintento con el error
      setMessages(prev => {
        const filtered = prev.filter(m => !m.content.includes("Reintentando conexión..."));
        return [
          ...filtered,
          {
            id: Date.now().toString(),
            content: `Error: ${error.message || 'No se pudo conectar al servidor. Por favor, revisa la configuración y variables de entorno del servidor.'}`,
            isUser: false,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
      });
      toast.error('Error al reintentar la conexión');
    } finally {
      setIsLoading(false);
    }
  }

  // Modificar el renderizado para destacar los comandos de sistema
  const renderMessages = () => {
    return messages.map((message) => {
      // Detectar si es un comando del sistema (para mensajes del usuario)
      const isCommand = message.isUser && isSystemCommand(message.content);
      
      return (
        <div
          key={message.id}
          className={`flex mb-2 ${message.isUser ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] p-3 rounded-lg shadow-sm text-sm ${
              message.isUser
                ? isCommand 
                  ? 'bg-pink-500 text-white rounded-br-none' // Estilo para comandos
                  : 'bg-purple-500 text-white rounded-br-none' // Estilo regular para mensajes de usuario
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'
            }`}
          >
            {message.content}
            
            {/* Botón de reintento para mensajes de error de configuración */}
            {!message.isUser && message.content.includes("Error: Configuración") && (
              <button 
                onClick={retryConnection}
                disabled={isLoading}
                className="mt-2 flex items-center text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Reintentar conexión
              </button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-12 h-12 flex items-center justify-center shadow-lg bg-purple-500 hover:bg-purple-600"
          aria-label="Abrir asistente del operador"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-80 h-[500px] flex flex-col border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-purple-500 text-white rounded-t-lg">
            <h3 className="font-semibold">Asistente del Operador</h3>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 text-black hover:text-gray-700 dark:text-white dark:hover:text-gray-300"
              onClick={() => {
                setIsOpen(false);
                window.location.reload();
              }}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Cerrar chat</span>
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {renderMessages()}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isLoading ? "Procesando..." : "Escribe tu mensaje..."}
                disabled={isLoading}
                className="flex-1 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 dark:text-gray-100"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
                className="bg-purple-500 hover:bg-purple-600 text-white rounded-md disabled:opacity-50"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
} 