import { useCallback, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Avatar, Badge, Button, DetailPanel, Field, StatusMessage, TaskRow } from "../components.tsx";
import { es } from "../copy/es.ts";
import { applyTheme, readTheme } from "../theme.ts";
import type { Theme } from "../theme.ts";
import { demoPreset } from "../../config/presets/demo.ts";
import { studioPreset } from "../../config/presets/studio.ts";
import { parseConfiguration } from "../../config/schema.ts";
import licenses from "../assets/THIRD_PARTY_NOTICES.txt?url";
import "../styles/tokens.css";
import "../styles/components.css";
import "./preview.css";

const presets = { demo: parseConfiguration(demoPreset), studio: parseConfiguration(studioPreset) };
interface Example { id: string; title: string; highlighted: boolean; kind: "work" | "feedback" }
const examples: Example[] = [
  { id: "1", title: "Dar espacio a lo importante", highlighted: true, kind: "work" },
  { id: "2", title: "Revisar los últimos detalles", highlighted: false, kind: "work" },
  { id: "3", title: "Compartir el siguiente paso", highlighted: false, kind: "work" },
  { id: "4", title: "Una forma más simple de compartir ideas", highlighted: false, kind: "feedback" },
];

function Preview() {
  const [preset, setPreset] = useState<keyof typeof presets>("demo");
  const config = presets[preset];
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [rows, setRows] = useState(examples);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"work" | "feedback">(() => matchMedia("(max-width: 640px)").matches ? "feedback" : "work");
  const [capture, setCapture] = useState("");
  const [captureError, setCaptureError] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const selected = rows.find((row) => row.id === selectedId);
  const close = useCallback(() => setSelectedId(null), []);
  useLayoutEffect(() => applyTheme(theme), [theme]);
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--accent-light", config.brand.accentLight);
    document.documentElement.style.setProperty("--accent-dark", config.brand.accentDark);
  }, [config]);
  const visible = rows.filter((row) => row.kind === view && row.title.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const highlight = (id: string) => setRows((previous) => previous.map((row) => row.id === id ? { ...row, highlighted: !row.highlighted } : row));

  return <main className="preview">
    <header className="preview__header">
      <div className="wordmark"><svg viewBox="0 0 22 22" width="22" height="22" fill="none" aria-hidden="true"><path d="M4 11l4 4L18 5M4 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg><span>{config.brand.name}</span></div>
      <div className="preview__settings">
        <label className="sr-only" htmlFor="preset">Proyecto de ejemplo</label>
        <select id="preset" value={preset} onChange={(event) => { setPreset(event.target.value as keyof typeof presets); close(); }}>
          <option value="demo">Proyecto demo</option><option value="studio">Estudio editorial</option>
        </select>
        <label className="sr-only" htmlFor="theme">Tema</label>
        <select id="theme" value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
          <option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option>
        </select>
      </div>
    </header>
    <div className="workbench">
      <section className="task-area" aria-label="Ejemplos de componentes">
        <p className="eyebrow">Un poco de claridad</p>
        <h1>{view === "feedback" ? "Las buenas ideas empiezan aquí." : "Lo que viene, con calma."}</h1>
        <p className="intro">Un lugar pequeño para darle forma al siguiente paso.</p>
        <nav className="view-switch" aria-label="Vista de ejemplo">
          <Button aria-pressed={view === "work"} onClick={() => { setView("work"); close(); }}>Trabajo</Button>
          <Button aria-pressed={view === "feedback"} onClick={() => { setView("feedback"); close(); }}>Feedback</Button>
        </nav>
        <form className="capture" noValidate onSubmit={(event) => {
          event.preventDefault();
          if (!capture.trim()) { setCaptureError(true); return; }
          const id = crypto.randomUUID();
          setRows((previous) => [...previous, { id, title: capture.trim(), highlighted: false, kind: view }]);
          setCapture(""); setCaptureError(false); setSelectedId(id); setNotice("");
        }}>
          <span className="capture__plus" aria-hidden="true">+</span>
          <Field label={view === "work" ? es.captureLabel : es.feedbackPrompt} placeholder={view === "work" ? es.capturePlaceholder : es.feedbackPrompt}
            value={capture} onChange={(event) => { setCapture(event.target.value); setCaptureError(false); }} error={captureError ? es.titleRequired : undefined} />
          <Button type="submit" aria-label={view === "work" ? es.createTask : es.feedback}>Añadir</Button>
        </form>
        <div className="list-heading"><span>{view === "work" ? config.statusLabels.todo : "Ideas compartidas"}</span><span>{visible.length}</span></div>
        <ul className="task-list">{visible.map((row, index) => <TaskRow key={row.id} title={row.title}
          code={`${config.project.prefix}-${String(index + 1).padStart(3, "0")}`} meta={config.areas[0]?.label ?? ""}
          assignee={config.members[index % config.members.length]?.name ?? "Equipo"}
          highlighted={row.highlighted} selected={selectedId === row.id} onOpen={() => { setSelectedId(row.id); setNotice(""); }} onHighlight={() => highlight(row.id)} />)}</ul>
        {!visible.length && <StatusMessage title={es.emptyTitle}>{es.emptyDescription}</StatusMessage>}
        <div className="search"><Field label="Buscar en los ejemplos" placeholder="Buscar…" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <footer className="preview__footer"><span>{es.previewNotice}</span><a href={licenses}>Licencias</a></footer>
      </section>
      <DetailPanel open={!!selected} title={selected?.title || "Sin título de ejemplo"} onClose={close}>
        {selected && <>
          <div className="detail-meta"><Badge>{selected.kind === "feedback" ? config.typeLabels.feedback : config.statusLabels.todo}</Badge><Avatar name={config.members[0]?.name ?? "Equipo"} /></div>
          <p>Una idea, un poco de contexto y espacio para conversar. Lo esencial, a mano.</p>
          <Field label="Título de ejemplo" value={selected.title} onChange={(event) => setRows((previous) => previous.map((row) => row.id === selected.id ? { ...row, title: event.target.value } : row))} />
          <Button onClick={() => highlight(selected.id)} aria-pressed={selected.highlighted}>{selected.highlighted ? "Quitar resaltado" : "Resaltar tarea"}</Button>
          <Button variant="primary" onClick={() => setNotice("Ejemplo aplicado en esta vista. No se ha guardado en un servidor.")}>Aplicar ejemplo</Button>
          {notice && <StatusMessage title={notice} />}
        </>}
      </DetailPanel>
    </div>
    <section className="component-notes" aria-label="Otros estados de ejemplo">
      <h2>Otros estados</h2>
      <div className="state-examples"><StatusMessage tone="loading" title="Cargando" />
        <StatusMessage tone="error" title="No se pudo guardar">El texto sigue aquí para volver a intentarlo.</StatusMessage></div>
    </section>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Preview />);
