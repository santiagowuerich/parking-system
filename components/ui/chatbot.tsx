'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from './button'
import { Input } from './input'
import { MessageSquare, Send, X } from 'lucide-react'
import { sendMessage } from '@/lib/botpress'
import { useToast } from './use-toast'
import { createBrowserClient } from '@supabase/ssr'
import { Session } from '@supabase/supabase-js'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface ParkingConfigData {
  carRate?: number
  motorcycleRate?: number
  vanRate?: number
  carCapacity?: number
  motorcycleCapacity?: number
  vanCapacity?: number
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'init-1',
    content: '¡Hola! Soy tu asistente de configuración. Primero, ¿cuál es la tarifa por hora para autos? (Introduce solo el número)',
    isUser: false,
    timestamp: new Date()
  }
]

const CONFIG_QUESTIONS = [
  { key: 'carRate', question: 'Perfecto. Ahora, ¿cuál es la tarifa por hora para motos? (Introduce solo el número)', type: 'number' },
  { key: 'motorcycleRate', question: 'Entendido. ¿Y la tarifa por hora para camionetas? (Introduce solo el número)', type: 'number' },
  { key: 'vanRate', question: 'Genial. Ahora, introduce la capacidad total para Autos, Motos y Camionetas, separadas por coma (ej: 50,30,10). Puedes usar 0.', type: 'vehicleCapacities' },
  { key: 'vehicleCapacities', question: '', type: 'end' }
]

export function Chatbot() {
  const [session, setSession] = useState<Session | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [configData, setConfigData] = useState<Partial<ParkingConfigData>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
    };
    fetchSession();
  }, [supabase])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const saveConfiguration = async (finalConfig: ParkingConfigData) => {
    if (!session?.user) {
      toast({ title: "Error", description: "Debes iniciar sesión para guardar la configuración.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const savingMessage: Message = {
      id: 'saving',
      content: 'Guardando configuración usando las APIs...',
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, savingMessage]);

    const userId = session.user.id;
    let errorOccurred = false;
    let errorMessageContent = '';

    try {
      // 1. Llamar a POST /api/rates
      const ratesPayload = {
        userId: userId,
        // Ensure correct capitalization if API expects it (Auto, Moto, Camioneta)
        rates: {
          Auto: finalConfig.carRate ?? 0,
          Moto: finalConfig.motorcycleRate ?? 0,
          Camioneta: finalConfig.vanRate ?? 0 // Assuming API uses 'Camioneta'
        }
      };
      const ratesResponse = await fetch('/api/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ratesPayload)
      });

      if (!ratesResponse.ok) {
        const errorData = await ratesResponse.json();
        throw new Error(`Error guardando tarifas: ${errorData.error || ratesResponse.statusText}`);
      }

      // 2. Llamar a POST /api/capacity
      const capacityPayload = {
        userId: userId,
        // Ensure correct capitalization matching the rates payload
        capacity: {
          Auto: finalConfig.carCapacity ?? 0,
          Moto: finalConfig.motorcycleCapacity ?? 0,
          Camioneta: finalConfig.vanCapacity ?? 0
        }
      };
      const capacityResponse = await fetch('/api/capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capacityPayload)
      });

      if (!capacityResponse.ok) {
        const errorData = await capacityResponse.json();
        throw new Error(`Error guardando capacidad: ${errorData.error || capacityResponse.statusText}`);
      }

      // 3. Éxito (si ambas llamadas fueron ok)
      const successMessage: Message = {
        id: 'saved',
        content: '¡Configuración de tarifas y capacidad guardada exitosamente usando las APIs! Puedes cerrar esta ventana.',
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => prev.filter(m => m.id !== 'saving').concat(successMessage));
      toast({ title: "Éxito", description: "La configuración ha sido guardada." });

    } catch (error: any) {
      errorOccurred = true;
      errorMessageContent = error.message || 'Ocurrió un error inesperado.';
      console.error('Error detallado al guardar configuración vía API:', error);
      const errorMessage: Message = {
        id: 'save-error',
        content: `Error al guardar: ${errorMessageContent}. Por favor, revisa los datos o inténtalo más tarde.`,
        isUser: false,
        timestamp: new Date()
      };
      setMessages(prev => prev.filter(m => m.id !== 'saving').concat(errorMessage));
      toast({ title: "Error al guardar", description: errorMessageContent, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const currentConfigQuestion = CONFIG_QUESTIONS[currentQuestionIndex];
    let processedInput: any = input.trim();
    let isValid = true;
    let partialConfigUpdate: Partial<ParkingConfigData> = {};

    if (currentConfigQuestion.type === 'number') {
      const num = parseFloat(processedInput);
      if (isNaN(num) || num < 0) {
        toast({ title: "Entrada inválida", description: "Por favor, introduce un número válido (0 o mayor).", variant: "destructive" });
        isValid = false;
      } else {
        processedInput = num;
        partialConfigUpdate = { [currentConfigQuestion.key]: processedInput };
      }
    } else if (currentConfigQuestion.type === 'vehicleCapacities') {
      const parts = processedInput.split(',').map((s: string) => s.trim());
      if (parts.length !== 3) {
        toast({ title: "Entrada inválida", description: "Debes introducir exactamente 3 capacidades (Auto, Moto, Camioneta) separadas por coma (ej: 50,30,10).", variant: "destructive" });
        isValid = false;
      } else {
        const nums = parts.map(Number);
        if (nums.some(isNaN) || nums.some((n: number) => n < 0)) {
          toast({ title: "Entrada inválida", description: "Todas las capacidades deben ser números válidos (0 o mayor).", variant: "destructive" });
          isValid = false;
        } else {
          partialConfigUpdate = {
            carCapacity: nums[0],
            motorcycleCapacity: nums[1],
            vanCapacity: nums[2]
          };
          processedInput = nums;
        }
      }
    }

    if (!isValid) {
      setInput('');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isUser: true,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    setConfigData(prev => ({ ...prev, ...partialConfigUpdate }));
    setInput('');
    setIsLoading(true);

    // Enviar mensaje a Botpress (opcional, más para logging)
    try {
      await sendMessage(input, session?.user?.id);
      // No necesitamos hacer nada con la respuesta aquí
    } catch (error: any) {
       // Solo loguear la advertencia, no mostrar toast ni detener
       console.warn('No se pudo enviar mensaje al asistente externo:', error.message || error);
    }

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < CONFIG_QUESTIONS.length) {
      const nextQuestion = CONFIG_QUESTIONS[nextIndex];
      if (nextQuestion.type !== 'end') {
        const botQuestionMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: nextQuestion.question,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, botQuestionMessage]);
        setCurrentQuestionIndex(nextIndex);
        setIsLoading(false);
      } else {
        await saveConfiguration({ ...configData, ...partialConfigUpdate } as ParkingConfigData);
      }
    } else {
       console.warn("Reached end of questions unexpectedly.");
       setIsLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full w-12 h-12 flex items-center justify-center shadow-lg"
          aria-label="Abrir asistente de configuración"
        >
          <MessageSquare className="w-6 h-6" />
        </Button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-80 h-[500px] flex flex-col border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Asistente de Configuración</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar asistente"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex mb-2 ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-lg shadow-sm text-sm ${message.isUser
                      ? 'bg-blue-500 text-white rounded-br-none'
                      : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100 rounded-bl-none'}`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoading ? "Procesando..." : "Escribe tu respuesta..."}
                disabled={isLoading}
                className="flex-1 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100"
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50"
                aria-label="Enviar respuesta"
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