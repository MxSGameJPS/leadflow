"use client";

import { useMemo, useRef, useState } from "react";
import { saveLeadWorkspaceAction } from "../../app/actions/workspaces.js";
import s from "./LeadStrategyMap.module.css";

const NODE_WIDTH = 190;
const NODE_HEIGHT = 88;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 680;

const TYPE_LABEL = {
  lead: "Lead",
  action: "Ação",
  contact: "Contato",
  decision: "Decisão",
  result: "Resultado",
};

const STATUS_LABEL = {
  planned: "Planejado",
  active: "Em andamento",
  done: "Concluído",
  skipped: "Ignorado",
};

function suggestedMap(leadName) {
  return {
    nodes: [
      { id: "lead", title: leadName || "Lead", note: "Ponto de partida da estratégia.", type: "lead", status: "active", x: 40, y: 250 },
      { id: "preview", title: "Prévia pronta", note: "Landing criada e publicada antes da abordagem.", type: "action", status: "planned", x: 290, y: 90 },
      { id: "first_contact", title: "Primeiro contato", note: "Mensagem já levando o link da prévia.", type: "contact", status: "planned", x: 290, y: 310 },
      { id: "reaction", title: "Resposta do lead?", note: "Escolha o próximo caminho conforme a reação.", type: "decision", status: "planned", x: 570, y: 310 },
      { id: "interested", title: "Demonstrou interesse", note: "Entender necessidade e marcar conversa.", type: "result", status: "planned", x: 860, y: 125 },
      { id: "followup", title: "Sem resposta / follow-up", note: "Retomar com contexto, sem repetir a abordagem inicial.", type: "action", status: "planned", x: 860, y: 420 },
    ],
    edges: [
      { id: "e_lead_preview", from: "lead", to: "preview" },
      { id: "e_preview_contact", from: "preview", to: "first_contact" },
      { id: "e_contact_reaction", from: "first_contact", to: "reaction" },
      { id: "e_reaction_interested", from: "reaction", to: "interested" },
      { id: "e_reaction_followup", from: "reaction", to: "followup" },
    ],
  };
}

function prepareMap(input, leadName) {
  if (input?.nodes?.length) {
    return {
      nodes: input.nodes.map(node => ({ ...node })),
      edges: (input.edges || []).map(edge => ({ ...edge })),
    };
  }
  return suggestedMap(leadName);
}

function nextNodePosition(nodes) {
  const index = nodes.length;
  return {
    x: 70 + (index % 4) * 250,
    y: 70 + (Math.floor(index / 4) % 5) * 125,
  };
}

