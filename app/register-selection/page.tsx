"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Car, Building, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function RegisterSelectionPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
            {/* Simple Header */}
            <header className="bg-white border-b border-gray-100">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <Link href="/" className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-lg">P</span>
                        </div>
                        <span className="text-xl font-bold text-blue-800">Parqueo</span>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
                            ¿Cómo quieres usar Parqueo?
                        </h1>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Selecciona la opción que mejor describa cómo planeas usar nuestra plataforma de estacionamiento.
                        </p>
                    </div>

                    {/* Registration Options */}
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

                        {/* Conductor Option */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-blue-200 bg-gradient-to-br from-blue-50 to-white p-8 text-center cursor-pointer">
                            <div className="space-y-6">
                                {/* Icon */}
                                <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto group-hover:bg-blue-700 transition-colors duration-300">
                                    <Car className="w-10 h-10 text-white" />
                                </div>

                                {/* Content */}
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-gray-900">Conductor</h3>
                                    (<p className="text-gray-600 leading-relaxed">
                                        Sé parte de nuestra comunidad de conductores. Encuentra estacionamientos disponibles rápidamente,
                                        reserva tu lugar y paga de forma segura.
                                    </p>

                                    {/* Features */}
                                    <ul className="text-left space-y-2 text-gray-600">
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                            <span>Busca estacionamientos cerca de ti</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                            <span>Reserva lugares en tiempo real</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                            <span>Pagos seguros e integrados</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                                            <span>Navegación directa al lugar</span>
                                        </li>
                                    </ul>

                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group">
                                        Registrarme como Conductor
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </div>
                        </Card>

                        {/* Dueño de Negocio Option */}
                        <Card className="group hover:shadow-2xl transition-all duration-300 border-2 hover:border-purple-200 bg-gradient-to-br from-purple-50 to-white p-8 text-center cursor-pointer">
                            <div className="space-y-6">
                                {/* Icon */}
                                <div className="w-20 h-20 bg-purple-600 rounded-3xl flex items-center justify-center mx-auto group-hover:bg-purple-700 transition-colors duration-300">
                                    <Building className="w-10 h-10 text-white" />
                                </div>

                                {/* Content */}
                                <div className="space-y-4">
                                    <h3 className="text-2xl font-bold text-gray-900">Dueño de Negocio</h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        Administra tu estacionamiento de manera eficiente. Gestiona espacios, tarifas,
                                        reportes y optimiza tus ingresos con nuestra plataforma.
                                    </p>

                                    {/* Features */}
                                    <ul className="text-left space-y-2 text-gray-600">
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-purple-600 rounded-full" />
                                            <span>Gestión completa de espacios</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-purple-600 rounded-full" />
                                            <span>Tarifas personalizables</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-purple-600 rounded-full" />
                                            <span>Reportes y análisis detallados</span>
                                        </li>
                                        <li className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-purple-600 rounded-full" />
                                            <span>Soporte técnico dedicado</span>
                                        </li>
                                    </ul>

                                    <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 group">
                                        Registrarme como Dueño
                                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Back to Home */}
                    <div className="text-center mt-12">
                        <Link
                            href="/"
                            className="inline-flex items-center text-gray-600 hover:text-blue-600 transition-colors duration-300 group"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                            Volver al inicio
                        </Link>
                    </div>

                    {/* Help Section */}
                    <div className="mt-16 text-center">
                        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-2xl mx-auto">
                            <h4 className="text-lg font-semibold text-gray-900 mb-4">
                                ¿No estás seguro?
                            </h4>
                            <p className="text-gray-600 mb-6">
                                Puedes cambiar tu tipo de cuenta más adelante. También puedes usarla de ambas formas
                                si tienes un vehículo y posees espacios de estacionamiento.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button variant="outline" className="text-gray-600 border-gray-300 hover:bg-gray-50">
                                    Ver cómo funciona
                                </Button>
                                <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
                                    Contactar soporte
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-100 py-8">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-gray-400 text-sm">
                        © 2024 Parqueo. Todos los derechos reservados.
                    </p>
                </div>
            </footer>
        </div>
    );
}
