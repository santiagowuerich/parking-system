import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-yellow-600">Pago Pendiente</h1>
        <p className="text-xl text-muted-foreground">
          Tu pago está siendo procesado. Te notificaremos cuando se complete.
        </p>
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
} 