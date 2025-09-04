import { NextRequest, NextResponse } from "next/server";

// POST: Buscar direcciones usando Google Maps Geocoding API
export async function POST(request: NextRequest) {
    try {
        const { address, region = "ar" } = await request.json();

        if (!address) {
            return NextResponse.json(
                { error: "Dirección es requerida" },
                { status: 400 }
            );
        }

        const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!googleApiKey) {
            return NextResponse.json(
                { error: "API key de Google Maps no configurada" },
                { status: 500 }
            );
        }

        // Buscar direcciones usando Geocoding API
        const geocodingUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        geocodingUrl.searchParams.set('address', address);
        geocodingUrl.searchParams.set('region', region); // Bias hacia Argentina
        geocodingUrl.searchParams.set('key', googleApiKey);

        console.log(`🔍 Buscando dirección: "${address}" en región ${region}`);

        const response = await fetch(geocodingUrl.toString());
        const data = await response.json();

        if (data.status !== 'OK') {
            console.error("❌ Error en Geocoding API:", data.status);
            return NextResponse.json({
                error: `Error en búsqueda: ${data.status}`,
                results: []
            }, { status: 400 });
        }

        // Procesar y filtrar resultados
        const processedResults = data.results.map((result: any) => {
            // Extraer componentes de la dirección
            const components = result.address_components;

            const getComponent = (types: string[]) => {
                const component = components.find((comp: any) =>
                    types.some((type: string) => comp.types.includes(type))
                );
                return component?.long_name || '';
            };

            return {
                formatted_address: result.formatted_address,
                place_id: result.place_id,
                latitud: result.geometry.location.lat,
                longitud: result.geometry.location.lng,
                components: {
                    street_number: getComponent(['street_number']),
                    street_name: getComponent(['route']),
                    locality: getComponent(['locality', 'sublocality']),
                    city: getComponent(['administrative_area_level_2']),
                    state: getComponent(['administrative_area_level_1']),
                    postal_code: getComponent(['postal_code']),
                    country: getComponent(['country'])
                },
                types: result.types
            };
        });

        // Filtrar solo resultados de Argentina
        const argentineResults = processedResults.filter((result: any) =>
            result.components.country.toLowerCase().includes('argentina') ||
            result.components.state.toLowerCase().includes('buenos aires') ||
            result.components.state.toLowerCase().includes('córdoba') ||
            result.components.state.toLowerCase().includes('santa fe')
        );

        console.log(`✅ Encontradas ${argentineResults.length} direcciones en Argentina`);

        return NextResponse.json({
            success: true,
            results: argentineResults.slice(0, 10), // Limitar a 10 resultados
            total: argentineResults.length
        });

    } catch (error) {
        console.error("❌ Error en búsqueda de direcciones:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}

// GET: Geocodificar coordenadas a dirección (reverse geocoding)
export async function GET(request: NextRequest) {
    try {
        const url = new URL(request.url);
        const lat = url.searchParams.get('lat');
        const lng = url.searchParams.get('lng');

        if (!lat || !lng) {
            return NextResponse.json(
                { error: "Latitud y longitud son requeridas" },
                { status: 400 }
            );
        }

        const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;

        if (!googleApiKey) {
            return NextResponse.json(
                { error: "API key de Google Maps no configurada" },
                { status: 500 }
            );
        }

        // Reverse geocoding
        const reverseUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
        reverseUrl.searchParams.set('latlng', `${lat},${lng}`);
        reverseUrl.searchParams.set('region', 'ar');
        reverseUrl.searchParams.set('key', googleApiKey);

        const response = await fetch(reverseUrl.toString());
        const data = await response.json();

        if (data.status !== 'OK') {
            return NextResponse.json({
                error: `Error en reverse geocoding: ${data.status}`,
                address: null
            }, { status: 400 });
        }

        const result = data.results[0];
        if (!result) {
            return NextResponse.json({
                error: "No se encontró dirección para estas coordenadas",
                address: null
            }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            address: {
                formatted_address: result.formatted_address,
                place_id: result.place_id,
                components: result.address_components
            }
        });

    } catch (error) {
        console.error("❌ Error en reverse geocoding:", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
