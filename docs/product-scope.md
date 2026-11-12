# Alcance inicial

Este documento describe el producto propuesto; no una implementación disponible.

Taski está pensado para equipos pequeños que necesitan capturar tareas e ideas y mantener una conversación compartida con sus agentes de desarrollo. Cada instalación sirve a un proyecto y mantiene su propia configuración y base de datos.

## Capacidades previstas

- Tareas y feedback con título, descripción, área, responsable opcional y estado.
- Estados iniciales: Pendiente, En curso, Por revisar y Terminado; IDs estables independientes del idioma.
- Convertir feedback en tarea conservando ID, enlace, comentarios e historial.
- Enlace estable por ticket, como `/t/TSK-001`.
- Comentarios y auditoría de cambios con valores antes/después y canal.
- Enlace principal a un PR introducido manualmente, sin afirmar su estado externo.
- Código del equipo y selección de persona; identidad declarada en esta primera etapa.
- API y MCP con lectura paginada y respuestas compactas.
- Configuración, marca, temas e interfaz separados del núcleo.

## Decisiones abiertas de B0

- Dirección visual y experiencia de creación de tareas: [referencias](design-references.md).
- Política de cierre por agentes: terminar tickets o dejarlos Por revisar para una persona.

La configuración debe poder representar la política elegida sin mezclarla con la UI.

## Fases posteriores

App iOS, autenticación individual, sincronización automática con GitHub, adjuntos, notificaciones, WebSockets y ejecución autónoma de agentes. Se incorporarán si una necesidad concreta justifica su alcance.
