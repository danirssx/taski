# Dirección de diseño · revisión v3

Propuesta en revisión. Se acuerdan los patrones de referencia, pero el diseño necesita consenso antes de comenzar el runtime de B1.

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

## Revisión antes de B1

Comprobar captura, lista/detalle, resaltado, teclado, edición y feedback móvil en el prototipo. El consenso visual y las pruebas del mock no equivalen a tener backend, D1 o MCP real.

Imágenes, voz, SwiftUI y sticky notes pertenecen a [Q2](q2.md); no se presentan como disponibles en esta versión.
