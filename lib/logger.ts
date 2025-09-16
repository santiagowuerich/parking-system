/**
 * Logger minimalista con niveles controlados por variable de entorno
 * Niveles: error (0), warn (1), info (2), debug (3)
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

function getCurrentLogLevel(): number {
    if (typeof window === 'undefined') {
        // Server-side
        const level = process.env.LOG_LEVEL || 'info';
        return LOG_LEVELS[level as LogLevel] ?? LOG_LEVELS.info;
    } else {
        // Client-side
        const level = process.env.NEXT_PUBLIC_LOG_LEVEL || 'warn';
        return LOG_LEVELS[level as LogLevel] ?? LOG_LEVELS.warn;
    }
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= getCurrentLogLevel();
}

function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()}:`;
    return args.length > 0 ? `${prefix} ${message} ${JSON.stringify(args)}` : `${prefix} ${message}`;
}

export const logger = {
    error: (message: string, ...args: any[]) => {
        if (shouldLog('error')) {
            console.error(formatMessage('error', message, ...args));
        }
    },

    warn: (message: string, ...args: any[]) => {
        if (shouldLog('warn')) {
            console.warn(formatMessage('warn', message, ...args));
        }
    },

    info: (message: string, ...args: any[]) => {
        if (shouldLog('info')) {
            console.info(formatMessage('info', message, ...args));
        }
    },

    debug: (message: string, ...args: any[]) => {
        if (shouldLog('debug')) {
            console.debug(formatMessage('debug', message, ...args));
        }
    },
};

// Alias para compatibilidad
export const log = logger;

// Función para medir tiempos de ejecución
export function createTimer(label: string) {
    const start = performance.now();
    return {
        end: () => {
            const end = performance.now();
            const duration = end - start;
            logger.debug(`${label} tomó ${duration.toFixed(2)}ms`);
            return duration;
        }
    };
}
