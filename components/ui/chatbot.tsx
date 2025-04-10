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
  bankAccountHolder?: string
  bankAccountCbu?: string
  bankAccountAlias?: string
}

// Define sequences for each section
const RATES_SEQUENCE = [
    { key: 'carRate', question: '¿Tarifa por hora para autos? (Número)', type: 'number' },
    { key: 'motorcycleRate', question: '¿Tarifa por hora para motos? (Número)', type: 'number' },
    { key: 'vanRate', question: '¿Tarifa por hora para camionetas? (Número)', type: 'number' },
];
const CAPACITY_SEQUENCE = [
    { key: 'vehicleCapacities', question: 'Introduce capacidad para Autos, Motos y Camionetas (ej: 50,30,10).', type: 'vehicleCapacities' },
];
const BANK_SEQUENCE = [
    { key: 'bankAccountHolder', question: '¿Nombre del titular de la cuenta?', type: 'string' },
    { key: 'bankAccountCbu', question: '¿CBU/CVU de la cuenta?', type: 'string' },
    { key: 'bankAccountAlias', question: '¿Alias de la cuenta?', type: 'string' },
];

// New Initial Message with Menu
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'init-menu',
    content: '¡Hola! ¿Qué deseas configurar hoy?\n1. Tarifas\n2. Espacios\n3. Cuenta Bancaria (Transferencia)\n(Escribe 1, 2 o 3)',
    isUser: false,
    timestamp: new Date()
  }
];

// Define Modes
type ConfigMode = null | 'rates' | 'capacity' | 'bank';

