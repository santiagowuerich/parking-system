/**
 * Helper para cargar Google Maps API de forma segura y eficiente
 * Resuelve el problema de callbacks globales y carga duplicada
 */

interface LoaderOptions {
    apiKey: string;
    libraries?: string[];
    version?: string;
}

class GoogleMapsLoader {
    private static instance: GoogleMapsLoader;
    private loadPromise: Promise<void> | null = null;
    private isLoaded = false;

    private constructor() {}

    static getInstance(): GoogleMapsLoader {
        if (!GoogleMapsLoader.instance) {
            GoogleMapsLoader.instance = new GoogleMapsLoader();
        }
        return GoogleMapsLoader.instance;
    }

    /**
     * Carga Google Maps API si no está ya cargado
     */
    async load(options: LoaderOptions): Promise<void> {
        // Si ya está cargado, retornar inmediatamente
        if (this.isLoaded && window.google?.maps?.Map) {
            console.log('✅ Google Maps ya está cargado');
            return Promise.resolve();
        }

        // Si ya hay una carga en proceso, retornar la misma promesa
        if (this.loadPromise) {
            console.log('⏳ Esperando carga de Google Maps en proceso...');
            return this.loadPromise;
        }

        // Crear nueva promesa de carga
        this.loadPromise = new Promise<void>((resolve, reject) => {
            // Verificar si el script ya existe
            const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
            if (existingScript) {
                // Si existe pero no está cargado, esperar
                if (window.google?.maps?.Map) {
                    this.isLoaded = true;
                    resolve();
                    return;
                }

                // Esperar a que se cargue
                const checkLoaded = setInterval(() => {
                    if (window.google?.maps?.Map) {
                        clearInterval(checkLoaded);
                        this.isLoaded = true;
                        resolve();
                    }
                }, 100);

                // Timeout después de 10 segundos
                setTimeout(() => {
                    clearInterval(checkLoaded);
                    reject(new Error('Timeout esperando carga de Google Maps'));
                }, 10000);
                return;
            }

            // Crear callback único
            const callbackName = `initGoogleMaps_${Date.now()}`;

            (window as any)[callbackName] = () => {
                console.log('✅ Google Maps API cargada exitosamente');
                this.isLoaded = true;
                delete (window as any)[callbackName];
                resolve();
            };

            // Construir URL
            const { apiKey, libraries = ['places'], version = 'weekly' } = options;
            const params = new URLSearchParams({
                key: apiKey,
                libraries: libraries.join(','),
                v: version,
                callback: callbackName,
            });

            // Crear y agregar script
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
            script.async = true;
            script.defer = true;

            script.onerror = () => {
                delete (window as any)[callbackName];
                this.loadPromise = null;
                reject(new Error('Error cargando Google Maps API'));
            };

            console.log('📡 Cargando Google Maps API...');
            document.head.appendChild(script);
        });

        return this.loadPromise;
    }

    /**
     * Verifica si Google Maps está cargado
     */
    isGoogleMapsLoaded(): boolean {
        return this.isLoaded && !!window.google?.maps?.Map;
    }

    /**
     * Resetea el estado del loader (útil para testing)
     */
    reset(): void {
        this.loadPromise = null;
        this.isLoaded = false;
    }
}

export const googleMapsLoader = GoogleMapsLoader.getInstance();
