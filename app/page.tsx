"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowRight, MapPin, Car, Building, CheckCircle } from "lucide-react";
import Link from "next/link";

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
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2">
                <Link href="/auth/login">
                  Iniciar sesión
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-10">
          <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-12 items-center">

            {/* Left Column - Main Content */}
            <div className="space-y-6 lg:pr-8">
              {/* Subtítulo */}
              <div className="space-y-4">
                <p className="text-xs lg:text-sm font-semibold text-blue-600 uppercase tracking-wider">
                  Plataforma de Gestión de Estacionamientos
                </p>

                {/* Título Principal */}
                <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  Encontrá, reservá y{" "}
                  <span className="text-blue-600">estacioná</span>{" "}
                  en segundos
                </h1>

                {/* Descripción */}
                <p className="text-base lg:text-lg text-gray-600 leading-relaxed">
                  La forma más simple de conectar conductores con estacionamientos verificados.
                  Sin vueltas, con pagos seguros y disponibilidad en tiempo real.
                </p>
              </div>

              {/* Botones de Acción */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white px-4 lg:px-5 py-3 rounded-xl text-sm lg:text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex-1 sm:flex-none">
                    <Link href="/auth/register-conductor">
                      <Car className="w-4 h-4 mr-2" />
                      <span className="whitespace-nowrap">Registrarme como Conductor</span>
                    </Link>
                  </Button>
                  <Button variant="outline" asChild className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white px-4 lg:px-5 py-3 rounded-xl text-sm lg:text-base font-semibold transition-all duration-300 flex-1 sm:flex-none">
                    <Link href="/auth/register">
                      <Building className="w-4 h-4 mr-2" />
                      <span className="whitespace-nowrap">Registrarme como Dueño de Negocio</span>
                    </Link>
                  </Button>
                </div>

                {/* Indicador de Confianza */}
                <p className="text-gray-500 text-xs lg:text-sm text-center">
                  <CheckCircle className="w-3 h-3 lg:w-4 lg:h-4 inline mr-2 text-green-500" />
                  Confiado por +120 estacionamientos en Argentina
                </p>
              </div>

              {/* Feature Card */}
              <Card className="bg-white/90 backdrop-blur-sm border border-gray-200 hover:shadow-lg transition-all duration-300 p-4 lg:p-5 rounded-2xl">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                      <ArrowRight className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Sin vueltas</h3>
                  </div>
                  <p className="text-sm lg:text-base text-gray-600 leading-relaxed">
                    Integración con mapas, notificaciones y soporte humano cuando lo necesitás.
                  </p>
                  <a href="#como-funciona" className="text-blue-600 hover:text-blue-700 font-medium text-xs lg:text-sm flex items-center group">
                    Ver cómo funciona
                    <ArrowRight className="w-3 h-3 lg:w-4 lg:h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </Card>
            </div>

            {/* Right Column - Phone Mockup */}
            <div className="relative flex justify-center items-start lg:justify-end lg:-mt-7">
              {/* iPhone Mockup */}
              <div className="relative scale-[0.85] sm:scale-95 lg:scale-100">
                {/* Phone outer frame */}
                <div className="relative w-[320px] h-[580px] bg-gray-900 rounded-[3rem] shadow-2xl p-3 ring-[6px] ring-gray-900">
                  {/* Power button */}
                  <div className="absolute -right-[3px] top-[120px] w-[3px] h-[60px] bg-gray-800 rounded-l-lg" />

                  {/* Volume buttons */}
                  <div className="absolute -left-[3px] top-[100px] w-[3px] h-[30px] bg-gray-800 rounded-r-lg" />
                  <div className="absolute -left-[3px] top-[140px] w-[3px] h-[30px] bg-gray-800 rounded-r-lg" />
                  <div className="absolute -left-[3px] top-[180px] w-[3px] h-[30px] bg-gray-800 rounded-r-lg" />

                  {/* Screen */}
                  <div className="relative w-full h-full bg-white rounded-[2.6rem] overflow-hidden">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[140px] h-[28px] bg-gray-900 rounded-b-3xl z-50">
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1 bg-gray-800 rounded-full" />
                    </div>

                    {/* Status bar */}
                    <div className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-6 text-[10px] font-semibold text-gray-900 z-40 bg-gradient-to-b from-white to-transparent">
                      <span>9:41</span>
                      <div className="flex items-center space-x-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                        </svg>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 01.808 6.808c5.076-5.077 13.308-5.077 18.384 0a1 1 0 01-1.414 1.414zM14.95 11.05a7 7 0 00-9.9 0 1 1 0 01-1.414-1.414 9 9 0 0112.728 0 1 1 0 01-1.414 1.414zM12.12 13.88a3 3 0 00-4.242 0 1 1 0 01-1.415-1.415 5 5 0 017.072 0 1 1 0 01-1.415 1.415zM9 16a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-4 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="2" y="6" width="18" height="12" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                          <rect x="4" y="8" width="14" height="8" rx="1" fill="currentColor"/>
                          <path d="M20 10v4a2 2 0 002-2v0a2 2 0 00-2-2z" fill="currentColor"/>
                        </svg>
                      </div>
                    </div>

                    {/* App Content */}
                    <div className="h-full pt-12 pb-8 px-4">
                      {/* Header with availability */}
                      <div className="flex items-center justify-between mb-4 px-2">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Cerca tuyo</span>
                        </div>
                        <span className="bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-md">
                          3 libres
                        </span>
                      </div>

                      {/* Map Display */}
                      <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-3xl h-[360px] overflow-hidden shadow-lg">
                        {/* Background map pattern */}
                        <div className="absolute inset-0">
                          <div className="w-full h-full bg-gradient-to-br from-blue-100 via-blue-50 to-blue-200 opacity-60" />
                        </div>

                        {/* Street grid */}
                        <div className="absolute inset-0">
                          <div className="absolute top-[80px] left-0 w-full h-[2px] bg-gray-400/40" />
                          <div className="absolute top-[160px] left-0 w-full h-[2px] bg-gray-400/40" />
                          <div className="absolute top-[240px] left-0 w-full h-[2px] bg-gray-400/40" />
                          <div className="absolute top-[320px] left-0 w-full h-[2px] bg-gray-400/40" />
                          <div className="absolute left-[60px] top-0 h-full w-[2px] bg-gray-400/30" />
                          <div className="absolute left-[140px] top-0 h-full w-[2px] bg-gray-400/30" />
                          <div className="absolute left-[220px] top-0 h-full w-[2px] bg-gray-400/30" />
                        </div>

                        {/* Parking location pins */}
                        <div className="absolute top-[100px] left-[70px] flex flex-col items-center">
                          <div className="relative">
                            <div className="w-8 h-8 bg-blue-600 rounded-full border-4 border-white shadow-xl animate-bounce" />
                            <div className="absolute inset-0 w-8 h-8 bg-blue-600 rounded-full animate-ping opacity-75" />
                          </div>
                          <div className="mt-1 bg-white px-2 py-1 rounded-lg shadow-md">
                            <span className="text-[10px] font-bold text-blue-600">$500/h</span>
                          </div>
                        </div>

                        <div className="absolute top-[140px] right-[50px] flex flex-col items-center">
                          <div className="w-7 h-7 bg-green-500 rounded-full border-4 border-white shadow-lg" />
                          <div className="mt-1 bg-white px-2 py-1 rounded-lg shadow-md">
                            <span className="text-[9px] font-bold text-green-600">$450/h</span>
                          </div>
                        </div>

                        <div className="absolute bottom-[80px] left-[100px] flex flex-col items-center">
                          <div className="w-7 h-7 bg-green-500 rounded-full border-4 border-white shadow-lg" />
                          <div className="mt-1 bg-white px-2 py-1 rounded-lg shadow-md">
                            <span className="text-[9px] font-bold text-green-600">$400/h</span>
                          </div>
                        </div>

                        {/* Current location marker */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                          <div className="relative">
                            <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-lg" />
                            <div className="absolute inset-0 w-4 h-4 bg-red-500/30 rounded-full animate-ping" />
                          </div>
                        </div>

                        {/* Navigation button */}
                        <div className="absolute bottom-4 left-4">
                          <button className="bg-white/95 backdrop-blur-sm hover:bg-white px-3 py-2 rounded-xl shadow-lg flex items-center space-x-2 transition-all">
                            <MapPin className="w-3 h-3 text-blue-600" />
                            <span className="text-xs font-bold text-blue-600">Navegar</span>
                          </button>
                        </div>

                        {/* Quick action button */}
                        <div className="absolute bottom-4 right-4">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center space-x-1">
                            <Car className="w-3 h-3" />
                            <span>Reservar</span>
                          </button>
                        </div>
                      </div>

                      {/* Bottom navigation hint */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-gray-300 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating decorative elements */}
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-300 rounded-full opacity-10 blur-xl -z-10" />
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-400 rounded-full opacity-15 blur-xl -z-10" />
            </div>
          </div>
        </div>

        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-1/4 left-1/4 w-48 h-48 bg-blue-100 rounded-full opacity-20 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-50 rounded-full opacity-10 blur-3xl" />
        </div>
      </main>
    </div>
  );
}
