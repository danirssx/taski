# Persistencia e identificadores de B3

La migración `0002_tickets.sql` crea tickets, comentarios, actividad y recibos idempotentes, además de la identidad de la instalación. No incluye datos reales ni crea tickets por defecto. Aplicar con `npm run db:migrate`; el esquema de bootstrap de B1 sigue vigente.

`tickets.number` es un INTEGER PRIMARY KEY AUTOINCREMENT, asignado por SQLite/D1. El código generado combina el prefijo fijado para la instalación y ese número; nunca usa COUNT(*) ni un contador en memoria. `id` es otro identificador estable generado por la aplicación. La URL almacena su base original y código: renombrar, reasignar o convertir feedback no los cambia. El borrado de tickets está deshabilitado; las transacciones fallidas no publican un código confirmado.

La instalación vincula project.id/prefix al primer uso. Reutilizar la base con otro ID/prefijo produce conflicto, sin reescribir tickets. Un proyecto distinto usa otra base. Los rótulos y nombres siguen en configuración; los registros guardan IDs de referencia y snapshots de actor para mantener la atribución histórica.

Los índices cubren estado/fecha, responsable/estado, tipo, área, comentarios por versión y actividad por secuencia. Comentarios y actividad son append-only; no se habilitan edición/retirada en esta versión. Cada versión de ticket tiene un único evento. `mutation_receipts` reserva claves por actor/operación y conserva el resultado confirmado para reintentos. Sus garantías se implementan y prueban en los siguientes issues B3-02–04.

El guard de UPDATE exige version+1 y conserva identidad/código/URL/creador/fecha inicial. No constituye por sí solo una auditoría de escrituras administrativas externas: las mutaciones de aplicación se agrupan con comentarios y eventos en un batch D1 atómico. La API no expone acceso SQL.

Pruebas de esquema: creación concurrente con datos ficticios, códigos únicos, identidad conservada y rechazo de prefijos/borrado inválidos. Se ejecutan con D1 emulado mediante `npm test`, sin base remota.
