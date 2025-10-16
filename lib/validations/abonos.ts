import { TipoAbono, CONFIGURACIONES_ABONOS } from "@/lib/types";

/**
 * Clase con validaciones para el sistema de abonos
 */
export class ValidacionAbonos {
    /**
     * Valida formato de email
     */
    static validarEmail(email: string): boolean {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Valida formato de DNI argentino (8 dígitos)
     */
    static validarDNI(dni: string): boolean {
        return /^\d{8}$/.test(dni);
    }

    /**
     * Valida formato de patente argentina
     * Acepta tanto patentes viejas (ABC123) como nuevas (AB123CD)
     */
    static validarPatente(patente: string): boolean {
        // Acepta cualquier formato de patente (sin validación de formato)
        return patente.trim().length > 0;
    }

    /**
     * Valida formato de teléfono argentino (10 dígitos)
     */
    static validarTelefono(telefono: string): boolean {
        // Teléfono argentino: 10 dígitos (con código de área)
        return /^\d{10}$/.test(telefono.replace(/\s/g, ''));
    }

    /**
     * Calcula fecha de finalización basada en tipo de abono
     */
    static calcularFechaFin(fechaInicio: string, tipoAbono: TipoAbono): string {
        const inicio = new Date(fechaInicio);
        const config = CONFIGURACIONES_ABONOS[tipoAbono];
        const fin = new Date(inicio);
        fin.setMonth(fin.getMonth() + config.duracionMeses);
        return fin.toISOString().split('T')[0];
    }

    /**
     * Valida que las fechas de abono sean coherentes
     */
    static validarFechasAbono(fechaInicio: string, fechaFin: string): boolean {
        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        const hoy = new Date();

        // Fecha de inicio no puede ser anterior a hoy (excluir tiempo)
        const inicioDate = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
        const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

        if (inicioDate < hoyDate) return false;

        // Fecha de fin debe ser posterior a fecha de inicio
        if (fin <= inicio) return false;

        return true;
    }

    /**
     * Valida que un nombre sea válido
     */
    static validarNombre(nombre: string): boolean {
        // Mínimo 2 caracteres, solo letras y espacios
        return /^[a-záéíóúàèìòùäëïöüñ\s]{2,}$/i.test(nombre.trim());
    }

    /**
     * Normaliza un nombre removiendo espacios extras
     */
    static normalizarNombre(nombre: string): string {
        return nombre.trim().replace(/\s+/g, ' ');
    }

    /**
     * Normaliza una patente a mayúsculas
     */
    static normalizarPatente(patente: string): string {
        return patente.trim().toUpperCase();
    }

    /**
     * Normaliza email a minúsculas
     */
    static normalizarEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    /**
     * Normaliza DNI removiendo espacios y guiones
     */
    static normalizarDNI(dni: string): string {
        return dni.replace(/[\s\-\.]/g, '');
    }

    /**
     * Normaliza teléfono removiendo espacios, guiones y símbolos
     */
    static normalizarTelefono(telefono: string): string {
        return telefono.replace(/[\s\-\(\)\.]/g, '');
    }
}
