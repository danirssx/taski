# Taski

Un gestor de tareas e ideas para equipos pequeños, con API y MCP como interfaces principales. Diseñado para que personas, Claude Code y Codex trabajen sobre el mismo contexto.

**Estado: API de tickets persistentes y auditados sobre Worker/D1 local, con sesiones de equipo y acceso para agentes.** Incluye comentarios atómicos, versiones, reintentos, configuración versionada y actividad incremental. Consulta la [API HTTP](docs/api.md) y el [cliente TypeScript](docs/client.md). Todavía no hay UI conectada o MCP; el despliegue de producción se prepara en B11.

B2 añade [configuración validada](docs/configuration.md) y una [base visual reutilizable](docs/ui.md). Para revisar sus componentes con datos ficticios, ejecuta `npm run ui` y abre `http://127.0.0.1:5173`. No es todavía la web conectada a tickets.

La [dirección visual v3](docs/design-direction.md) fue aceptada: captura inline, detalle lateral y una vista móvil centrada en feedback. Las [decisiones de B0](docs/decisions/b0.md) fijan las reglas y los criterios de entrega por bloque.

## Dirección del proyecto

- Un proyecto por instalación, con sus propios datos y configuración.
- Captura sencilla de tareas y feedback, enlaces compartibles y conversación.
- Auditoría de cambios y PRs vinculados manualmente.
- Núcleo independiente de la marca, con temas e interfaz reemplazables.
- Primer despliegue previsto: TypeScript, Cloudflare Workers y D1.
- Código de acceso del equipo y selección de persona para la primera versión.

Las capacidades anteriores son objetivos del producto, no funcionalidades disponibles hoy. La app iOS y la sincronización automática de GitHub se evaluarán después.

## Participar ahora

Aceptamos contribuciones de documentación, diseño y propuestas técnicas. Puedes hacer un fork y abrir un pull request hacia `main`; no necesitas acceso de escritura a este repositorio.

1. Lee la [guía de contribución](CONTRIBUTING.md).
2. Revisa el [alcance](docs/product-scope.md) y el [roadmap](docs/roadmap.md).
3. Propón un cambio pequeño con contexto y evidencia de comprobación.

## Revisar esta versión localmente

Requisitos actuales: Git y Python 3.10 o superior. No necesitas una cuenta Cloudflare para revisar estos documentos.

```sh
git clone https://github.com/danirssx/taski.git
cd taski
python3 scripts/check_docs.py
```

Este comando verifica enlaces locales de documentación. Para arrancar el Worker se necesita Node 24.11.1 o Node 26 desde 26.3.0 y npm 11:

```sh
npm ci
npm run db:migrate
npm run dev
```

Abre `http://127.0.0.1:8787/health`: debe responder HTTP 200 y `checks.database: ok`. Sigue la [guía de arranque](docs/getting-started.md) para respuesta completa, persistencia y verificaciones. No se necesita una cuenta Cloudflare.

Para probar el [acceso de equipo](docs/access.md), aplica las migraciones y crea `.dev.vars` a partir de `.dev.vars.example`, con tu código local. La salud y los componentes siguen funcionando sin código; las sesiones no usan ningún secreto por defecto.

El [spike experimental de B0](experiments/b0/README.md) sí puede ejecutarse con fixtures ficticios para comprobar el contrato y sus presupuestos proxy. No requiere credenciales; no es un servidor MCP ni demuestra todavía ventaja frente a Linear.

## Documentación

- [Índice y estado de las guías](docs/README.md)
- [Alcance del producto](docs/product-scope.md)
- [Arquitectura y recorrido de datos](docs/architecture.md)
- [Roadmap por bloques](docs/roadmap.md)
- [Criterios de calidad documental](docs/documentation.md)
- [Referencias para explorar el diseño](docs/design-references.md)
- [Dirección visual actual](docs/design-direction.md)
- [Q2: imágenes, voz, SwiftUI y sticky notes](docs/q2.md)
- [Auditoría de Linear](docs/benchmarks/linear-baseline.md), [contrato candidato](docs/benchmarks/contract.md) y [protocolo comparativo](docs/benchmarks/protocol.md)

## Licencia

El contenido original de este repositorio se distribuye bajo [MIT](LICENSE). Cualquier recurso de terceros que se incorpore deberá conservar su licencia y atribución. Los datos y secretos de una instalación no forman parte del repositorio público.
