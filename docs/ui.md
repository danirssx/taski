# Componentes y temas

B2 entrega una base visual reutilizable, con Inter local y superficies neutras. La [dirección aceptada](design-direction.md) se expresa en captura inline, subrayado y detalle lateral. No es la web conectada de B7: la vista usa datos ficticios en memoria y lo indica; no crea tickets en D1 ni tiene llamadas MCP.

## Abrir la vista

```sh
npm ci
npm run ui
```

Abre `http://127.0.0.1:5173`. Puedes crear/editar ejemplos, resaltar filas, abrir el panel derecho y alternar entre presets. Los ejemplos se reinician al recargar. La preferencia de tema sí se conserva en el navegador; no contiene datos del equipo. Worker/D1 siguen arrancando con `npm run dev` en 8787 y no dependen de esta vista.

En móvil se abre Feedback, con menos metadatos y detalle a pantalla completa. En escritorio el panel no bloquea la lista y no atrapa el foco; Escape cierra y devuelve el foco al control que lo abrió. En móvil el panel usa semántica de diálogo y contiene la navegación Tab mientras está abierto.

## Componentes

Se exportan desde [components.tsx](../src/web/components.tsx). Reciben datos y callbacks; no importan configuración, D1, dominio o casos de uso. El presentador de ejemplo es quien guarda su estado temporal.

| Componente | Entradas y eventos | Uso |
| --- | --- | --- |
| Button | Props de botón nativo, variant quiet/primary | type=button por defecto; usa type=submit solo al enviar un formulario. |
| Field | Props de input, label, error/hint | Label asociado, aria-invalid y descripción de error; ID generado si no se pasa. |
| Avatar / Badge | name / children | Identidad textual e indicadores discretos. |
| HighlightToggle | pressed, label, onChange | Estado controlado, aria-pressed y nombre accesible. |
| TaskRow | title, code, meta, assignee, highlighted, selected, onOpen/onHighlight | Fila sin lógica de cambios de estado; el subrayado no transforma el ticket. |
| DetailPanel | open, title, onClose, children | Panel no modal en escritorio, diálogo completo en móvil; gestión de Escape y foco. |
| StatusMessage | tone empty/loading/error, title, children | Mensajes con roles status/alert, sin retirar texto introducido. |

Ejemplo de uso:

```tsx
<TaskRow title={row.title} code={row.code} meta={row.areaLabel}
  assignee={row.assigneeName} highlighted={row.highlighted} selected={isSelected}
  onOpen={() => openDetail(row.id)} onHighlight={() => toggleHighlight(row.id)} />
```

El componente no decide quién puede cerrar tickets ni llama a una base. En B7 los callbacks usarán el cliente HTTP de B5 y reflejarán el resultado confirmado, con estados de carga/error/conflicto.

## Cambiar el tema

[tokens.css](../src/web/styles/tokens.css) define fuente, espaciado, colores semánticos y radios. [components.css](../src/web/styles/components.css) solo consume esos tokens. La vista tiene su layout propio en [preview.css](../src/web/preview/preview.css), separado de los componentes.

`data-theme=light` o `dark` fuerza un tema; `system` usa `color-scheme` y `light-dark()` para seguir al dispositivo. La preferencia se guarda en `taski.theme`; si el almacenamiento está restringido, el tema sigue funcionando en la sesión. Los presets aportan accentLight/accentDark mediante variables CSS; no cambian las reglas de la app.

Para personalizar superficies o foco, cambia tokens como `--canvas`, `--surface`, `--text`, `--muted`, `--focus` y `--highlight`. Comprueba contraste, foco visible y los estados de error en ambos temas. Los textos iniciales de la vista viven en [es.ts](../src/web/copy/es.ts); solo se implementa español.

La marca es un pequeño SVG propio en el presentador; reemplazarla no afecta a `components.tsx`. Inter está alojada localmente; sus avisos y los de React se distribuyen con el bundle. Ver [recursos y licencias](../THIRD_PARTY_NOTICES.md).

## Build y comprobaciones

```sh
npm run check
npm run docs:check
npm exec playwright install chromium
npm run test:ui
```

`check` valida también TypeScript web y produce `dist/web` y `dist/worker`. El Worker no sirve todavía esos assets; la composición/despliegue de la web conectada se implementa después. Las pruebas de navegador son separadas para que el onboarding de Worker/D1 no necesite descargar Chromium. CI instala Chromium y las ejecuta sin secretos.

Las pruebas comprueban interacciones de teclado, panel no modal, foco en móvil, temas/sistema/persistencia, callbacks de resaltado y errores de captura. No sustituyen pruebas en Safari/iPhone físico o evaluación de accesibilidad con lectores de pantalla; esas comprobaciones se mantienen para los bloques de UI/piloto.
