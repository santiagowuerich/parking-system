"use client"

import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { useEffect, useState } from "react"

export function Toaster() {
  const { toasts } = useToast()
  const [isMounted, setIsMounted] = useState(false)
  
  // Evitar renderizado durante SSR
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // No renderizar nada hasta que el componente esté montado en el cliente
  if (!isMounted) {
    return null
  }

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

