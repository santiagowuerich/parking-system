"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, MapPin, Car, Building, CheckCircle } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-2xl font-bold text-blue-800">Parqueo</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <a href="#como-funciona" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Cómo funciona
              </a>
              <a href="#precios" className="text-gray-600 hover:text-blue-600 transition-colors font-medium">
                Precios
              </a>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium">
                Iniciar sesión
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative">
        <div className="max-w-8xl mx-auto px-6 py-12 lg:py-20">
          <div className="grid lg:grid-cols-[2fr_1.8fr] gap-12 lg:gap-32 items-start lg:items-center">

            {/* Left Column - Main Content */}
            <div className="space-y-8 lg:pr-16 xl:pr-24">
              {/* Subtítulo */}
              <div className="space-y-6">
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
                  Plataforma de Gestión de Estacionamientos
                </p>

                {/* Título Principal */}
                <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Encontrá, reservá y{" "}
                  <span className="text-blue-600">estacioná</span>{" "}
                  en segundos
                </h1>

                {/* Descripción */}
                <p className="text-xl text-gray-600 leading-relaxed max-w-2xl">
                  La forma más simple de conectar conductores con estacionamientos verificados.
                  Sin vueltas, con pagos seguros y disponibilidad en tiempo real.
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white px-4 lg:px-6 py-4 rounded-xl text-base lg:text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex-1 sm:flex-none">
                    <Car className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    <span className="whitespace-nowrap">Registrarme como Conductor</span>
                  </Button>
                  <Button variant="outline" className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 lg:px-6 py-4 rounded-xl text-base lg:text-lg font-semibold transition-all duration-300 flex-1 sm:flex-none">
                    <Building className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />
                    <span className="whitespace-nowrap">Registrarme como Dueño de Negocio</span>
                  </Button>
                </div>

                {/* Indicador de Confianza */}
                <p className="text-gray-500 text-sm text-center mt-4">
                  <CheckCircle className="w-4 h-4 inline mr-2 text-green-500" />
                  Confiado por +120 estacionamientos en Argentina
                </p>
              </div>

              {/* Feature Card */}
              <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 hover:shadow-lg transition-all duration-300 p-6 rounded-2xl mt-12">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">Sin vueltas</h3>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Integración con mapas, notificaciones y soporte humano cuando lo necesitás.
                  </p>
                  <a href="#como-funciona" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center group">
                    Ver cómo funciona
                    <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </Card>
            </div>

            {/* Right Column - Visual Mockup */}
            <div className="relative">
              {/* Map Container */}
              <Card className="bg-white shadow-2xl border-0 overflow-hidden rounded-3xl p-8 relative">
                <div className="space-y-6">
                  {/* Availability Indicator */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      <MapPin className="w-4 h-4 inline mr-2" />
                      Cerca tuyo
                    </p>
                    <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                      3 libres
                    </span>
                  </div>

                  {/* Map Mockup */}
                  <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl h-64 overflow-hidden">
                    {/* Background map pattern */}
                    <div className="absolute inset-0 opacity-30">
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-blue-200" />
                    </div>

                    {/* Street lines */}
                    <div className="absolute inset-0 flex flex-col space-y-4 pt-8 pl-6">
                      <div className="h-1 bg-gray-400 w-full opacity-60 rounded-sm" />
                      <div className="h-1 bg-gray-300 w-4/5 opacity-40 rounded-sm" />
                      <div className="h-1 bg-gray-400 w-full opacity-60 rounded-sm" />
                      <div className="h-1 bg-gray-300 w-3/5 opacity-40 rounded-sm" />
                    </div>

                    {/* Map pins */}
                    <div className="absolute top-8 left-8">
                      <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-md" />
                    </div>
                    <div className="absolute top-16 right-12">
                      <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-md" />
                    </div>
                    <div className="absolute bottom-12 left-12">
                      <div className="w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-md" />
                    </div>

                    {/* Location label */}
                    <div className="absolute bottom-6 right-6 bg-white px-3 py-1 rounded-lg shadow-md text-xs font-medium text-gray-700">
                      Villa Itatí
                    </div>
                  </div>

                  {/* Phone Mockup */}
                  <div className="relative mx-auto w-80 mb-8">
                    <div className="bg-black rounded-3xl p-2 shadow-2xl">
                      <div className="bg-white rounded-2xl p-4 space-y-4">
                        {/* Status indicators */}
                        <div className="flex space-x-2">
                          <span className="bg-green-100 text-green-800 text-xs font-medium px-3 py-1 rounded-full">
                            Libre
                          </span>
                          <span className="bg-red-100 text-red-800 text-xs font-medium px-3 py-1 rounded-full">
                            Lleno
                          </span>
                        </div>

                        {/* Search input */}
                        <div className="space-y-2">
                          <label className="text-sm text-gray-600">Estacionamiento</label>
                          <Input placeholder="Buscar estacionamiento..." className="rounded-lg border-gray-200" />
                        </div>

                        {/* Reserve button */}
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium">
                          Reservar
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-yellow-400 rounded-full opacity-20 animate-pulse" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-300 rounded-full opacity-10" />
            </div>
          </div>
        </div>

        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-100 rounded-full opacity-20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-50 rounded-full opacity-10 blur-3xl" />
        </div>
      </main>
    </div>
  );
}
