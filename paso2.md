Objetivo: Crear un nuevo endpoint de API dedicado exclusivamente a la creación de una zona y la generación masiva de sus plazas. Esta es una operación compleja que merece su propio endpoint para asegurar que se realice correctamente.

Contexto para Cursor:

El objetivo es crear un endpoint en app/api/zonas/configurar/route.ts. Este endpoint recibirá una única solicitud POST con la configuración de una nueva zona de estacionamiento, tal como se define en el formulario del diseño. La lógica de este endpoint es crucial: debe ser una operación "todo o nada". Primero, creará la nueva zona en la tabla zonas. Luego, calculará la numeración de las plazas (ya sea empezando desde 1 o continuando desde la última plaza existente). Finalmente, generará e insertará todas las nuevas plazas en la tabla plazas en una sola operación, asignándoles el tipo de vehículo seleccionado. Si alguna parte de este proceso falla, no deben quedar datos a medias; por ejemplo, no debe crearse una zona vacía sin plazas.

Instrucciones para Cursor:

2.1. Crear el Archivo de la Nueva API

Dentro de la carpeta app/api/zonas/, crea una nueva carpeta llamada configurar.

Dentro de esa carpeta, crea un archivo route.ts. La ruta completa del archivo será: app/api/zonas/configurar/route.ts.

2.2. Implementar la Lógica de la API en route.ts

Dentro de este archivo, implementa una única función POST. Esta función debe seguir los siguientes pasos lógicos:

Función POST (Crear Zona y Plazas):

Recibir y Validar Datos:

La función debe leer del cuerpo (body) de la solicitud un objeto con la configuración: est_id, zona_nombre, cantidad_plazas, catv_segmento (el tipo de vehículo), y un objeto numeracion que especifica el modo ("reiniciar" o "continuar").

Valida que todos los datos necesarios estén presentes. Si falta algo, devuelve un error 400 (Bad Request).

Crear la Zona:

Realiza una operación INSERT en la tabla zonas utilizando el est_id y zona_nombre recibidos.

Es fundamental que obtengas el zona_id de la zona que acabas de crear, ya que lo necesitarás para el siguiente paso.

Determinar el Número de Inicio de Plaza:

Implementa una lógica condicional basada en numeracion.modo:

Si el modo es "reiniciar", la primera plaza será la número 1.

Si el modo es "continuar", debes realizar una consulta a la base de datos para encontrar el número de plaza más alto que ya existe en el estacionamiento. La consulta sería algo como: SELECT MAX(pla_numero) FROM plazas WHERE est_id = [tu_est_id]. El número de inicio será el resultado de esa consulta + 1.

Validar Conflictos de Numeración:

Antes de insertar, realiza una consulta para asegurarte de que los números de plaza que vas a generar (desde el número de inicio hasta inicio + cantidad_plazas - 1) no existan ya para ese est_id. Si algún número ya existe, debe devolver un error claro al usuario.

Generar el Lote de Plazas:

Crea un bucle que se ejecute cantidad_plazas veces.

Dentro del bucle, genera un objeto por cada plaza. Cada objeto debe tener: est_id, pla_numero (incrementando desde tu número de inicio), el zona_id que obtuviste antes, un pla_estado por defecto (ej: 'Libre'), y el catv_segmento recibido en la solicitud.

Almacena todos estos objetos en un array.

Inserción Masiva (Bulk Insert):

Realiza una única operación INSERT a la tabla plazas, pasándole el array completo de plazas que generaste.

Manejo de Errores (Transacción Simulada):

Envuelve la lógica en un bloque try...catch. Si la inserción masiva de plazas falla, el bloque catch debe ejecutar una operación DELETE para eliminar la zona que se creó en el paso 2. Esto asegura que no queden zonas "fantasma" sin plazas.

Una vez que tengas esta API lista, avísame. Será el motor que permitirá que la nueva pantalla cobre vida. Luego, pasaremos al Paso 3 para construir la interfaz.