export function Chatbot() {
  const [session, setSession] = useState<Session | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // New state for mode and sub-sequence index
  const [mode, setMode] = useState<ConfigMode>(null)
  const [currentSubIndex, setCurrentSubIndex] = useState(0)
  
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

  const saveConfiguration = async (modeToSave: ConfigMode, dataToSave: Partial<ParkingConfigData>) => {
    if (!session?.user || !modeToSave) { 
        toast({ title: "Error", description: "No se puede guardar sin usuario o modo específico.", variant: "destructive" });
        return; 
    }
    setIsLoading(true);
    const savingMessage: Message = {
      id: 'saving-' + modeToSave,
      content: `Guardando configuración de ${modeToSave}...`,
      isUser: false,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, savingMessage]);

    const userId = session.user.id;
    let apiPath = '';
    let payload: any = { userId };
    let success = false;
    let errorMsg: string | null = null;

    try {
      if (modeToSave === 'rates') {
        apiPath = '/api/rates';
        payload.rates = {
          Auto: dataToSave.carRate ?? 0,
          Moto: dataToSave.motorcycleRate ?? 0,
          Camioneta: dataToSave.vanRate ?? 0
        };
      } else if (modeToSave === 'capacity') {
        apiPath = '/api/capacity';
        payload.capacity = {
          Auto: dataToSave.carCapacity ?? 0,
          Moto: dataToSave.motorcycleCapacity ?? 0,
          Camioneta: dataToSave.vanCapacity ?? 0
        };
      } else if (modeToSave === 'bank') {
        apiPath = '/api/user/settings';
        payload.bankAccountHolder = dataToSave.bankAccountHolder;
        payload.bankAccountCbu = dataToSave.bankAccountCbu;
        payload.bankAccountAlias = dataToSave.bankAccountAlias;
        // Don't send other user_settings fields unless intended
      }

      if (!apiPath) throw new Error("Modo de configuración inválido.");

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error al guardar ${modeToSave}`);
      }
      
      success = true;

    } catch (error: any) {
      console.error(`Error al guardar ${modeToSave}:`, error);
      errorMsg = error.message || `Error desconocido al guardar ${modeToSave}.`;
    } finally {
      setIsLoading(false);
      // Remove saving message
      setMessages(prev => prev.filter(m => m.id !== 'saving-' + modeToSave));

      if (success) {
        const successMessage: Message = {
          id: 'saved-' + modeToSave + Date.now(),
          content: `¡${modeToSave.charAt(0).toUpperCase() + modeToSave.slice(1)} configurados! ¿Deseas configurar algo más? (Escribe 'menu' para volver al inicio o cierra la ventana).`,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMessage]);
        toast({ title: "Éxito", description: `Configuración de ${modeToSave} guardada.` });
        // Reset state to allow further configuration
        setMode(null); 
        setCurrentSubIndex(0);
        setConfigData({}); // Clear potentially stale partial data
      } else {
        const errorMessage: Message = {
          id: 'error-save-' + modeToSave + Date.now(),
          content: `Error al guardar ${modeToSave}: ${errorMsg}. Intenta de nuevo o escribe 'menu'.`,
          isUser: false,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        toast({ title: `Error al guardar ${modeToSave}`, description: errorMsg, variant: "destructive" });
        // Optionally reset mode or keep it to allow retry
        // setMode(null); setCurrentSubIndex(0); setConfigData({});
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
       e.preventDefault();
       if (!input.trim() || isLoading) return;
       
       const currentInput = input.trim();
       const userMessage: Message = {
           id: Date.now().toString(),
           content: currentInput,
           isUser: true,
           timestamp: new Date()
       };
       setMessages(prev => [...prev, userMessage]);
       setInput('');
       setIsLoading(true);

       let nextBotMessage: Message | null = null;
       let newMode: ConfigMode = mode;
       let newSubIndex = currentSubIndex;
       let dataToUpdate: Partial<ParkingConfigData> = {};
       let shouldSave = false;

       if (mode === null) {
           // --- Handling Menu Choice (or 'menu' command) --- 
           let sequence: any[] = [];
           
           // Check for 'menu' command first
           if (currentInput.toLowerCase() === 'menu') {
               nextBotMessage = {
                   id: 'menu-redisplay-' + Date.now(),
                   content: INITIAL_MESSAGES[0].content, // Reuse the initial menu message content
                   isUser: false,
                   timestamp: new Date()
               };
               newMode = null; // Stay in menu mode
               newSubIndex = 0; // Reset sub-index just in case
           } 
           // Then check for numeric/keyword choices for configuration
           else if (currentInput === '1' || currentInput.toLowerCase().includes('tarifas')) {
               newMode = 'rates';
               sequence = RATES_SEQUENCE;
           } else if (currentInput === '2' || currentInput.toLowerCase().includes('espacios')) {
               newMode = 'capacity';
               sequence = CAPACITY_SEQUENCE;
           } else if (currentInput === '3' || currentInput.toLowerCase().includes('cuenta')) {
               newMode = 'bank';
               sequence = BANK_SEQUENCE;
           } else {
               // Invalid menu choice (and not 'menu')
               nextBotMessage = {
                   id: 'error-' + Date.now(),
                   content: "Opción inválida. Por favor, escribe 1, 2, 3 o 'menu'.",
                   isUser: false,
                   timestamp: new Date()
               };
               newMode = null; // Stay in menu mode
           }
           
           // If a valid config mode was chosen (not 'menu' command)
           if (newMode && newMode !== mode && sequence.length > 0) { // Added newMode !== mode check
               // Ask the first question of the selected sequence
               nextBotMessage = {
                   id: 'q-' + newMode + '-0', 
                   content: sequence[0].question,
                   isUser: false,
                   timestamp: new Date()
               };
               newSubIndex = 0; // Start from the first question
           }

       } else {
           // --- Handling Answer within a Mode --- 
           let currentSequence: any[] = [];
           if (mode === 'rates') currentSequence = RATES_SEQUENCE;
           else if (mode === 'capacity') currentSequence = CAPACITY_SEQUENCE;
           else if (mode === 'bank') currentSequence = BANK_SEQUENCE;

           const currentQuestionItem = currentSequence[currentSubIndex];
           let processedInput: any = currentInput;
           let isValid = true;

           // Validation logic (similar to before, adapt as needed)
           if (currentQuestionItem.type === 'number') {
               const num = parseFloat(processedInput);
               if (isNaN(num) || num < 0) {
                   toast({ title: "Entrada inválida", description: "Por favor, introduce un número válido (0 o mayor).", variant: "destructive" });
                   isValid = false;
               } else {
                   processedInput = num;
                   // Use the key from the answered question
                   dataToUpdate = { [currentQuestionItem.key]: processedInput };
               }
           } else if (currentQuestionItem.type === 'vehicleCapacities') {
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
                       // Store capacities directly into the update object
                       dataToUpdate = {
                           carCapacity: nums[0],
                           motorcycleCapacity: nums[1],
                           vanCapacity: nums[2]
                       };
                       // Keep processedInput as the array for potential logging/Botpress
                       processedInput = nums; 
                   }
               }
           } else if (currentQuestionItem.type === 'string') {
               if (!processedInput) {
                   toast({ title: "Entrada inválida", description: "Este campo no puede estar vacío.", variant: "destructive" });
                   isValid = false;
               } else {
                   dataToUpdate = { [currentQuestionItem.key]: processedInput };
               }
           }

           if (isValid) {
               setConfigData(prev => ({ ...prev, ...dataToUpdate })); // Update collected data
               newSubIndex = currentSubIndex + 1; // Prepare for next question

               if (newSubIndex < currentSequence.length) {
                   // Ask next question in the current sequence
                   const nextQuestionItem = currentSequence[newSubIndex];
                   nextBotMessage = {
                       id: 'q-' + mode + '-' + newSubIndex,
                       content: nextQuestionItem.question,
                       isUser: false,
                       timestamp: new Date()
                   };
               } else {
                   // Finished sequence for this mode, trigger save
                   shouldSave = true; 
                   // We'll call saveConfiguration after setting state
                   // No immediate next bot message, saveConfiguration will add one
               }
           }
       }
       
       // Update state based on logic above
       if (nextBotMessage) {
           setMessages(prev => [...prev, nextBotMessage!]);
       }
       setMode(newMode);
       setCurrentSubIndex(newSubIndex);
       
       if (shouldSave) {
            // Gather only the data relevant to the completed mode before saving
            let relevantData: Partial<ParkingConfigData> = {};
            const finalConfigData = { ...configData, ...dataToUpdate }; // Ensure last piece is included
            if (mode === 'rates') {
                relevantData = { carRate: finalConfigData.carRate, motorcycleRate: finalConfigData.motorcycleRate, vanRate: finalConfigData.vanRate };
            } else if (mode === 'capacity') {
                 relevantData = { carCapacity: finalConfigData.carCapacity, motorcycleCapacity: finalConfigData.motorcycleCapacity, vanCapacity: finalConfigData.vanCapacity };
            } else if (mode === 'bank') {
                 relevantData = { bankAccountHolder: finalConfigData.bankAccountHolder, bankAccountCbu: finalConfigData.bankAccountCbu, bankAccountAlias: finalConfigData.bankAccountAlias };
            }
            await saveConfiguration(mode, relevantData);
             setConfigData({}); // Clear collected data after saving a section
       }

       setIsLoading(false);
   };

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