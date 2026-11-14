# Auditoría y atomicidad D1

El adaptador D1 implementa el puerto de `TicketService`. Cada mutación ejecuta un solo `db.batch`: reserva de reintento, alta/edición del ticket, comentario opcional, evento y recibo confirmado. [D1 documenta batches transaccionales con rollback](https://developers.cloudflare.com/d1/worker-api/d1-database/). No se usa BEGIN/COMMIT manual ni un contador en memoria.

La actividad contiene secuencia, ticket/versión, snapshot del actor declarado (miembro/nombre/canal/cliente), hora del servidor y cambios antes/después. Crear también queda auditado. Los patches guardan el cambio concreto, sin repetir ambos textos; el contenido completo permanece accesible por ticket. Los comentarios guardan el mismo actor/hora y versión de la mutación. Solo son append-only: no se implementa edición/retirada silenciosa.

IDs, hash de petición y reloj se generan en el adaptador de runtime del servidor, no en campos editables del consumidor. La identidad sigue siendo seleccionada, no autenticación individual. El repositorio fija la identidad del proyecto y rechaza usar su base con otro prefijo/ID.

Una prueba fuerza fallo en INSERT de actividad después de preparar cambio/comentario: D1 revierte todos, incluida la reserva de reintento. Otra verifica actor, hora común y un solo evento para estado+avance. Son pruebas de D1 emulado; el despliegue y recuperación del servicio remoto se validan en B11.

Los recibos almacenan key/URL/versión/campos afectados y commentId cuando existe. La protección de carreras y la traducción de conflictos bajo reintentos simultáneos se completan en B3-04 antes de exponer estas operaciones mediante HTTP/MCP.
