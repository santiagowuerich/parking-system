"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { VehicleType } from "@/lib/types";

interface RatesPanelProps {
  rates: Record<VehicleType, number>;
  onUpdateRate: (type: VehicleType, rate: number) => void;
}

export default function RatesPanel({ rates, onUpdateRate }: RatesPanelProps) {
  const [open, setOpen] = useState(false);
  const [localRates, setLocalRates] = useState({ ...rates });

  const handleChange = (type: VehicleType, value: string) => {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      setLocalRates((prev) => ({ ...prev, [type]: parsed }));
    }
  };

  const handleSave = () => {
    Object.entries(localRates).forEach(([type, rate]) => {
      onUpdateRate(type as VehicleType, rate);
    });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestión de Tarifas</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="mb-4">Modificar tarifas</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar tarifas por tipo de vehículo</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {Object.entries(localRates).map(([type, rate]) => (
                <div key={type} className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={type} className="capitalize">
                    {type}:
                  </Label>
                  <Input
                    id={type}
                    type="number"
                    min="0"
                    step="0.01"
                    value={rate}
                    onChange={(e) => handleChange(type as VehicleType, e.target.value)}
                    className="col-span-3"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave}>Guardar cambios</Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
