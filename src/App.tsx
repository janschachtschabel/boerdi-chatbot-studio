import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, addEdge, Background, Controls, MiniMap,
  useReactFlow, ConnectionLineType, type Connection, type Edge, type Node, type ReactFlowInstance,
} from 'reactflow';
import {
  Download, Upload, Printer, LayoutTemplate,
  FileDown, ChevronDown, Info, X, HelpCircle, ChevronUp,
  Play, Wand2, Loader2,
} from 'lucide-react';
import type { NodeData, PersonaConfig, BotConfig, FlowTemplate, DockedTool } from './types';
import { PALETTE_GROUPS, NODE_COLORS, NODE_LABELS, NODE_TYPE_MAP, DEFAULT_BOT_CONFIG, DEFAULT_PERSONAS } from './types';
import { nodeTypes } from './nodeTypes';
import PropertiesPanel from './PropertiesPanel';
import FlowPreview from './FlowPreview';
import { exportToYaml, exportPersonaFiles, importFromYaml, buildPrintText } from './yamlUtils';
import { ALL_TEMPLATES } from './templates';

const ENV_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? '';

// ── Sidebar Help panel ────────────────────────────────────────────────────────

const HELP_ENTRIES: { emoji: string; label: string; text: string }[] = [
  { emoji: '💬', label: 'Nachricht',    text: 'Bot sendet einen Text – z.B. Begrüßung, FAQ-Antwort oder Kontaktinfo. Persona-Varianten erlauben unterschiedliche Formulierungen je Rolle.' },
  { emoji: '✏️', label: 'Eingabe',      text: 'User tippt Freitext. Die Antwort wird als Variable gespeichert ({{ profile.feldname }}) und kann später in Nachrichten oder KI-Anfragen genutzt werden.' },
  { emoji: '🗨️', label: 'Freier Chat',  text: 'KI-Dialog ohne festes Skript. MCP-Toggle aktiviert die WLO-Suche – die KI kann dann Bildungsressourcen suchen und einbinden.' },
  { emoji: '�️', label: 'Auswahl',      text: 'User klickt einen Button. Jede Option kann eine Persona aktivieren und zu einem bestimmten Schritt, Neustart oder Schritt-zurück führen.' },
  { emoji: '🔀', label: 'KI-Weiche',    text: 'Die KI analysiert die Eingabe des Users und leitet zum passenden Zweig. Beschreibt jeden Zweig in einfachen Worten – kein Code nötig.' },
];

function SidebarHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle size={12} /> Knotenhilfe
        </span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto px-2 pb-2 space-y-1.5">
          {HELP_ENTRIES.map(e => (
            <div key={e.label} className="bg-gray-50 rounded-md px-2 py-1.5">
              <p className="text-[10px] font-semibold text-gray-700">{e.emoji} {e.label}</p>
              <p className="text-[9px] text-gray-500 leading-snug mt-0.5">{e.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App (inner, needs ReactFlowProvider from main.tsx) ──────────────────

export default function App() {
  const firstTemplate = ALL_TEMPLATES[0];
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(firstTemplate.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(firstTemplate.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaConfig[]>(firstTemplate.personas);
  const [botConfig, setBotConfig] = useState<BotConfig>(firstTemplate.botConfig);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  let nodeIdCounter = useRef(5000);

  const newNodeId = () => `node-${++nodeIdCounter.current}`;

  // ── Connections ─────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds)),
    [setEdges],
  );

  // ── Node selection ──────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  // ── Update node data ────────────────────────────────────────────────────────
  const onUpdateNode = useCallback((nodeId: string, patch: Partial<NodeData>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]);

  // ── Delete selected node ─────────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, selectedNodeId]);

  // ── postMessage bridge for iframe embedding (admin-dashboard) ───────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'YAML_IMPORT' && typeof e.data.yaml === 'string') {
        try {
          const result = importFromYaml(e.data.yaml);
          setNodes(result.nodes);
          setEdges(result.edges);
          setPersonas(result.personas);
          setBotConfig(result.botConfig);
        } catch (err) {
          console.error('postMessage YAML_IMPORT failed:', err);
        }
      }
      if (e.data?.type === 'YAML_EXPORT_REQUEST') {
        try {
          const yamlStr = exportToYaml(nodes, edges, personas, botConfig);
          (e.source as Window)?.postMessage({ type: 'YAML_EXPORT', yaml: yamlStr }, '*');
        } catch (err) {
          console.error('postMessage YAML_EXPORT failed:', err);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [nodes, edges, personas, botConfig, setNodes, setEdges]);

  // ── Drag & Drop from palette ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const stepType = e.dataTransfer.getData('application/boerdi-node') as NodeData['stepType'];
    if (!stepType) return;

    const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const nodeId = newNodeId();

    // ── Dock detection: tool/persona dropped onto a workflow node? ──────────
    const dockableTypes: NodeData['stepType'][] = ['tool_mcp', 'tool_rag', 'persona_set'];
    const workflowTypes: NodeData['stepType'][] = ['message', 'choice', 'input', 'chat'];

    if (dockableTypes.includes(stepType)) {
      const targetParent = nodes.find(n => {
        if (!workflowTypes.includes(n.data.stepType)) return false;
        const nx = n.position.x, ny = n.position.y;
        return dropPos.x >= nx && dropPos.x <= nx + 280 && dropPos.y >= ny && dropPos.y <= ny + 280;
      });

      if (targetParent) {
        const stepId = `${stepType}_${nodeId.slice(-3)}`;
        if (stepType === 'persona_set') {
          setNodes(nds => nds.map(n => n.id !== targetParent.id ? n : {
            ...n, data: { ...n.data, dockedPersona: { personaMode: 'set' as const } },
          }));
          setSelectedNodeId(targetParent.id);
        } else {
          const newTool: DockedTool = {
            stepId,
            stepType: stepType as 'tool_mcp' | 'tool_rag',
          };
          setNodes(nds => nds.map(n => n.id !== targetParent.id ? n : {
            ...n, data: {
              ...n.data,
              dockedTools: [...(n.data.dockedTools ?? []), newTool],
            },
          }));
          setSelectedNodeId(targetParent.id);
        }
        return;
      }
    }

    // Default: standalone node on canvas
    const data: NodeData = { stepType, stepId: `${stepType}_${nodeId.slice(-3)}` };
    setNodes(nds => [...nds, {
      id: nodeId,
      type: NODE_TYPE_MAP[stepType],
      position: dropPos,
      data,
    }]);
    setSelectedNodeId(nodeId);
  }, [nodes, screenToFlowPosition, setNodes]);

  // ── Load template ───────────────────────────────────────────────────────────
  const loadTemplate = (tpl: FlowTemplate) => {
    setNodes(tpl.nodes as Node<NodeData>[]);
    setEdges(tpl.edges);
    setPersonas(tpl.personas);
    setBotConfig(tpl.botConfig);
    setSelectedNodeId(null);
    setShowTemplateModal(false);
    setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 400 }), 100);
  };

  // ── Export YAML + personas ──────────────────────────────────────────────────
  const slug = botConfig.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'boerdi';

  const downloadYaml = () => {
    const yamlStr = exportToYaml(nodes, edges, personas, botConfig);
    const blob = new Blob([yamlStr], { type: 'text/yaml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-config.yml`;
    a.click();
  };

  const downloadPersonas = async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const folder = zip.folder('personas')!;
    const files = exportPersonaFiles(personas);
    Object.entries(files).forEach(([name, content]) => folder.file(name, content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'personas.zip';
    a.click();
  };

  const downloadAll = async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    // Each flow lives in its own subfolder: flows/{slug}/
    // Unzip to boerdi/src/assets/ → creates assets/flows/{slug}/config.yml
    //                                              assets/flows/{slug}/personas/*.md
    const flowFolder = zip.folder(`flows/${slug}`)!;
    const personaFolderPath = 'personas';  // relative inside the flow folder
    const yamlStr = exportToYaml(nodes, edges, personas, botConfig, personaFolderPath);
    flowFolder.file('config.yml', yamlStr);
    const personasFolder = flowFolder.folder('personas')!;
    Object.entries(exportPersonaFiles(personas)).forEach(([n, c]) => personasFolder.file(n, c));
    zip.file('README.md', [
      `# ${botConfig.avatar} ${botConfig.name} – Boerdi Flow Bundle`,
      '',
      '## Drop-in-Anleitung für Boerdi',
      '',
      '**Schritt 1** – Inhalt dieses ZIPs in `boerdi/src/assets/` entpacken:',
      '```',
      `assets/flows/${slug}/config.yml`,
      `assets/flows/${slug}/personas/persona1.md`,
      `assets/flows/${slug}/personas/…`,
      '```',
      '',
      '**Schritt 2** – In `boerdi/src/assets/boerdi-config.yml` unter `flows:` eintragen:',
      '```yaml',
      'flows:',
      `  - id: ${slug}`,
      `    name: "${botConfig.avatar} ${botConfig.name}"`,
      `    configFile: "assets/flows/${slug}/config.yml"`,
      '  # default: true  ← auskommentieren um diesen Flow direkt zu starten',
      '```',
      '',
      '**Schritt 3** – Boerdi neu bauen (dev: `ng serve`, prod: `ng build`).',
      '',
      '## Mehrere Flows parallel',
      `Jeder Flow liegt in \`assets/flows/{slug}/\` –`,
      'keine Namenskonflikte zwischen Persona-Dateien verschiedener Flows möglich.',
      '',
      '## Nur YAML (ohne .md-Dateien)',
      `\`flows/${slug}/config.yml\` enthält alle System-Prompts bereits inline.`,
      'Du kannst die ZIP ohne den personas/-Ordner verwenden.',
      '',
      '## Enthaltene Dateien',
      `- \`flows/${slug}/config.yml\` – Flow-Konfiguration mit inline System-Prompts`,
      `- \`flows/${slug}/personas/*.md\` – Editierbare Persona-Prompts (optional, überschreiben inline)`,
    ].join('\n'));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${slug}-export.zip`;
    a.click();
  };

  // ── Import YAML ─────────────────────────────────────────────────────────────
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { nodes: n, edges: ed, personas: p, botConfig: bc } = importFromYaml(ev.target!.result as string);
        setNodes(n as Node<NodeData>[]);
        setEdges(ed);
        setPersonas(p.length ? p : DEFAULT_PERSONAS);
        setBotConfig(bc);
        setSelectedNodeId(null);
        setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 400 }), 100);
      } catch (err) {
        alert('Fehler beim Einlesen der YAML-Datei: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── AI Flow Generator ─────────────────────────────────────────────────────
  const resolvedApiKey = ENV_KEY || botConfig.apiKey || '';

  const generateAiFlow = async (description: string) => {
    if (!resolvedApiKey || !description.trim()) return;
    setAiLoading(true);
    setAiError(null);

    const SYSTEM_PROMPT = `Du bist ein Flow-Architekt fuer Boerdi, einen deutschen Bildungs-Chatbot.
Generiere einen vollstaendigen Gespraeches-Flow als JSON.

Verfuegbare Knotentypen:
- message: Bot zeigt Text. Felder: id, type, message, next
- choice: Auswahlbuttons. Felder: id, type, message, options([{label,value,next,persona?}]), next?
- input: Freitext-Eingabe. Felder: id, type, message, field, placeholder?, next, suggestions?
- chat: Offener KI-Dialog mit optionalen Tools. Felder: id, type, message, suggestions?, useMcp?(true/false), personaId?
- gateway: KI-Weiche. Felder: id, type, message?, splitBy("ai_intent"), branches([{label,next,intentDescription}]), default

JSON-Ausgabe-Schema (NUR JSON, kein Markdown):
{
  "bot": {"name":"string","avatar":"emoji","tagline":"string"},
  "personas": [{"id":"string","label":"string","systemPrompt":"string (200-400 Wörter auf Deutsch)"}],
  "defaultPersona": "persona_id oder null",
  "steps": [
    {"id":"step_id","type":"...","message":"...","next":"step_id_oder_null",
     "options":[{"label":"...","value":"...","next":"step_id","persona":"persona_id_oder_null"}],
     "field":"...","placeholder":"...","suggestions":["..."],
     "splitBy":"ai_intent","branches":[{"label":"...","next":"step_id","intentDescription":"..."}],
     "default":"step_id","useMcp":true,"personaId":"persona_id_oder_null"}
  ],
  "startStepId": "erster_step_id"
}
Regeln:
- Alle Texte auf Deutsch
- step-IDs: kurz, snake_case
- Jeder step braucht eine eindeutige id
- chat-Schritte sind Endpunkte (kein next)
- systemPrompt: Detaillierter Charakter- und Aufgabenbeschreibung fuer den Bot
- Variablen aus input-Schritten koennen in Nachrichten mit {{field_name}} referenziert werden (z.B. "Ich suche Materialien zum Thema {{topic}}" wenn das input-step field="topic" hatte)
- Der systemPrompt von chat-Schritten sollte alle gesammelten Variablen explizit erwaehnen damit der LLM sie kennt`;

    try {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolvedApiKey}` },
        body: JSON.stringify({
          model: botConfig.apiModel || 'gpt-4.1',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: description },
          ],
          response_format: { type: 'json_object' },
        }),
      });
      if (!resp.ok) throw new Error(`OpenAI ${resp.status}: ${await resp.text()}`);
      const data = await resp.json();
      const raw = JSON.parse(data.choices[0]?.message?.content ?? '{}');

      // ── Convert to ReactFlow nodes + edges ───────────────────────────────
      const steps: any[] = raw.steps ?? [];
      const startId = raw.startStepId ?? steps[0]?.id;
      const newPersonas: PersonaConfig[] = (raw.personas ?? []).map((p: any) => ({
        id: p.id, label: p.label, uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',
        systemPrompt: p.systemPrompt ?? '',
      }));
      const newBotConfig: BotConfig = {
        ...botConfig,
        name: raw.bot?.name ?? botConfig.name,
        avatar: raw.bot?.avatar ?? botConfig.avatar,
        tagline: raw.bot?.tagline ?? botConfig.tagline,
        defaultPersona: raw.defaultPersona ?? undefined,
      };

      // Position: BFS layout
      const posMap: Record<string, { x: number; y: number }> = {};
      const visited = new Set<string>();
      const queue: Array<{ id: string; col: number; row: number }> = [{ id: startId, col: 0, row: 0 }];
      const colRows: Record<number, number> = {};
      while (queue.length > 0) {
        const { id, col } = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const row = colRows[col] ?? 0;
        colRows[col] = row + 1;
        posMap[id] = { x: 80 + col * 380, y: 150 + row * 220 };
        const step = steps.find((s: any) => s.id === id);
        if (!step) continue;
        const nexts: string[] = [];
        if (step.next) nexts.push(step.next);
        if (step.options) step.options.forEach((o: any) => { if (o.next && !nexts.includes(o.next)) nexts.push(o.next); });
        if (step.branches) step.branches.forEach((b: any) => { if (b.next && !nexts.includes(b.next)) nexts.push(b.next); });
        if (step.default && !nexts.includes(step.default)) nexts.push(step.default);
        nexts.forEach(nid => { if (!visited.has(nid)) queue.push({ id: nid, col: col + 1, row: colRows[col + 1] ?? 0 }); });
      }
      // Place any unvisited steps
      steps.forEach((s: any, i: number) => {
        if (!posMap[s.id]) posMap[s.id] = { x: 80 + (Object.keys(posMap).length) * 380, y: 150 };
      });

      // Build ReactFlow nodes
      const newNodes: Node<NodeData>[] = [];
      // Start node
      const startNodeId = `node-start-${Date.now()}`;
      newNodes.push({ id: startNodeId, type: 'start', position: { x: (posMap[startId]?.x ?? 0) - 200, y: posMap[startId]?.y ?? 150 }, data: { stepId: 'start', stepType: 'start' as const } });
      const stepNodeIds: Record<string, string> = {};

      steps.forEach((s: any, i: number) => {
        const nid = `node-ai-${Date.now()}-${i}`;
        stepNodeIds[s.id] = nid;
        const pos = posMap[s.id] ?? { x: 80 + i * 380, y: 150 };
        const typeMap: Record<string, NodeData['stepType']> = { message: 'message', choice: 'choice', input: 'input', chat: 'chat', gateway: 'gateway' };
        const stepType = typeMap[s.type] ?? 'message';
        const nodeData: NodeData = {
          stepId: s.id,
          stepType,
          message: s.message ?? '',
          options: s.options,
          field: s.field,
          placeholder: s.placeholder,
          suggestions: s.suggestions,
          splitBy: s.splitBy,
          branches: s.branches,
        };
        if (s.useMcp) nodeData.dockedTools = [{ stepId: 'mcp_wlo', stepType: 'tool_mcp' as const }];
        if (s.personaId) nodeData.dockedPersona = { personaMode: 'set', personaId: s.personaId };
        newNodes.push({ id: nid, type: NODE_TYPE_MAP[stepType] ?? stepType, position: pos, data: nodeData });
      });

      // Build edges
      const newEdges: Edge[] = [];
      let edgeId = 0;
      // Start → first step
      if (stepNodeIds[startId]) {
        newEdges.push({ id: `e-start-${edgeId++}`, source: startNodeId, target: stepNodeIds[startId], type: 'smoothstep' });
      }
      steps.forEach((s: any) => {
        const src = stepNodeIds[s.id];
        if (!src) return;
        if (s.next && stepNodeIds[s.next]) {
          newEdges.push({ id: `e-${edgeId++}`, source: src, target: stepNodeIds[s.next], type: 'smoothstep' });
        }
        (s.options ?? []).forEach((o: any) => {
          if (o.next && stepNodeIds[o.next]) {
            newEdges.push({ id: `e-${edgeId++}`, source: src, target: stepNodeIds[o.next], label: o.value, type: 'smoothstep' });
          }
        });
        (s.branches ?? []).forEach((b: any) => {
          if (b.next && stepNodeIds[b.next]) {
            newEdges.push({ id: `e-${edgeId++}`, source: src, target: stepNodeIds[b.next], label: b.label, type: 'smoothstep' });
          }
        });
        if (s.default && stepNodeIds[s.default]) {
          newEdges.push({ id: `e-default-${edgeId++}`, source: src, target: stepNodeIds[s.default], sourceHandle: 'default', label: 'Standard', type: 'smoothstep', style: { strokeDasharray: '5 4' } });
        }
      });

      setNodes(newNodes);
      setEdges(newEdges);
      setPersonas(newPersonas.length ? newPersonas : DEFAULT_PERSONAS);
      setBotConfig(newBotConfig);
      setSelectedNodeId(null);
      setShowAiBuilder(false);
      setTimeout(() => rfInstance?.fitView({ padding: 0.12, duration: 500 }), 100);
    } catch (e: any) {
      setAiError(`Fehler: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Print / human-readable ──────────────────────────────────────────────────
  const openPrint = () => {
    setPrintContent(buildPrintText(nodes, edges, botConfig));
    setShowPrintModal(true);
  };

  const triggerPrint = () => window.print();

  // ── Fit view on load ────────────────────────────────────────────────────────
  const onInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
    setTimeout(() => instance.fitView({ padding: 0.1, duration: 300 }), 100);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── HEADER ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm z-10 no-print">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xl">🦉</span>
          <div>
            <span className="font-bold text-gray-800 text-sm">Boerdi Flow Studio</span>
            <span className="text-gray-400 text-xs ml-1">– visueller Flow-Editor</span>
          </div>
        </div>

        {/* Templates */}
        <button onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 font-medium">
          <LayoutTemplate size={13} /> Vorlagen <ChevronDown size={11} />
        </button>

        {/* AI Builder */}
        <button onClick={() => { setShowAiBuilder(true); setAiError(null); }}
          className="flex items-center gap-1.5 text-xs bg-violet-50 text-violet-700 border border-violet-200 rounded-lg px-3 py-1.5 hover:bg-violet-100 font-medium">
          <Wand2 size={13} /> KI-Generator
        </button>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {/* Import */}
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 font-medium">
          <Upload size={13} /> YAML importieren
        </button>
        <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={onImportFile} />

        <div className="flex-1" />

        {/* Selected node info */}
        {selectedNode && (
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${NODE_COLORS[selectedNode.data.stepType]?.header ?? 'bg-gray-500'} text-white`}>
            <span>{NODE_LABELS[selectedNode.data.stepType]}</span>
            <span className="opacity-70">#{selectedNode.data.stepId}</span>
            <button onClick={deleteSelected} className="ml-1 opacity-70 hover:opacity-100"><X size={11} /></button>
          </div>
        )}

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {/* Print */}
        <button onClick={openPrint}
          className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 font-medium">
          <Printer size={13} /> Drucken / Lesen
        </button>

        {/* Preview toggle */}
        <button onClick={() => setShowPreview(v => !v)}
          className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 font-medium border transition-all ${
            showPreview
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
          }`}>
          <Play size={12} /> {showPreview ? 'Vorschau aktiv' : 'Vorschau'}
        </button>

        {/* Export */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 font-medium">
            <FileDown size={13} /> Exportieren <ChevronDown size={11} />
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-50 w-48">
            <button onClick={downloadYaml} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
              <Download size={12} /> Nur YAML ({slug}-config.yml)
            </button>
            <button onClick={downloadPersonas} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
              <Download size={12} /> Nur Personas (.zip)
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={downloadAll} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-semibold text-emerald-700">
              <Download size={12} /> Bundle für Boerdi (.zip)
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Node Palette ── */}
        <aside className="flex flex-col bg-white border-r border-gray-200 no-print" style={{ width: 176 }}>
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50">
            <p className="text-[11px] font-bold text-gray-600">Gesprächsbausteine</p>
            <p className="text-[9px] text-gray-400">Auf die Fläche ziehen</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {PALETTE_GROUPS[0].items.map(({ type, emoji, desc }) => (
              <div
                key={type}
                draggable
                onDragStart={e => {
                  e.dataTransfer.setData('application/boerdi-node', type);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm hover:scale-[1.01] ${NODE_COLORS[type].bg} ${NODE_COLORS[type].border}`}
              >
                <span className="text-base leading-none flex-shrink-0">{emoji}</span>
                <div className="min-w-0">
                  <p className={`text-[11px] font-semibold leading-tight ${NODE_COLORS[type].header.replace('bg-', 'text-').replace(/-[0-9]+$/, '-700')}`}>
                    {NODE_LABELS[type]}
                  </p>
                  <p className="text-[9px] text-gray-400 leading-snug mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Help panel ── */}
          <SidebarHelp />
        </aside>

        {/* ── CENTER: React Flow Canvas ── */}
        <div className="flex-1 relative" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onInit={onInit}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{ type: 'smoothstep', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } }}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!shadow-md" />
            <MiniMap
              nodeColor={n => {
                const st = (n.data as NodeData).stepType;
                const colorMap: Record<string, string> = {
                  message: '#2563eb', choice: '#4f46e5', input: '#0284c7', chat: '#1e40af',
                  gateway: '#f59e0b',
                  tool_mcp: '#0f766e', tool_rag: '#0d9488',
                  persona_set: '#9333ea',
                };
                return colorMap[st] ?? '#94a3b8';
              }}
              className="!shadow-md !rounded-lg"
            />
            {/* Empty state hint */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400">
                  <p className="text-4xl mb-2">🦉</p>
                  <p className="text-sm font-medium">Knoten aus der Palette ziehen</p>
                  <p className="text-xs">oder eine Vorlage laden</p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>

        {/* ── RIGHT: Properties Panel or Live Preview ── */}
        {showPreview ? (
          <FlowPreview
            nodes={nodes}
            edges={edges}
            personas={personas}
            botConfig={botConfig}
            onClose={() => setShowPreview(false)}
          />
        ) : (
          <PropertiesPanel
            node={selectedNode}
            personas={personas}
            botConfig={botConfig}
            onUpdateNode={onUpdateNode}
            onUpdatePersonas={setPersonas}
            onUpdateBotConfig={setBotConfig}
          />
        )}
      </div>

      {/* ── AI BUILDER MODAL ── */}
      {showAiBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-violet-600" />
                <h2 className="text-base font-bold text-gray-800">KI-Flow-Generator</h2>
              </div>
              <button onClick={() => setShowAiBuilder(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              <p className="text-xs text-gray-500">
                Beschreibe deinen Wunschablauf in natürlicher Sprache. Die KI erstellt daraus einen vollständigen Flow mit Knoten, Verbindungen und Personas.
              </p>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 mb-1 block">Was soll der Bot tun?</label>
                <textarea
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 resize-none"
                  rows={8}
                  placeholder={`Beispiel:\n\nIch brauche einen Bildungsbot der zuerst fragt ob man Lehrer oder Schüler ist. Lehrkräfte können dann ihr Fach und Thema eingeben und der Bot sucht Unterrichtsmaterialien. Schüler werden direkt zu einem offenen Chat weitergeleitet wo sie nach Lernmaterial fragen können.`}
                  value={aiText}
                  onChange={e => setAiText(e.target.value)}
                />
              </div>
              {!resolvedApiKey && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700">
                  ⚠️ Kein API-Schlüssel – <code>VITE_OPENAI_API_KEY</code> setzen oder im Bot-Tab eintragen.
                </div>
              )}
              {ENV_KEY && (
                <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-[10px] text-green-700">
                  ✅ API-Schlüssel aus Umgebungsvariable aktiv.
                </div>
              )}
              {aiError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-600">
                  {aiError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t flex-shrink-0">
              <button onClick={() => setShowAiBuilder(false)}
                className="text-xs text-gray-500 hover:text-gray-700 px-4 py-2">Abbrechen</button>
              <button
                onClick={() => generateAiFlow(aiText)}
                disabled={!aiText.trim() || aiLoading || !resolvedApiKey}
                className="flex items-center gap-2 text-xs bg-violet-600 text-white rounded-lg px-5 py-2 hover:bg-violet-700 disabled:opacity-40 font-medium">
                {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                {aiLoading ? 'Generiere…' : 'Flow generieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE MODAL ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-gray-800">Vorlage laden</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-3">
              {ALL_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => loadTemplate(tpl)}
                  className="flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
                  <span className="text-3xl leading-none">{tpl.botConfig.avatar}</span>
                  <div>
                    <p className="font-semibold text-gray-800 group-hover:text-indigo-700 text-sm">{tpl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{tpl.nodes.length} Knoten · {tpl.personas.length} Personas</p>
                  </div>
                </button>
              ))}
              <button onClick={() => { setNodes([]); setEdges([]); setPersonas(DEFAULT_PERSONAS); setBotConfig(DEFAULT_BOT_CONFIG); setSelectedNodeId(null); setShowTemplateModal(false); }}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50 text-left transition-all group">
                <span className="text-3xl leading-none">➕</span>
                <div>
                  <p className="font-semibold text-gray-600 group-hover:text-red-600 text-sm">Leerer Flow</p>
                  <p className="text-xs text-gray-400">Mit einem leeren Canvas starten</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT / READABLE VIEW MODAL ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '90%', maxWidth: 800, height: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800">Flow-Dokumentation (lesbare Ansicht)</h2>
              <div className="flex items-center gap-2">
                <button onClick={triggerPrint}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700">
                  <Printer size={12} /> Drucken
                </button>
                <button onClick={() => {
                  const blob = new Blob([printContent], { type: 'text/markdown' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flow-dokumentation.md'; a.click();
                }} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-200">
                  <FileDown size={12} /> .md herunterladen
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600 ml-2"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap text-xs font-mono text-gray-700 leading-relaxed print-only-content">
                {printContent}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM STATUS BAR ── */}
      <footer className="flex items-center gap-4 px-4 py-1.5 bg-white border-t border-gray-200 text-[10px] text-gray-400 no-print">
        <span>🦉 Boerdi Flow Studio</span>
        <span>·</span>
        <span>{nodes.length} Knoten</span>
        <span>·</span>
        <span>{edges.length} Verbindungen</span>
        <span>·</span>
        <span>{personas.length} Personas</span>
        <span>·</span>
        <span>{botConfig.name} {botConfig.avatar}</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1 text-blue-400">
          <Info size={10} /> Klicken zum Auswählen · Drag für Verbindungen · Del zum Löschen
        </span>
      </footer>
    </div>
  );
}
