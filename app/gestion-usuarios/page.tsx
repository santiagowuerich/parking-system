"use client";


import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Edit, Trash2, UserPlus, Key, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
    Empleado,
    Disponibilidad,
    Turno,
    obtenerEmpleados,
    obtenerTurnos,
    crearEmpleado,
    actualizarEmpleado,
    eliminarEmpleado,
    validarEmpleado,
    formatearDisponibilidad,
    getNombreDia
} from "@/lib/empleados-utils";

// Días de la semana
const DIAS_SEMANA = [
    { id: 1, nombre: 'Lunes' },
    { id: 2, nombre: 'Martes' },
    { id: 3, nombre: 'Miércoles' },
    { id: 4, nombre: 'Jueves' },
    { id: 5, nombre: 'Viernes' },
    { id: 6, nombre: 'Sábado' },
    { id: 7, nombre: 'Domingo' }
];

export default function GestionUsuariosPage() {
    const { estId, user, userRole } = useAuth();

    // Estados principales
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<Partial<Empleado>>({
        nombre: '',
        apellido: '',
        dni: '',
        email: '',
        estado: 'Activo',
        requiere_cambio_contrasena: false,
        disponibilidad: []
    });

    // Estados de UI
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [estadoFilter, setEstadoFilter] = useState<string>('todos');
    const [contrasenaTemporal, setContrasenaTemporal] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState<{
        title: string;
        description: string;
        details: {
            nombre: string;
            apellido: string;
            email: string;
            dni: string;
            estado: string;
        };
    } | null>(null);

    // Cargar turnos una sola vez
    useEffect(() => {
        loadTurnos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Evitar cargas repetidas: clave por usuario/estId/rol
    const lastLoadKeyRef = useRef<string | null>(null);
    useEffect(() => {
        if (!user || !userRole) return;
        const key = `${user.id || 'no-user'}-${estId ?? 'no-est'}-${userRole}`;
        if (lastLoadKeyRef.current === key) return;
        lastLoadKeyRef.current = key;

        // Cargar empleados basado en el rol del usuario
        if (userRole === 'owner') {
            console.log('👑 Usuario identificado como DUEÑO');
            loadEmpleadosAsDueno();
        } else if (userRole === 'playero') {
            console.log('👷 Usuario identificado como EMPLEADO');
            loadEmpleadosAsEmpleado();
        }
    }, [user, estId, userRole]);

    const loadEmpleadosAsDueno = async () => {
        // iniciar carga de empleados como dueño
        if (!estId) {
            // sin estId
            setLoading(false);
            return;
        }

        setLoading(true);
        // llamada obtenerEmpleados
        const result = await obtenerEmpleados(estId); // Filtrar por el estacionamiento actual
        // resultado obtenerEmpleados

        if (result.success && result.data) {
            // empleados cargados
            setEmpleados(result.data);
        } else {
            // error carga
            toast({
                variant: "destructive",
                title: "Error",
                description: result.error || "Error al cargar empleados"
            });
        }
        setLoading(false);
        // fin carga
    };

    const loadEmpleadosAsEmpleado = async () => {
        console.log('🔄 Iniciando carga de empleados como EMPLEADO');
        setLoading(true);

        try {
            // Hacer consulta directa para obtener la asignación del empleado
            const response = await fetch('/api/empleados');
            const data = await response.json();

            console.log('📊 Respuesta directa del endpoint empleados:', data);

            if (response.ok && data.empleados) {
                console.log('✅ Asignaciones de empleado cargadas exitosamente:', data.empleados.length);
                console.log('👤 Asignaciones:', data.empleados);
                setEmpleados(data.empleados);
            } else {
                console.log('❌ Error en respuesta:', data.error || 'Respuesta no válida');
                // Si no hay empleados, mostrar mensaje vacío
                setEmpleados([]);
            }
        } catch (error) {
            console.log('❌ Error al cargar asignaciones:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al cargar asignaciones"
            });
            setEmpleados([]);
        }

        setLoading(false);
        console.log('🏁 Carga de asignaciones completada');
    };

    const loadTurnos = async () => {
        const result = await obtenerTurnos();

        if (result.success && result.data && Array.isArray(result.data)) {
            setTurnos(result.data);
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: result.error || "Error al cargar turnos"
            });
        }
    };

    // Ya no necesitamos cargar estacionamientos porque solo trabajamos con el actual
    // const loadEstacionamientos = async () => { ... }

    // Funciones de manejo
    const handleSelectUser = (empleado: Empleado) => {
        setUsuarioSeleccionado({
            usu_id: empleado.usu_id,
            nombre: empleado.nombre,
            apellido: empleado.apellido,
            dni: empleado.dni,
            email: empleado.email,
            estado: empleado.estado,
            requiere_cambio_contrasena: empleado.requiere_cambio_contrasena,
            disponibilidad: empleado.disponibilidad
        });
        setContrasenaTemporal('');
        setModalOpen(true);
    };

    const handleNewUser = () => {
        setUsuarioSeleccionado({
            nombre: '',
            apellido: '',
            dni: '',
            email: '',
            estado: 'Activo',
            requiere_cambio_contrasena: false,
            disponibilidad: []
        });
        setContrasenaTemporal('');
        setModalOpen(true);
    };

    const handleSaveUser = async () => {
        // Los empleados no pueden crear ni editar empleados
        if (userRole === 'playero') {
            toast({
                variant: "destructive",
                title: "Acceso denegado",
                description: "Los empleados no pueden gestionar otros empleados"
            });
            return;
        }

        // Validar que tengamos el estId del contexto para dueños
        if (userRole === 'owner' && !estId) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo determinar el estacionamiento actual"
            });
            return;
        }

        // Validaciones
        const errores = validarEmpleado(usuarioSeleccionado);

        if (errores.length > 0) {
            toast({
                variant: "destructive",
                title: "Datos inválidos",
                description: errores.join(', ')
            });
            return;
        }

        // Validar contraseña si es nuevo usuario
        if (!usuarioSeleccionado.usu_id && !contrasenaTemporal) {
            toast({
                variant: "destructive",
                title: "Contraseña requerida",
                description: "Debe generar una contraseña temporal para el nuevo usuario"
            });
            return;
        }

        setSaving(true);

        const empleadoData = {
            nombre: usuarioSeleccionado.nombre || '',
            apellido: usuarioSeleccionado.apellido || '',
            dni: usuarioSeleccionado.dni || '',
            email: usuarioSeleccionado.email || '',
            estado: usuarioSeleccionado.estado || 'Activo',
            contrasena: contrasenaTemporal,
            est_id: estId!, // Solo disponible para dueños, por lo tanto nunca null
            disponibilidad: usuarioSeleccionado.disponibilidad || []
        };

        console.log('📤 Datos que se van a enviar al backend:', JSON.stringify(empleadoData, null, 2));
        console.log('🔍 Estado del contexto:', { userRole, estId, contrasenaTemporal, usuarioSeleccionado });

        let result;
        if (usuarioSeleccionado.usu_id) {
            // Actualizar
            result = await actualizarEmpleado(empleadoData);
        } else {
            // Crear
            result = await crearEmpleado(empleadoData);
        }

        if (result.success) {
            console.log('🎉 Empleado guardado exitosamente, recargando lista...');

            // Mostrar modal de confirmación
            setConfirmationModalOpen(true);
            setConfirmationMessage({
                title: "¡Empleado creado exitosamente!",
                description: `El empleado ${usuarioSeleccionado.nombre} ${usuarioSeleccionado.apellido} ha sido creado correctamente.`,
                details: {
                    nombre: usuarioSeleccionado.nombre || '',
                    apellido: usuarioSeleccionado.apellido || '',
                    email: usuarioSeleccionado.email || '',
                    dni: usuarioSeleccionado.dni || '',
                    estado: usuarioSeleccionado.estado || 'Activo'
                }
            });

            // Cerrar modal, limpiar formulario y recargar lista
            setModalOpen(false);
            handleNewUser();
            console.log('🔄 Llamando a loadEmpleados después de crear empleado...');
            if (userRole === 'owner') {
                await loadEmpleadosAsDueno();
            } else if (userRole === 'playero') {
                await loadEmpleadosAsEmpleado();
            }
            console.log('✅ Lista recargada después de crear empleado');
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: result.error || "Error al guardar empleado"
            });
        }

        setSaving(false);
    };

    const handleDeleteUser = async (usuId: number) => {
        // Los empleados no pueden eliminar empleados
        if (userRole === 'playero') {
            toast({
                variant: "destructive",
                title: "Acceso denegado",
                description: "Los empleados no pueden eliminar otros empleados"
            });
            return;
        }

        if (!confirm('¿Estás seguro de que quieres eliminar este empleado? Esta acción no se puede deshacer.')) {
            return;
        }

        const result = await eliminarEmpleado(usuId);

        if (result.success) {
            toast({
                title: "Éxito",
                description: "Empleado eliminado correctamente"
            });
            if (userRole === 'owner') {
                await loadEmpleadosAsDueno();
            } else if (userRole === 'playero') {
                await loadEmpleadosAsEmpleado();
            }
        } else {
            toast({
                variant: "destructive",
                title: "Error",
                description: result.error || "Error al eliminar empleado"
            });
        }
    };

    // Funciones de utilidad
    const toggleDisponibilidad = (diaSemana: number, turnoId: number) => {
        const disponibilidad = usuarioSeleccionado.disponibilidad || [];
        const existe = disponibilidad.some(d => d.dia_semana === diaSemana && d.turno_id === turnoId);

        let nuevaDisponibilidad: Disponibilidad[];
        if (existe) {
            // Remover
            nuevaDisponibilidad = disponibilidad.filter(d => !(d.dia_semana === diaSemana && d.turno_id === turnoId));
        } else {
            // Agregar
            const turno = turnos.find(t => t.turno_id === turnoId);
            if (turno) {
                nuevaDisponibilidad = [...disponibilidad, {
                    dia_semana: diaSemana,
                    turno: turno.nombre_turno,
                    turno_id: turnoId
                }];
            } else {
                nuevaDisponibilidad = disponibilidad;
            }
        }

        setUsuarioSeleccionado(prev => ({
            ...prev,
            disponibilidad: nuevaDisponibilidad
        }));
    };

    const generarContrasena = () => {
        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let contrasena = '';
        for (let i = 0; i < 12; i++) {
            contrasena += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }
        setContrasenaTemporal(contrasena);
        setUsuarioSeleccionado(prev => ({
            ...prev,
            contrasena: contrasena
        }));
    };

    // Filtrar empleados
    const empleadosFiltrados = empleados.filter(empleado => {
        const matchesSearch = searchTerm === '' ||
            `${empleado.nombre} ${empleado.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            empleado.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesEstado = estadoFilter === 'todos' || empleado.estado === estadoFilter;

        return matchesSearch && matchesEstado;
    });

    const getEstadoBadgeVariant = (estado: string) => {
        return estado === 'Activo' ? 'default' : 'destructive';
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-7xl">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                        <p className="text-gray-600">Cargando empleados...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl bg-white min-h-screen">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                    {userRole === 'owner' ? 'Gestión de Empleados' : 'Mi Asignación'}
                </h1>
                <p className="text-gray-600 mt-1">
                    {userRole === 'owner'
                        ? 'Administra los empleados de tu estacionamiento actual, sus datos y disponibilidad'
                        : 'Visualiza tu asignación actual como empleado'
                    }
                </p>
            </div>

            {/* Listado de empleados */}
            <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-gray-900">
                            {userRole === 'owner' ? 'Listado de empleados' : 'Mi asignación'}
                        </CardTitle>
                        <div className="flex gap-2">
                            {userRole === 'owner' && (
                                <Button onClick={handleNewUser} size="sm" className="bg-blue-600 hover:bg-blue-700">
                                    <UserPlus className="h-4 w-4 mr-2" />
                                    Nuevo Empleado
                                </Button>
                            )}
                            <Button onClick={() => {
                                lastLoadKeyRef.current = null;
                                if (userRole === 'owner') {
                                    loadEmpleadosAsDueno();
                                } else if (userRole === 'playero') {
                                    loadEmpleadosAsEmpleado();
                                }
                            }} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Actualizar
                            </Button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex gap-4 mt-4">
                        <div className="flex-1">
                            <Input
                                placeholder="Buscar por nombre o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-white border-gray-300"
                            />
                        </div>
                        <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                            <SelectTrigger className="w-48 bg-white border-gray-300">
                                <SelectValue placeholder="Filtrar por estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos los estados</SelectItem>
                                <SelectItem value="Activo">Activos</SelectItem>
                                <SelectItem value="Inactivo">Inactivos</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto border-2 border-gray-400 rounded-lg shadow-lg">
                        <table className="w-full bg-white border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-gray-200 to-gray-300 border-b-2 border-gray-400">
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300">Nombre</th>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300">Email</th>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300">
                                        {userRole === 'owner' ? 'Disponibilidad' : 'Estacionamiento'}
                                    </th>
                                    <th className="py-4 px-4 text-left text-sm font-bold text-gray-900 border-r-2 border-gray-300">Estado</th>
                                    {userRole === 'owner' && (
                                        <th className="py-4 px-4 text-right text-sm font-bold text-gray-900">Acciones</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {empleadosFiltrados.length === 0 ? (
                                    <tr className="bg-white">
                                        <td colSpan={userRole === 'owner' ? 5 : 4} className="py-12 px-4 text-center text-gray-500 border-t border-gray-300">
                                            {empleados.length === 0
                                                ? (userRole === 'owner'
                                                    ? "No hay empleados registrados en este estacionamiento. Crea el primero haciendo clic en 'Nuevo Empleado'."
                                                    : "No tienes asignaciones activas en ningún estacionamiento."
                                                )
                                                : (userRole === 'owner'
                                                    ? "No se encontraron empleados con los filtros aplicados."
                                                    : "No se encontraron asignaciones con los filtros aplicados."
                                                )
                                            }
                                        </td>
                                    </tr>
                                ) : (
                                    empleadosFiltrados.map((empleado) => (
                                        <tr key={empleado.usu_id} className="border-b border-gray-300 hover:bg-blue-50 transition-colors">
                                            <td className="py-4 px-4 text-sm text-gray-800 border-r border-gray-300 font-medium">
                                                {empleado.nombre} {empleado.apellido}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                {empleado.email || 'Sin email'}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                {userRole === 'owner' ? (
                                                    <div className="max-w-48 truncate" title={formatearDisponibilidad(empleado.disponibilidad)}>
                                                        {formatearDisponibilidad(empleado.disponibilidad)}
                                                    </div>
                                                ) : (
                                                    <div className="max-w-48 truncate" title={empleado.estacionamiento?.est_nombre || 'Sin asignación'}>
                                                        {empleado.estacionamiento?.est_nombre || 'Sin asignación'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-sm text-gray-700 border-r border-gray-300">
                                                <Badge variant={getEstadoBadgeVariant(empleado.estado)} className="font-medium">
                                                    {empleado.estado}
                                                </Badge>
                                            </td>
                                            {userRole === 'owner' && (
                                                <td className="py-4 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSelectUser(empleado)}
                                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded px-2 py-1"
                                                            title="Editar empleado"
                                                        >
                                                            <Edit className="h-4 w-4 mr-1" />
                                                            <span className="text-xs font-medium">Editar</span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteUser(empleado.usu_id)}
                                                            className="text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 rounded px-2 py-1"
                                                            title="Eliminar empleado"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-1" />
                                                            <span className="text-xs font-medium">Eliminar</span>
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal del formulario de empleado */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900">
                            {usuarioSeleccionado.usu_id ? 'Editar Empleado' : 'Crear Nuevo Empleado'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Datos Personales */}
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="nombre" className="text-sm font-medium text-gray-700">Nombre</Label>
                                <Input
                                    id="nombre"
                                    value={usuarioSeleccionado.nombre || ''}
                                    onChange={(e) => setUsuarioSeleccionado(prev => ({ ...prev, nombre: e.target.value }))}
                                    placeholder="Juan"
                                    className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <Label htmlFor="apellido" className="text-sm font-medium text-gray-700">Apellido</Label>
                                <Input
                                    id="apellido"
                                    value={usuarioSeleccionado.apellido || ''}
                                    onChange={(e) => setUsuarioSeleccionado(prev => ({ ...prev, apellido: e.target.value }))}
                                    placeholder="Pérez"
                                    className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <Label htmlFor="dni" className="text-sm font-medium text-gray-700">DNI</Label>
                                <Input
                                    id="dni"
                                    value={usuarioSeleccionado.dni || ''}
                                    onChange={(e) => setUsuarioSeleccionado(prev => ({ ...prev, dni: e.target.value }))}
                                    placeholder="12345678"
                                    className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={usuarioSeleccionado.email || ''}
                                    onChange={(e) => setUsuarioSeleccionado(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="juan.perez@email.com"
                                    className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <Label htmlFor="estado" className="text-sm font-medium text-gray-700">Estado</Label>
                                <Select
                                    value={usuarioSeleccionado.estado || 'Activo'}
                                    onValueChange={(value) => setUsuarioSeleccionado(prev => ({ ...prev, estado: value }))}
                                >
                                    <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500">
                                        <SelectValue placeholder="Selecciona estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Activo">Activo</SelectItem>
                                        <SelectItem value="Inactivo">Inactivo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Ya no necesitamos selector de estacionamiento - se asigna automáticamente al actual */}
                        </div>

                        {/* Contraseña (solo para nuevos usuarios) */}
                        {!usuarioSeleccionado.usu_id && (
                            <div className="space-y-4 border-t border-gray-200 pt-4">
                                <Label className="text-sm font-medium text-gray-700">Contraseña Temporal</Label>

                                <div className="flex gap-2">
                                    <Input
                                        value={contrasenaTemporal}
                                        readOnly
                                        placeholder="Haz clic en Generar"
                                        className="bg-gray-50 border-gray-300 text-gray-600"
                                    />
                                    <Button
                                        type="button"
                                        onClick={generarContrasena}
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0"
                                    >
                                        <Key className="h-4 w-4 mr-2" />
                                        Generar
                                    </Button>
                                </div>

                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="requiere-cambio"
                                        checked={usuarioSeleccionado.requiere_cambio_contrasena || false}
                                        onCheckedChange={(checked) =>
                                            setUsuarioSeleccionado(prev => ({
                                                ...prev,
                                                requiere_cambio_contrasena: checked as boolean
                                            }))
                                        }
                                    />
                                    <Label
                                        htmlFor="requiere-cambio"
                                        className="text-sm text-gray-700 cursor-pointer"
                                    >
                                        Requerir cambio al primer ingreso
                                    </Label>
                                </div>
                            </div>
                        )}

                        {/* Disponibilidad */}
                        <div className="space-y-4 border-t border-gray-200 pt-4">
                            <Label className="text-sm font-medium text-gray-700">Disponibilidad Semanal</Label>

                            <div className="space-y-3">
                                {DIAS_SEMANA.map((dia) => (
                                    <div key={dia.id} className="space-y-2">
                                        <Label className="text-xs font-medium text-gray-600">{dia.nombre}</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {!turnos || turnos.length === 0 ? (
                                                <div className="text-xs text-gray-500 py-2">
                                                    {turnos === null ? 'Cargando turnos...' : 'No hay turnos disponibles'}
                                                </div>
                                            ) : (
                                                turnos.map((turno) => {
                                                    const estaSeleccionado = usuarioSeleccionado.disponibilidad?.some(
                                                        d => d.dia_semana === dia.id && d.turno_id === turno.turno_id
                                                    ) || false;

                                                    return (
                                                        <button
                                                            key={`${dia.id}-${turno.turno_id}`}
                                                            type="button"
                                                            onClick={() => toggleDisponibilidad(dia.id, turno.turno_id)}
                                                            className={`px-3 py-1 text-xs rounded-full transition-colors border font-medium ${estaSeleccionado
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                                                }`}
                                                        >
                                                            {turno.nombre_turno}
                                                        </button>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <Button
                                onClick={handleSaveUser}
                                disabled={saving}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0"
                            >
                                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                {usuarioSeleccionado.usu_id ? 'Actualizar' : 'Crear'} Empleado
                            </Button>
                            <Button
                                variant="outline"
                                onClick={handleNewUser}
                                disabled={saving}
                            >
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal de confirmación de creación exitosa */}
            <Dialog open={confirmationModalOpen} onOpenChange={setConfirmationModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-600">
                            <UserPlus className="h-5 w-5" />
                            {confirmationMessage?.title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            {confirmationMessage?.description}
                        </p>

                        {confirmationMessage?.details && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h4 className="font-semibold text-green-800 mb-3">Detalles del empleado:</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-600">Nombre:</span>
                                        <p className="text-gray-900">{confirmationMessage.details.nombre} {confirmationMessage.details.apellido}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Email:</span>
                                        <p className="text-gray-900">{confirmationMessage.details.email}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">DNI:</span>
                                        <p className="text-gray-900">{confirmationMessage.details.dni}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-600">Estado:</span>
                                        <Badge variant={confirmationMessage.details.estado === 'Activo' ? 'default' : 'secondary'}>
                                            {confirmationMessage.details.estado}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setConfirmationModalOpen(false)}
                            >
                                Cerrar
                            </Button>
                            <Button
                                onClick={() => {
                                    setConfirmationModalOpen(false);
                                    // Opcional: enfocar en el nuevo empleado en la lista
                                }}
                            >
                                Ver empleados
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
