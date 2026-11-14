# Concurrencia y reintentos

Cada edición exige `expectedVersion`. El guard de SQLite evalúa el incremento dentro de la misma transacción que comentario/auditoría: dos lectores de versión 1 no pueden confirmar ambos una versión 2. El perdedor recibe VERSION_CONFLICT y no deja comentario, actividad o reserva idempotente parcial. Releer el ticket, conservar el texto del usuario y decidir cómo reconciliar; nunca cambiar expectedVersion a ciegas.

Cada escritura exige idempotencyKey de hasta 128 caracteres, acotada por miembro y operación. Los argumentos normalizados se serializan con orden determinista y se guardan como SHA-256. La reserva y recibo se confirman en el mismo batch. Mismo miembro/operación/clave y parámetros devuelve el recibo original, incluso si después hubo más ediciones. Cambiar parámetros produce IDEMPOTENCY_CONFLICT. Cambiar nombres/rótulos o la versión del cliente no convierte un reintento idéntico en otra operación.

Ante una carrera por la misma clave, el perdedor consulta el recibo confirmado y lo devuelve solo si coincide el fingerprint. Lo mismo permite recuperarse cuando un commit pudo completarse pero se perdió su respuesta. No se anuncia éxito si no se puede confirmar el recibo. Si un batch falla y revierte, la misma petición puede reintentarse después de corregir la causa sin duplicados.

Las pruebas D1 fuerzan lecturas simultáneas de una misma versión, 16 creaciones idénticas, ocho avances idénticos, reutilización conflictiva, recuperación tras rollback y cambio de rótulo de miembro. Son garantías probadas con D1 emulado, no un benchmark de latencia remota. No se aplica TTL a recibos en esta versión; eliminarlos cambiaría la ventana de deduplicación y requeriría una política documentada.
