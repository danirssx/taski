# Dirección de diseño · revisión v3

Baseline aceptado por el mantenedor el 12 de noviembre de 2026 tras revisar el prototipo v3. La dirección publicada en el [PR #1](https://github.com/danirssx/taski/pull/1) queda acordada; su implementación se realizará en B2/B7/B8.

## Interacciones

- [Superlist](https://www.superlist.com/): detalle en un panel derecho que conserva la lista interactiva en escritorio.
- [Timestripe](https://timestripe.com/about/): lista inline, jerarquía tranquila, tipografía Inter y resaltado de tareas concretas.
- Creación en una línea con Enter; ampliar contexto en el panel cuando haga falta.
- Guardar conserva el detalle abierto. Escape vuelve a la lista.
- Marca discreta: acentos, sin grandes superficies del color de marca.
- Claro, oscuro y preferencia del dispositivo mediante tokens semánticos.

La implementación visual usa código propio y recursos redistribuibles con sus avisos. No se copian código o recursos propietarios de las aplicaciones de referencia.

## Móvil

Feedback es el punto de entrada. La lista resume título, tipo y autor; los metadatos completos viven en el detalle a pantalla completa. Compartir feedback requiere pocos campos y no obliga a comprender PRs o repositorios.

## Resaltado

El subrayado suave es un atributo reversible del ticket, independiente del estado, asignación y tipo. Sus cambios deben quedar en la auditoría y poder gestionarse por la misma API/MCP.

## Alcance del visto bueno

Se aceptan panel derecho no modal, Inter, captura inline, resaltado independiente del estado, marca discreta y feedback móvil resumido. Los ajustes posteriores conservan estos recorridos y sus criterios de teclado/responsive. El consenso sobre el mock no equivale a tener backend, D1 o MCP real.

Imágenes, voz, SwiftUI y sticky notes pertenecen a [Q2](q2.md); no se presentan como disponibles en esta versión.
