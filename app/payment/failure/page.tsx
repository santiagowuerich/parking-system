import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-red-600">Error en el Pago</h1>
        <p className="text-xl text-muted-foreground">
          Hubo un problema al procesar tu pago. Por favor, intenta nuevamente.
        </p>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
} 