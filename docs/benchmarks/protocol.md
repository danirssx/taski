# Protocolo comparativo · Taski frente a Linear optimizado

Acuerdo de B0-03, [issue #4](https://github.com/danirssx/taski/issues/4). La suite local prueba forma y semántica. La comparación desplegada, los clientes reales y el gate de rendimiento corresponden a [B6-04 / #21](https://github.com/danirssx/taski/issues/21).

## Tres niveles de evidencia

| Nivel | Disponible en B0 | Qué permite afirmar |
| --- | --- | --- |
| Línea base histórica | [16 lecturas y agregados](linear-baseline.md) | Lo observado en un conector y muestra concretos; no comparación de servidores equivalente. |
| Spike local | [Contrato](contract.md), 12 pruebas y [resultados proxy](b0-spike-results.json) | Semántica de fixtures y cumplimiento de presupuestos de forma en memoria. |
| Servidores y agentes | Pendiente en B6 | Uso real, latencia, corrección y ventaja comparativa bajo condiciones documentadas. |

No mezclar resultados de niveles diferentes en una cifra de ahorro. No publicar contenido privado para hacer reproducible un agregado.

## Presupuestos del spike

Serialización canónica: `json.dumps(..., ensure_ascii=False, sort_keys=True, separators=(',', ':'))`. Tokenizer: `tiktoken==0.14.0`, `o200k_base`. Es una convención proxy común, no el tokenizer garantizado de los modelos.

| Artefacto de los fixtures normales | Presupuesto máximo proxy | Resultado local |
| --- | --- | --- |
| Catálogo completo, instrucciones y ocho definiciones de entrada/salida | 4000 | 1736 |
| Lista de 20 resúmenes | 1600 | 710 |
| Recibo ordinario de estado + avance | 200 | 41 |

Resultados adicionales: configuración completa 107 tokens; versión sin cambios 20; lectura de trabajo 113; un evento incremental 89. Son fixtures nuevos y más pequeños que la captura histórica; **no comparar 710 con los 681/716 históricos como si fueran la misma tarea**.

Los presupuestos miden objetos del spike, sin los envelopes/duplicación de `content` y `structuredContent`, instrucciones del host, descubrimiento o historial del agente. B6 debe medir lo que realmente recibe el modelo y evitar duplicar el mismo resultado en dos representaciones. No facturar mentalmente el catálogo completo cada turno.

Títulos, descripciones, comentarios y patches largos se miden en un grupo separado. No cortar silenciosamente contenido para hacer pasar un presupuesto; ofrecer límites de entrada documentados, paginación y lectura completa cuando corresponda. B5/B6 pueden revisar una forma que no cabe, manteniendo la semántica y registrando la decisión.

## Suite equivalente del benchmark real

Usar un proyecto de prueba independiente en cada proveedor, con los mismos [20 tickets ficticios](../../experiments/b0/fixtures/tickets.json), miembros, estados y conversación. Importar estados iniciales equivalentes y restaurarlos para las escrituras; ninguna prueba toca trabajo real por defecto. La preparación/restauración se mide aparte de la tarea, igual en ambos proveedores.

| Escenario | Resultado correcto | Comparador Linear optimizado |
| --- | --- | --- |
| Listar asignados | Mismo conjunto y campos necesarios, 10 y 20 tickets; paginar cuando proceda. | `fields`, filtros y límites apropiados. |
| Leer contexto para implementar | Misma descripción y comentarios recientes necesarios; recuperar anteriores si se piden. | `get_issue` + `list_comments`, paralelizables cuando sean independientes. |
| Crear y asignar | Un ticket con responsable correcto y un solo alta. | `save_issue` con creación y asignación juntas. |
| Dejar avance y estado | Cambio y comentario confirmados, sin duplicados. | `save_issue` + `save_comment`; comprobar fallos parciales. |
| PR + estado | Mismos campos y referencia manual, sin llamadas de más. | Una edición de varios campos cuando el contrato lo permita. |
| Retomar contexto conocido | Obtener todos los cambios desde el último punto conocido, sin perder comentarios. | Mejor consulta incremental disponible, campos y cursores; no forzar relectura completa si puede evitarse. |
| Editar descripción larga | Mismo contenido final y ninguna pérdida. | Patch y versión/semántica de conflicto disponible; no sustituir por una lectura de identidad. |
| Fallos y recuperación | Conflictos, reintentos, cursores inválidos y acceso al contenido completo correctos. | Mejor recuperación documentada del conector usado. |

La atomicidad de Taski es una propiedad adicional a verificar en D1. Una ejecución final equivalente no convierte automáticamente dos escrituras de Linear en una transacción. Registrar ese límite, no fabricar una equivalencia de garantías.

## Diseño de ejecución

1. Fijar repositorio/commit, servidores, regiones y versiones del host, modelo, tokenizer y conectores. Registrar instrucciones y configuración de herramientas sin secretos.
2. Ejecutar en Claude Code y Codex por separado, usando el mismo modelo/versión dentro de cada comparación. Mantener iguales instrucciones de tarea, datos, permisos y resultado esperado. No comparar Claude sobre un proveedor con Codex sobre otro.
3. Separar contexto nuevo de contexto previo y descubrimiento diferido de carga anticipada, cuando el host lo permita. Distinguir caché fría/caliente controlable; si no puede controlarse, declararlo y registrar lo observado.
4. Alternar orden Taski/Linear para reducir sesgo temporal. Al menos 30 ejecuciones por escenario/proveedor y condición reportada para una evaluación orientativa; no inventar muestras ausentes ni estimar p95 de tres observaciones como concluyente.
5. El default de Linear es una referencia secundaria. El comparador principal usa fields, límites, referencias legibles, patches y paralelización disponibles. Revisar las herramientas/versiones de nuevo antes de ejecutar.
6. No cobrar a un proveedor la preparación de fixtures y al otro no. Registrar por separado errores externos, reintentos y tareas fallidas; no excluirlas silenciosamente.

## Registro y cómputo

Por ejecución conservar: runId, commit, proveedor, host/modelo/versiones, escenario, orden, condición de contexto/caché/carga, herramientas realmente cargadas, llamadas/rondas, bytes y tokens proxy de argumentos/resultados, uso real de entrada/salida/caché si se expone, latencia de tarea, corrección, errores/reintentos y coste de recuperación. Sin credenciales ni contenido de proyectos privados. Instrumentar solo datos de prueba.

Para uso real sumar las unidades de entrada y salida reportadas por el cliente a lo largo de la tarea, usando una única fuente y evitando sumar tanto acumulados como incrementos. Reportar entrada cacheada por separado; no sumarla otra vez si ya está incluida en entrada. Tokens de razonamiento/salida y descubrimiento deben seguir la semántica del host. Si no existe telemetría suficiente, indicar `unavailable`; no reemplazarla con proxy y declarar cumplida la meta de tokens reales.

Latencia end-to-end: desde la instrucción del escenario hasta resultado correcto confirmado, incluyendo selección de herramientas, descubrimiento y recuperación. Registrar también duración de invocaciones; menor número de llamadas no demuestra menor tiempo. Reportar p50/p95, n, dispersión y fallos por escenario/condición. Las lecturas de Linear pueden ser paralelas.

## Matriz de evidencia obligatoria

| Mecanismo | Evidencia para aceptar |
| --- | --- |
| Catálogo breve | Definiciones realmente cargadas, instrucciones y descubrimiento; conteo/tamaño proxy separados de uso real. |
| Operaciones compuestas | Llamadas/rondas, corrección, atomicidad y p50/p95 frente al mejor paralelismo válido de Linear. |
| Reutilización | ConfigVersion/cursor, datos retransmitidos, recuperación tras invalidez y cero cambios perdidos. |
| Defaults compactos | Tamaño normal de listas/recibos y disponibilidad de contenido completo, sin selección manual excesiva. |

## Gate y qué hacer si falla

Metas acordadas: **al menos 25 % menos tokens agregados reales** de los flujos equivalentes y **20 % menor p50** en los flujos compuestos, con corrección igual o mejor. Fijar antes del benchmark los pesos de la suite; usar pesos iguales por escenario comparable como punto inicial y publicar también cada resultado separado. No cambiar los pesos después para favorecer Taski.

Reportar p95 y regresiones aunque pase el agregado; una regresión material exige explicación y decisión explícita. El spike no satisface ese gate. Si faltan datos reales o no se cumplen las metas, dejar el resultado como no demostrado/no cumplido, ajustar el contrato y repetir únicamente los escenarios afectados más un control de regresión. Si no hay ventaja, retirar la afirmación comparativa. B0 puede terminar con un spike válido y metas claras; B6 sigue siendo responsable de demostrar su resultado.
