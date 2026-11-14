# Casos de uso de tickets

`TicketService` implementa crear, leer, listar y editar, asignación, estado, conversión, resaltado, patch de descripción, comentario y referencia manual de PR. Recibe un repositorio y un runtime de IDs/reloj/hash; el núcleo no importa React, Cloudflare ni el almacenamiento del spike Python.

El título es obligatorio (máximo 240 caracteres); descripción hasta 100000 y comentario hasta 20000. Estados: todo/in_progress/in_review/done; tipos task/feedback. Los miembros y áreas se validan por ID configurado. El actor elegido y el responsable son datos distintos; el nombre del actor se toma del contexto de instalación, no de un campo enviado por un consumidor.

Los agentes pasan a in_review por defecto. `done` exige persona, política global explícita o una delegación de alcance limitado en contexto de aplicación confiable. Las peticiones de mutación no aceptan grants, actor, código, URL, timestamps o identidad nuevos. El adaptador de acceso será responsable de construir ese contexto en B4. La identidad inicial es declarada.

Convertir feedback a tarea y resaltar no cambian ID, código, URL o conversación. Un patch exige una coincidencia única y no puede combinarse con reemplazo completo de descripción. No se habilita borrado de tickets ni edición/retirada de comentarios. Cambiar estado y añadir un avance se prepara como una sola mutación para el repositorio.

Errores estables: INVALID_INPUT, UNKNOWN_MEMBER, UNKNOWN_AREA, NOT_FOUND, REVIEW_REQUIRED, PATCH_CONFLICT, EMPTY_UPDATE, VERSION_CONFLICT e IDEMPOTENCY_CONFLICT. El receptor debe releer ante conflicto y conservar texto sin guardar; no incrementar a ciegas la versión. La clave idempotente se consulta antes de rechazar una versión vieja en un reintento idéntico.

El puerto de commit está implementado por [D1 con auditoría atómica](audit.md), y las [carreras/reintentos](retries.md) se prueban sobre D1 emulado. No se exponen escrituras HTTP/MCP hasta completar esos adaptadores y acceso en B4–B6.
