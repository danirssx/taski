# Alcance inicial

Este documento describe el alcance de la primera versión. El estado de lo implementado está en [README](../README.md); la existencia de reglas/persistencia no implica que todas las interfaces ya estén disponibles.

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
- Captura inline, panel derecho en escritorio y feedback resumido en móvil.
- Resaltado individual reversible de tareas, con auditoría.

## Decisiones cerradas de B0

- Aceptada la [dirección visual v3](design-direction.md): panel derecho, Inter/inline y resaltado individual.
- Los agentes dejan el trabajo en `in_review`; una persona confirma `done`. Un encargo humano explícito puede autorizar al agente a cerrar los tickets de ese encargo, dejando constancia de la autorización. Esto no habilita el cierre autónomo del resto del proyecto.

La política predeterminada será `agentsCanComplete: false`, independiente de UI y transporte. HTTP y MCP aplicarán la misma regla en el núcleo; B3/B4 implementarán su validación y auditoría. En la primera versión la identidad es declarada, no una garantía de autenticación individual. Ver [decisiones de B0](decisions/b0.md).

## Fases posteriores

[Q2](q2.md) agrupa imágenes, notas de voz en R2, app SwiftUI y sticky notes de escritorio sincronizadas con la web. Autenticación individual, sincronización de GitHub, notificaciones, WebSockets y ejecución autónoma se evaluarán aparte.
