# Spike local del contrato B0

Experimento en Python con datos ficticios, independiente de la futura app TypeScript. No escucha conexiones, no implementa JSON-RPC/MCP, no autentica personas y no usa Cloudflare. Las ocho definiciones de [catalog.json](catalog.json) y su semántica sirven para revisar el contrato antes de B1/B6. No importar este almacenamiento en producción.

## Ejecutar desde la raíz del repositorio

Requisitos: Python 3.10 o superior y acceso a PyPI para instalar dependencias; no requiere cuentas ni credenciales de servicios. Probado con Python 3.14.8 en macOS ARM64 y en GitHub Actions con Python del runner Ubuntu. Las versiones transitivas resueltas se registran en [requirements-lock.txt](requirements-lock.txt); no es el lockfile de la futura app TypeScript.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r experiments/b0/requirements-lock.txt
.venv/bin/python -m unittest discover -s experiments/b0 -v
.venv/bin/python experiments/b0/measure.py --check
python3 scripts/check_linear_baseline.py
python3 scripts/check_docs.py
git diff --check
```

Éxito esperado: 12 pruebas correctas, informe reproducible dentro de los tres presupuestos proxy, aritmética histórica válida y enlaces locales existentes. Para actualizar el informe tras cambiar el contrato, ejecutar `measure.py` sin `--check` y revisar el diff. No incorporar una actualización que oculte una regresión de presupuesto sin justificarla.

Las dependencias directas se declaran en [requirements.txt](requirements.txt). Si cambia alguna, resolver en un entorno limpio, actualizar el lock y registrar Python/OS/versiones. `tiktoken` puede descargar su tabla pública de encoding la primera vez; CI no requiere secretos.

## Qué comprueba

- Esquemas de entrada/salida válidos y rechazos de entradas inválidas, con [jsonschema](https://python-jsonschema.readthedocs.io/en/stable/validate/).
- Configuración versionada, resúmenes paginados y lectura conjunta de detalle/comentarios.
- Escritura de estado + comentario con rollback, reintento idempotente y conflicto por versión.
- Política de revisión común a canales; una referencia de delegación pertenece al contexto de aplicación simulado, no al esquema enviado por la herramienta.
- Cambios incrementales, cursores vencidos, lectura completa para recuperar contenido y descripción larga sin truncado.
- Conversión de feedback conservando identidad y comentarios; patch de texto que emite solo el cambio.

La transacción se simula con copia/rollback en un proceso. No prueba concurrencia real de red o D1, persistencia, autorización confiable, tiempo de servidor ni integración con clientes IA. Los objetos anidados de algunos esquemas de salida son abiertos en este spike; B5/B6 deben concretar sus DTOs y esquemas completos.

## Artefactos y siguiente paso

- [Contrato y ejemplos](../../docs/benchmarks/contract.md)
- [Protocolo comparativo y metas](../../docs/benchmarks/protocol.md)
- [Resultados locales](../../docs/benchmarks/b0-spike-results.json)
- [Línea base histórica de Linear](../../docs/benchmarks/linear-baseline.md)

B1 crea la base TypeScript/Worker/D1. B3 implementa garantías persistentes; B5/B6 adaptan y verifican este contrato. El benchmark real sigue pendiente en B6-04.