export default function LeadStrategyMap({ leadId, leadName, initialMap, onSaved }) {
  const [map, setMap] = useState(() => prepareMap(initialMap, leadName));
  const [selectedId, setSelectedId] = useState(() => map.nodes[0]?.id || "");
  const [connectFrom, setConnectFrom] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("action");
  const [dirty, setDirty] = useState(!initialMap?.nodes?.length);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const dragRef = useRef(null);

  const selected = useMemo(() => map.nodes.find(node => node.id === selectedId) || null, [map.nodes, selectedId]);

  function updateNode(id, patch) {
    setMap(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, ...patch } : node) }));
    setDirty(true);
  }

  function addNode(event) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const position = nextNodePosition(map.nodes);
    const id = "node_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    setMap(current => ({ ...current, nodes: [...current.nodes, { id, title, note: "", type: newType, status: "planned", ...position }] }));
    setSelectedId(id);
    setNewTitle("");
    setDirty(true);
  }

  function removeNode(id) {
    setMap(current => ({
      nodes: current.nodes.filter(node => node.id !== id),
      edges: current.edges.filter(edge => edge.from !== id && edge.to !== id),
    }));
    setSelectedId(current => current === id ? "" : current);
    setConnectFrom(current => current === id ? "" : current);
    setDirty(true);
  }

  function handleConnector(id) {
    if (!connectFrom) {
      setConnectFrom(id);
      setNotice("Agora clique no conector da fase de destino.");
      return;
    }
    if (connectFrom === id) {
      setConnectFrom("");
      setNotice("");
      return;
    }
    const exists = map.edges.some(edge => edge.from === connectFrom && edge.to === id);
    if (!exists) {
      const edge = { id: "edge_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 5), from: connectFrom, to: id };
      setMap(current => ({ ...current, edges: [...current.edges, edge] }));
      setDirty(true);
    }
    setConnectFrom("");
    setNotice("");
  }

  function removeEdge(id) {
    setMap(current => ({ ...current, edges: current.edges.filter(edge => edge.id !== id) }));
    setDirty(true);
  }

  function pointerDown(event, node) {
    if (event.button !== 0) return;
    setSelectedId(node.id);
    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: node.x,
      nodeY: node.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function pointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, drag.nodeX + event.clientX - drag.startX));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, drag.nodeY + event.clientY - drag.startY));
    setMap(current => ({ ...current, nodes: current.nodes.map(node => node.id === drag.id ? { ...node, x: Math.round(x), y: Math.round(y) } : node) }));
    setDirty(true);
  }

  function pointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  async function saveMap() {
    setSaving(true);
    setNotice("");
    try {
      const saved = await saveLeadWorkspaceAction(leadId, { strategyMap: map });
      setMap(saved.strategyMap);
      setDirty(false);
      setNotice("Mapa estratégico salvo.");
      onSaved?.(saved.strategyMap);
    } catch (error) {
      setNotice("Erro: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  function resetSuggested() {
    if (!window.confirm("Substituir o mapa atual pela estratégia sugerida?")) return;
    const next = suggestedMap(leadName);
    setMap(next);
    setSelectedId(next.nodes[0]?.id || "");
    setConnectFrom("");
    setDirty(true);
  }

  return <div className={s.wrapper}>
    <div className={s.toolbar}>
      <form onSubmit={addNode}>
        <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Nova fase da estratégia..." />
        <select value={newType} onChange={event => setNewType(event.target.value)}>
          <option value="action">Ação</option>
          <option value="contact">Contato</option>
          <option value="decision">Decisão</option>
          <option value="result">Resultado</option>
        </select>
        <button className={s.addButton}>+ Adicionar fase</button>
      </form>
      <div className={s.toolbarActions}>
        <span className={dirty ? s.unsaved : s.saved}>{dirty ? "Alterações não salvas" : "Tudo salvo"}</span>
        <button type="button" onClick={resetSuggested}>Restaurar sugestão</button>
        <button type="button" className={s.saveButton} disabled={saving || !dirty} onClick={saveMap}>{saving ? "Salvando..." : "Salvar mapa"}</button>
      </div>
    </div>

    {notice && <div className={notice.startsWith("Erro") ? s.error : s.notice}>{notice}</div>}

    <div className={s.layout}>
      <div className={s.canvasViewport}>
        <div className={s.canvas} style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
          <svg className={s.edges} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} aria-hidden="true">
            {map.edges.map(edge => {
              const from = map.nodes.find(node => node.id === edge.from);
              const to = map.nodes.find(node => node.id === edge.to);
              if (!from || !to) return null;
              const sx = from.x + NODE_WIDTH;
              const sy = from.y + NODE_HEIGHT / 2;
              const tx = to.x;
              const ty = to.y + NODE_HEIGHT / 2;
              const bend = Math.max(70, Math.abs(tx - sx) * .45);
              const direction = tx >= sx ? 1 : -1;
              const d = `M ${sx} ${sy} C ${sx + bend * direction} ${sy}, ${tx - bend * direction} ${ty}, ${tx} ${ty}`;
              return <g key={edge.id}>
                <path className={s.edgeLine} d={d} />
                <path className={s.edgeHit} d={d} onClick={() => removeEdge(edge.id)} />
              </g>;
            })}
          </svg>

          {map.nodes.map(node => <article
            key={node.id}
            className={`${s.node} ${s["type_" + node.type]} ${s["status_" + node.status]} ${selectedId === node.id ? s.nodeSelected : ""}`}
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            onPointerDown={event => pointerDown(event, node)}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
          >
            <div className={s.nodeTop}><span>{TYPE_LABEL[node.type] || "Fase"}</span><b>{STATUS_LABEL[node.status] || node.status}</b></div>
            <h4>{node.title}</h4>
            {node.note && <p>{node.note}</p>}
            <button
              type="button"
              className={`${s.connector} ${connectFrom === node.id ? s.connectorActive : ""}`}
              title={connectFrom === node.id ? "Cancelar conexão" : "Conectar esta fase"}
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); handleConnector(node.id); }}
            >●</button>
          </article>)}
        </div>
      </div>

      <aside className={s.inspector}>
        <div><span className={s.inspectorEyebrow}>Editor da fase</span><h3>{selected ? selected.title : "Selecione um bloco"}</h3></div>
        {selected ? <>
          <label><span>Título</span><input value={selected.title} onChange={event => updateNode(selected.id, { title: event.target.value })} /></label>
          <label><span>Tipo</span><select value={selected.type} onChange={event => updateNode(selected.id, { type: event.target.value })}><option value="lead">Lead</option><option value="action">Ação</option><option value="contact">Contato</option><option value="decision">Decisão</option><option value="result">Resultado</option></select></label>
          <label><span>Status</span><select value={selected.status} onChange={event => updateNode(selected.id, { status: event.target.value })}><option value="planned">Planejado</option><option value="active">Em andamento</option><option value="done">Concluído</option><option value="skipped">Ignorado</option></select></label>
          <label><span>Anotações</span><textarea value={selected.note || ""} onChange={event => updateNode(selected.id, { note: event.target.value })} placeholder="O que aconteceu nesta fase? Qual será o próximo passo?" /></label>
          <div className={s.connectionHelp}><strong>Conectar fases</strong><p>Clique no círculo de uma fase e depois no círculo da fase de destino. Clique em uma linha para removê-la.</p></div>
          {selected.type !== "lead" && <button type="button" className={s.deleteButton} onClick={() => removeNode(selected.id)}>Excluir fase</button>}
        </> : <p className={s.emptyInspector}>Clique em qualquer fase do mapa para editar seus dados.</p>}
      </aside>
    </div>
  </div>;
}
