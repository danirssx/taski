# Línea base observada de Linear MCP

Auditoría de solo lectura del 12 de noviembre de 2026, para [B0-02 / #3](https://github.com/danirssx/taski/issues/3). **No demuestra superioridad de Taski:** todavía no existe su servidor. Se observaron 70 herramientas del conector de esta sesión, 16 llamadas registradas más una lectura de descubrimiento excluida, un ticket, diez tickets de su mismo proyecto y dos comentarios. No se midieron escrituras.

## Método y procedencia

Se repitieron tres veces las principales lecturas por defecto y con `fields`. El reloj rodeaba la invocación del conector: incluye red/servidor/host, excluye razonamiento y sesión completa del modelo. Son solo tres muestras por variante; no se calcula un p95 ni se atribuye causalidad a diferencias de latencia.

Conteo proxy con `tiktoken==0.14.0`, `o200k_base`: argumentos y texto de respuesta serializados con el método de la captura original. No son tokens facturados ni el tokenizer garantizado de Claude o Codex. Las declaraciones expuestas por el conector tampoco son un `tools/list` original del servidor.

Los [agregados y muestras numéricas](linear-baseline.json) conservan el registro histórico saneado: sin IDs, nombres, descripciones, comentarios, URLs de trabajo, credenciales ni capturas crudas. El contenido original permanece fuera de este repositorio. No es posible volver a tokenizar esa captura desde este checkout; sí comprobar su aritmética. Los [fixtures neutros](../../experiments/b0/fixtures/tickets.json) son datos nuevos para el spike y la futura suite: sus conteos no tienen que coincidir con los históricos.

```sh
python3 scripts/check_linear_baseline.py
```

## Resultados históricos

| Lectura | n | Respuesta proxy | Argumentos + respuesta | Mediana ms | Rango ms |
| --- | --- | --- | --- | --- | --- |
| Lista de 10 por defecto | 3 | 5987 | 6008 | 1358 | 1349–2287 |
| Misma lista, cuatro campos | 3 | 681 | 715 | 602 | 591–2055 |
| Detalle por defecto | 3 | 2522 | 2529 | 524 | 504–3260 |
| Detalle con descripción necesaria | 3 | 1873 | 1895 | 590 | 444–1495 |
| Solo identidad/título/estado/responsable | 3 | 54 | 74 | 1562 | 342–1978 |
| Comentarios: hasta cinco, se obtuvieron dos | 1 | 1485 | 1497 | 1626 | 1626–1626 |

La lista ajustada pidió `id`, `title`, `status`, `assigneeId`, con los mismos tickets/filtro/límite 10. Redujo 88,63 % la respuesta frente al default **dentro de Linear**. No es ahorro atribuible a Taski. La lectura de 54 tokens no reemplaza leer una descripción necesaria; se excluye de cualquier comparación de comprensión completa.

La proyección local de los mismos valores en una forma candidata de Taski con versión produjo **716 frente a 681** tokens: **5,14 % más**. Cambiar nombres de campos y añadir versión no demostró ahorro. Esta proyección histórica no es el resultado del nuevo spike neutro.

## Lo que Linear ya ofrece

Se verificó en los contratos de herramientas del conector de la sesión:

- `get_issue` y `list_issues` permiten `fields`; las listas/comentarios tienen límites y cursores.
- Referencias legibles evitan resolver UUIDs en múltiples recorridos.
- `save_issue` crea y asigna en una operación, actualiza varios campos y admite parches de descripción.
- Leer detalle y comentarios usa herramientas distintas; pueden paralelizarse si son independientes. Editar y comentar también usa operaciones separadas.

Es evidencia del conector observado, no una garantía inmutable de todas las versiones de Linear. La [documentación oficial de Linear](https://linear.app/docs/mcp) confirma el servidor remoto, Streamable HTTP y autenticación directa además de OAuth; esos elementos por sí solos no son ventajas de Taski.

## Catálogo observado y carga real

70 herramientas: nombres/descripciones serializados dieron 57.699 tokens proxy; solo declaraciones expuestas, 11.986. Para `list_issues` + `get_issue`, las mismas representaciones dieron 2501 y 1208. El JSON guarda caracteres y método; no sumar representaciones distintas ni tratar todo el catálogo como un cargo por turno.

[Claude Code](https://code.claude.com/docs/en/mcp#configure-tool-search) puede descubrir herramientas de forma diferida. [OpenAI Tool Search](https://developers.openai.com/api/docs/guides/tools-tool-search) documenta carga diferida; [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) permite `enabled_tools` para limitar el catálogo. La configuración y el host determinan qué llega al modelo. **70 frente a ocho no cuantifica ahorro real.** Referencias revisadas el 12 de noviembre de 2026.

## Oportunidad por validar

1. Catálogo breve: medir definiciones realmente cargadas e instrucciones, incluido descubrimiento.
2. Menos operaciones: lectura ticket/comentarios y actualización + avance atómicos; respetar el paralelismo posible de Linear.
3. Reutilizar contexto: configuración versionada, eventos desde cursor, cambios concretos y recuperación completa.
4. Defaults adecuados: resúmenes/recibos pequeños sin obligar al modelo a seleccionar decenas de campos.

El spike y el protocolo de B0-03 fijarán presupuestos de forma y las metas del benchmark desplegado. Si Taski no mejora frente a Linear optimizado, se modifica el contrato o se documenta la meta incumplida; no se sustituye uso real por una proyección favorable.
