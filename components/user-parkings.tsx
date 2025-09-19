"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Building2, MapPin, Clock, Users, Settings, Plus } from "lucide-react";
import ParkingConfig from "./parking-config";
import AddressAutocomplete from "./address-autocomplete";
import { useAuth } from "@/lib/auth-context";

interface Estacionamiento {
  est_id: number;
  est_nombre: string;
  est_prov: string;
  est_locali: string;
  est_direc: string;
  est_horario_funcionamiento: number;
  est_tolerancia_min: number;
  plazas_totales_reales: number;
  plazas_disponibles_reales: number;
  plazas_ocupadas: number;
}

interface UserParkingsProps {
  onSelectParking?: (estId: number) => void;
  currentEstId?: number;
}

export default function UserParkings({ onSelectParking, currentEstId }: UserParkingsProps) {
  // Estado centralizado del AuthContext
  const {
    user: authUser,
    parkings: estacionamientos,
    parkingsLoading: loading,
    parkingsError: error,
    fetchParkings,
  } = useAuth();

  const [activeTab, setActiveTab] = useState("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newParkingName, setNewParkingName] = useState("");
  const [newParkingAddress, setNewParkingAddress] = useState("");
  const [addressConfirmed, setAddressConfirmed] = useState<boolean>(false);

  // Campos detallados de dirección del autocompletado
  const [newParkingProvince, setNewParkingProvince] = useState<string>("Por configurar");
  const [newParkingLocality, setNewParkingLocality] = useState<string>("Por configurar");
  const [newParkingPostalCode, setNewParkingPostalCode] = useState<string>("");
  const [newParkingLat, setNewParkingLat] = useState<number | null>(null);
  const [newParkingLng, setNewParkingLng] = useState<number | null>(null);
  const [newParkingFullAddress, setNewParkingFullAddress] = useState<string>("");

  const MAX_PARKINGS_PER_USER = 5;

  // Evitar bucle de recarga: solo pedimos una vez al montar
  const [requestedOnce, setRequestedOnce] = useState(false);
  useEffect(() => {
    if (requestedOnce) return;
    setRequestedOnce(true);
    fetchParkings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewParking = async () => {
    if (!newParkingName.trim()) return alert("El nombre del estacionamiento es requerido");
    if (!newParkingAddress.trim()) return alert("La dirección del estacionamiento es requerida y debe ser única");
    if (newParkingName.trim().length < 2) return alert("El nombre debe tener al menos 2 caracteres");
    if (newParkingAddress.trim().length < 5) return alert("La dirección debe tener al menos 5 caracteres");

    if (estacionamientos.length >= MAX_PARKINGS_PER_USER) {
      return alert(`Has alcanzado el límite máximo de estacionamientos (${MAX_PARKINGS_PER_USER})`);
    }

    const existingParking = estacionamientos.find(
      est => est.est_nombre.toLowerCase() === newParkingName.trim().toLowerCase()
    );
    if (existingParking) {
      return alert(`Ya tienes un estacionamiento con el nombre "${newParkingName.trim()}"`);
    }

    setCreating(true);

    try {
      // Si no confirmó desde la lista, intentamos geocodificar
      if (!addressConfirmed) {
        try {
          const resp = await fetch("/api/geocoding/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: newParkingAddress, region: "ar" }),
          });
          const data = await resp.json();
          if (resp.ok && data.success && Array.isArray(data.results) && data.results.length > 0) {
            const s = data.results[0];
            setNewParkingFullAddress(s.formatted_address);
            setNewParkingLocality(s.components.locality || s.components.city || "Por configurar");
            setNewParkingProvince(s.components.state || "Por configurar");
            setNewParkingPostalCode(s.components.postal_code || "");
            setNewParkingLat(s.latitud ?? null);
            setNewParkingLng(s.longitud ?? null);
          } else {
            setCreating(false);
            return alert("Seleccioná una dirección de la lista para continuar.");
          }
        } catch {
          setCreating(false);
          return alert("No se pudo validar la dirección. Seleccioná una de la lista.");
        }
      }

      // Endpoint principal
      let response = await fetch("/api/auth/create-new-parking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newParkingName.trim(),
          email: authUser?.email,
          direccion: newParkingAddress.trim(),
          est_prov: newParkingProvince,
          est_locali: newParkingLocality,
          est_codigo_postal: newParkingPostalCode,
          est_latitud: newParkingLat,
          est_longitud: newParkingLng,
          est_direccion_completa: newParkingFullAddress || newParkingAddress.trim(),
        }),
      });

      // Fallback
      if (!response.ok) {
        response = await fetch("/api/auth/create-new-parking-fallback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newParkingName.trim(),
            email: authUser?.email,
            direccion: newParkingAddress.trim(),
            est_prov: newParkingProvince,
            est_locali: newParkingLocality,
            est_codigo_postal: newParkingPostalCode,
            est_latitud: newParkingLat,
            est_longitud: newParkingLng,
            est_direccion_completa: newParkingFullAddress || newParkingAddress.trim(),
          }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        await fetchParkings();

        // Limpiar formulario
        setNewParkingName("");
        setNewParkingAddress("");
        setNewParkingProvince("Por configurar");
        setNewParkingLocality("Por configurar");
        setNewParkingPostalCode("");
        setNewParkingLat(null);
        setNewParkingLng(null);
        setNewParkingFullAddress("");
        setAddressConfirmed(false);
        setShowCreateForm(false);

        // Seleccionar el nuevo estacionamiento si el caller lo desea
        if (data.estacionamiento_id && onSelectParking) {
          onSelectParking(data.estacionamiento_id);
        }
      } else {
        const err = await response.json();
        alert(err?.details ? `${err.error}: ${err.details}` : err?.error || "Error creando estacionamiento");
      }
    } catch (e) {
      console.error(e);
      alert("Error de conexión - intenta nuevamente");
    } finally {
      setCreating(false);
    }
  };

  // Loading / Error
  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Cargando estacionamientos...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-red-200 bg-red-50">
        <CardContent className="p-6">
          <p className="text-center text-red-600">{error}</p>
          <div className="mt-4 text-center">
            <Button onClick={() => fetchParkings()} variant="outline">
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 👇 Eliminado el bloque de “Información del Usuario” como pediste */}

      {/* Tabs navegación superior (se mantiene igual) */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
        <Button
          variant={activeTab === "list" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("list")}
          className="flex-1"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Mis Estacionamientos
        </Button>
        <Button
          variant={activeTab === "config" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("config")}
          className="flex-1"
        >
          <Settings className="h-4 w-4 mr-2" />
          Configuración
        </Button>
      </div>

      {/* Contenido pestañas */}
      {activeTab === "list" && (
        <Card className="bg-white/50 border-gray-200">
          {/* 🔧 Header: título + contador a la izquierda, botón a la derecha */}
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <span>Lista de Estacionamientos</span>
                <span className="text-green-600 font-medium">
                  ({estacionamientos.length}/{MAX_PARKINGS_PER_USER})
                </span>
              </CardTitle>
              <Button
                onClick={() => setShowCreateForm(!showCreateForm)}
                variant="outline"
                size="sm"
                className="bg-gray-50 border-gray-200 hover:bg-gray-100"
                disabled={estacionamientos.length >= MAX_PARKINGS_PER_USER}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Estacionamiento
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {/* Formulario de creación */}
            {showCreateForm && estacionamientos.length < MAX_PARKINGS_PER_USER && (
              <Card className="bg-gray-50 border-gray-200 mb-6">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Plus className="h-5 w-5 text-gray-500" />
                        <h3 className="text-lg font-medium text-gray-700">Crear Nuevo Estacionamiento</h3>
                      </div>
                      <div className="text-sm text-gray-500">
                        <span>
                          Estacionamientos: {estacionamientos.length}/{MAX_PARKINGS_PER_USER}
                        </span>
                        <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(estacionamientos.length / MAX_PARKINGS_PER_USER) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="parking-name" className="text-gray-600">
                          Nombre del Estacionamiento *
                        </Label>
                        <Input
                          id="parking-name"
                          type="text"
                          placeholder="Ej: Estacionamiento Centro"
                          value={newParkingName}
                          onChange={(e) => setNewParkingName(e.target.value)}
                          className="bg-gray-100 border-gray-200 text-gray-900 mt-1"
                          disabled={creating}
                        />
                      </div>

                      <AddressAutocomplete
                        value={newParkingAddress}
                        onChange={(value) => {
                          setNewParkingAddress(value);
                          setAddressConfirmed(false);
                        }}
                        onSelect={(place) => {
                          const components = place.address_components || [];
                          const getComp = (types: string[]) => {
                            const c = components.find((comp: any) =>
                              types.some((t: string) => comp.types.includes(t))
                            );
                            return c?.long_name || "";
                          };
                          const state = getComp(["administrative_area_level_1"]);
                          const locality = getComp(["locality", "sublocality"]);
                          const formatted = place.formatted_address || "";
                          setNewParkingFullAddress(formatted);
                          setNewParkingLocality(locality || "Por configurar");
                          setNewParkingProvince(state || "Por configurar");
                          const latVal =
                            typeof place?.geometry?.location?.lat === "function"
                              ? (place.geometry.location.lat() as number)
                              : null;
                          const lngVal =
                            typeof place?.geometry?.location?.lng === "function"
                              ? (place.geometry.location.lng() as number)
                              : null;
                          setNewParkingLat(latVal);
                          setNewParkingLng(lngVal);
                          setAddressConfirmed(true);
                        }}
                        placeholder="Ej: Av. Libertador 1234, Buenos Aires"
                        disabled={creating}
                      />
                      <p className="text-xs text-gray-500 mt-1">⚠️ La dirección debe ser única en todo el sistema</p>

                      <div className="flex gap-2">
                        <Button
                          onClick={createNewParking}
                          disabled={creating}
                          className="flex-1"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creando...
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 mr-2" />
                              Crear Estacionamiento
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewParkingName("");
                            setNewParkingAddress("");
                          }}
                          variant="outline"
                          disabled={creating}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Lista / Estado vacío */}
            {estacionamientos.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="h-16 w-16 mx-auto text-gray-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  No tienes estacionamientos configurados
                </h3>
                <p className="text-gray-500 mb-4">
                  Crea tu primer estacionamiento usando el botón "Nuevo Estacionamiento".
                </p>
                <Button onClick={() => fetchParkings()} variant="outline">
                  Actualizar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {estacionamientos.map((estacionamiento) => (
                  <Card
                    key={estacionamiento.est_id}
                    className={`bg-gray-50 border-gray-200 cursor-pointer transition-colors ${
                      currentEstId === estacionamiento.est_id ? "ring-2 ring-blue-500 bg-gray-100" : "hover:bg-gray-100"
                    }`}
                    onClick={() => onSelectParking?.(estacionamiento.est_id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900 text-lg">
                          {estacionamiento.est_nombre}
                        </CardTitle>
                        <Badge variant={currentEstId === estacionamiento.est_id ? "default" : "secondary"}>
                          ID: {estacionamiento.est_id}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2 text-gray-600 mb-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{estacionamiento.est_direc}</span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span>
                            {estacionamiento.est_prov}, {estacionamiento.est_locali}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-green-600">
                            {estacionamiento.plazas_totales_reales ?? 0} plazas totales
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="font-semibold text-blue-600">
                            {estacionamiento.plazas_disponibles_reales ?? 0} disponibles
                          </span>
                          {(estacionamiento.plazas_ocupadas ?? 0) > 0 && (
                            <span className="text-amber-600 text-xs">
                              ({estacionamiento.plazas_ocupadas} ocupadas)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>{estacionamiento.est_horario_funcionamiento || 24}h funcionamiento</span>
                        </div>
                      </div>
                      <div className="mt-3 text-gray-500 text-xs">
                        <p>Tolerancia: {estacionamiento.est_tolerancia_min || 0} minutos</p>
                        <div className="flex items-center gap-1 mt-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-green-600">Datos calculados en tiempo real</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "config" && <ParkingConfig />}
    </div>
  );
}
