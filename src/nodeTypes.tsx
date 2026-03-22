import React, { useCallback } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import type { NodeData, DockedTool, DockedPersona } from './types';
import { NODE_COLORS, NODE_LABELS } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function truncate(s: string | undefined, n = 60) {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const InHandle = () => (
  <Handle type="target" position={Position.Left} id="in"
    style={{ left: -6, top: '50%', transform: 'translateY(-50%)' }} />
);
const OutHandle = ({ id = 'out', top = '50%' }: { id?: string; top?: string }) => (
  <Handle type="source" position={Position.Right} id={id}
    style={{ right: -6, top, transform: 'translateY(-50%)' }} />
);

// ── Inline dock components ────────────────────────────────────────────────

function DockedPersonaBadge({ persona, onRemove }: { persona: DockedPersona; onRemove: () => void }) {
  const label = persona.personaMode === 'set' && persona.personaId
    ? persona.personaId
    : persona.personaMode === 'default' ? 'zurückgesetzt' : 'geerbt';
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border-b border-purple-200 rounded-t-xl">
      <span className="text-xs">👤</span>
      <span className="text-[10px] font-semibold text-purple-700 flex-1">Persona: {label}</span>
      <button onMouseDown={e => e.stopPropagation()} onClick={onRemove}
        className="text-purple-400 hover:text-purple-700 text-[9px] font-bold">✕</button>
    </div>
  );
}

function DockedToolCard({ tool, onRemove }: { tool: DockedTool; onRemove: () => void }) {
  const tools = tool.mcpTools ?? [];
  const paramCount = Object.keys(tool.toolParams ?? {}).length;
  const overrideCount = Object.keys(tool.personaToolParams ?? {}).length;
  const isMcp = tool.stepType !== 'tool_rag';
  return (
    <div className="border-t border-dashed border-gray-200">
      <div className="flex items-center gap-1.5 px-3 py-1 bg-teal-600 text-white">
        <span className="text-[10px]">{isMcp ? '🔧' : '🗃️'}</span>
        <span className="text-[9px] font-bold flex-1">{isMcp ? 'MCP Tool' : 'RAG Suche'}</span>
        <span className="text-[8px] opacity-60 font-mono truncate max-w-[80px]">{tool.stepId}</span>
        <button onMouseDown={e => e.stopPropagation()} onClick={onRemove}
          className="text-white/60 hover:text-white text-[9px] font-bold ml-1">✕</button>
      </div>
      <div className="px-3 py-1.5 bg-teal-50">
        {tools.length === 0
          ? <span className="text-[9px] text-teal-600">Alle Tools</span>
          : <div className="flex flex-wrap gap-1">
              {tools.map(t => (
                <span key={t} className="text-[8px] bg-teal-100 text-teal-800 px-1 py-0.5 rounded font-mono">{t}</span>
              ))}
            </div>}
        <div className="flex gap-3 mt-0.5 text-[9px] text-gray-500">
          {paramCount > 0 && <span>⚙ {paramCount} Param{paramCount > 1 ? 's' : ''}</span>}
          {overrideCount > 0 && <span className="text-purple-500">👤 {overrideCount} Override{overrideCount > 1 ? 's' : ''}</span>}
        </div>
        {tool.message && <p className="text-[8px] text-gray-400 italic mt-0.5 truncate" title={tool.message}>{truncate(tool.message, 40)}</p>}
      </div>
    </div>
  );
}

// ── NodeShell ─────────────────────────────────────────────────────
// Shared wrapper: colored header + delete button + selection ring

interface ShellProps {
  nodeId: string;
  stepType: NodeData['stepType'];
  icon: string;
  title?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  selected?: boolean;
  width?: number;
  data?: NodeData;  // enables inline dock rendering
}

function NodeShell({ nodeId, stepType, icon, title, badge, children, selected, width = 260, data }: ShellProps) {
  const c = NODE_COLORS[stepType];
  const { setNodes, setEdges } = useReactFlow();

  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => nds.filter(n => n.id !== nodeId));
    setEdges(eds => eds.filter(ed => ed.source !== nodeId && ed.target !== nodeId));
  }, [nodeId, setNodes, setEdges]);

  // Inline header badges for active persona + tools
  const hasPersonaVariants = data?.personaMessages && Object.values(data.personaMessages).some(Boolean);
  const personaBadge = data?.dockedPersona?.personaId
    ? <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-semibold">👤 {data.dockedPersona.personaId}</span>
    : hasPersonaVariants
      ? <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-semibold">👥</span>
      : null;

  return (
    <div
      className={`rounded-xl border-2 shadow-md transition-all ${c.bg} ${c.border} ${selected ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
      style={{ width }}
    >
      {/* Header */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl ${c.header} ${c.text}`}>
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-bold tracking-wide flex-1">{NODE_LABELS[stepType]}</span>
        {personaBadge}
        {badge}
        {title && (
          <span className="text-[10px] opacity-70 font-mono truncate max-w-[70px]">{title}</span>
        )}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onDelete}
          className="ml-1 text-white/60 hover:text-white/100 hover:bg-black/20 rounded px-0.5 text-[10px] font-bold leading-none"
          title="Knoten löschen"
        >✕</button>
      </div>
      {/* Body */}
      <div className="px-3 py-2 text-[11px] text-gray-700">
        {children}
      </div>
    </div>
  );
}

// ── Tag badge ──────────────────────────────────────────────────────────────────
function Tag({ label, color = 'bg-white/20' }: { label: string; color?: string }) {
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${color} text-white`}>
      {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FLOW NODES
// ─────────────────────────────────────────────────────────────────────────────

export function MessageNode({ id, data, selected }: NodeProps<NodeData>) {
  const hasVariants = data.personaMessages && Object.values(data.personaMessages).some(Boolean);
  return (
    <NodeShell nodeId={id} stepType="message" icon="💬" title={data.stepId} selected={selected} data={data}>
      <InHandle />
      {hasVariants
        ? <p className="text-blue-600 font-medium italic text-[10px]">
            👥 {Object.keys(data.personaMessages!).length} Persona-Varianten
          </p>
        : data.message && <p className="leading-snug text-gray-600">{truncate(data.message, 80)}</p>}
      {!data.message && !hasVariants && <p className="text-gray-400 italic">Keine Nachricht</p>}
      <OutHandle />
    </NodeShell>
  );
}

export function ChoiceNode({ id, data, selected }: NodeProps<NodeData>) {
  const opts = data.options ?? [];
  const totalRows = opts.length + (data.skipLabel ? 1 : 0) + 1;
  const setsPersona = opts.some(o => o.persona);
  return (
    <NodeShell
      nodeId={id} stepType="choice" icon={data.multiSelect ? '☑️' : '�️'}
      title={data.stepId} selected={selected} data={data}
      badge={<>
        {setsPersona && <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-semibold">👤</span>}
        {data.multiSelect && <Tag label="Multi" />}
      </>}
    >
      <InHandle />
      {data.message && <p className="text-gray-600 mb-2 leading-snug">{truncate(data.message, 60)}</p>}
      <div className="space-y-1 pr-4">
        {opts.map((o, i) => (
          <div key={o.id} className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${o.primary ? 'bg-indigo-500' : 'bg-gray-400'}`} />
            <span className="truncate text-gray-700 text-[11px]">{o.label || o.value}</span>
            {o.persona && (
              <span className="text-[9px] text-purple-500 bg-purple-100 px-1 rounded-full flex-shrink-0">
                👤{o.persona}
              </span>
            )}
            <Handle
              type="source" position={Position.Right} id={`opt-${i}`}
              style={{ right: -6, top: `${(i + 0.5) / totalRows * 100}%` }}
            />
          </div>
        ))}
        {data.skipLabel && (
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
            <span className="text-[11px] italic">{data.skipLabel}</span>
            <Handle
              type="source" position={Position.Right} id="skip"
              style={{ right: -6, top: `${(opts.length + 0.5) / totalRows * 100}%` }}
            />
          </div>
        )}
        {opts.length === 0 && <p className="text-gray-400 italic text-[11px]">Optionen im Panel hinzufügen</p>}
      </div>
      {data.field && (
        <p className="text-[10px] text-indigo-500 mt-1.5">📋 → {data.field}</p>
      )}
      <OutHandle top={`${(totalRows - 0.5) / totalRows * 100}%`} />
    </NodeShell>
  );
}

export function InputNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <NodeShell nodeId={id} stepType="input" icon="✏️" title={data.stepId} selected={selected} data={data}>
      <InHandle />
      {data.message && <p className="text-gray-600 leading-snug mb-1.5">{truncate(data.message, 70)}</p>}
      <div className="flex items-center gap-1.5 bg-white border border-sky-200 rounded-lg px-2 py-1">
        <span className="text-gray-400 text-[10px] italic flex-1">
          {data.placeholder || 'Freitexteingabe…'}
        </span>
      </div>
      {data.suggestions && data.suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {data.suggestions.slice(0, 3).map((s, i) => (
            <span key={i} className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full">{s}</span>
          ))}
          {data.suggestions.length > 3 && (
            <span className="text-[9px] text-gray-400">+{data.suggestions.length - 3}</span>
          )}
        </div>
      )}
      {data.field && <p className="text-[10px] text-sky-600 mt-1">📋 → {data.field}</p>}
      <OutHandle />
    </NodeShell>
  );
}

export function ChatNode({ id, data, selected }: NodeProps<NodeData>) {
  const hasVariants = data.personaMessages && Object.values(data.personaMessages).some(Boolean);
  const hasMcp = data.dockedTools?.some(t => t.stepType === 'tool_mcp');
  return (
    <NodeShell nodeId={id} stepType="chat" icon="🗨️" title={data.stepId} selected={selected} data={data}
      badge={hasMcp ? <span className="text-[9px] bg-teal-700 text-white px-1.5 py-0.5 rounded-full font-bold">🔧 MCP</span> : undefined}>
      <InHandle />
      {hasVariants
        ? <p className="text-blue-800 italic text-[10px]">👥 {Object.keys(data.personaMessages!).length} Persona-Varianten</p>
        : data.message && <p className="leading-snug text-gray-600">{truncate(data.message, 70)}</p>}
      {data.suggestions && data.suggestions.length > 0 && (
        <p className="text-[10px] text-blue-700 mt-1">💡 {data.suggestions.length} Quick-Replies</p>
      )}
      <OutHandle />
    </NodeShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  GATEWAY NODE  (BPMN-inspired, amber)
// ─────────────────────────────────────────────────────────────────────────────

const SPLIT_LABELS: Record<string, string> = { condition: 'Bedingung', persona: 'Persona', intent: 'Intent', ai_intent: 'KI-Weiche' };
const SPLIT_ICONS:  Record<string, string> = { condition: '⚙️', persona: '👤', intent: '🧠', ai_intent: '✨' };

export function GatewayNode({ id, data, selected }: NodeProps<NodeData>) {
  const branches = data.branches ?? [];
  const splitBy = data.splitBy ?? 'ai_intent';
  const totalRows = branches.length + 1; // +1 for default
  const c = NODE_COLORS['gateway'];

  const { setNodes, setEdges } = useReactFlow();
  const onDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(ed => ed.source !== id && ed.target !== id));
  }, [id, setNodes, setEdges]);

  return (
    <div
      className={`rounded-xl border-2 shadow-md ${c.bg} ${c.border} ${selected ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
      style={{ width: 260 }}
    >
      {/* Header with diamond icon */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-t-xl ${c.header} text-white`}>
        <span className="text-base font-bold" style={{ fontFamily: 'serif' }}>◇</span>
        <span className="text-[11px] font-bold tracking-wide flex-1">
          Weiche · {SPLIT_LABELS[splitBy]}
        </span>
        <span className="text-sm">{SPLIT_ICONS[splitBy]}</span>
        {data.stepId && (
          <span className="text-[10px] opacity-70 font-mono truncate max-w-[60px]">{data.stepId}</span>
        )}
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onDelete}
          className="text-white/60 hover:text-white text-[10px] font-bold"
        >✕</button>
      </div>

      {/* Branches */}
      <div className="px-3 py-2 text-[11px] space-y-1 pr-6 relative">
        <InHandle />
        {branches.map((b, i) => (
          <div key={b.id} className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="truncate text-gray-700 flex-1">
              {splitBy === 'condition' && b.field && (
                <span className="font-mono text-gray-500">{b.field} {b.operator === 'equals' ? '=' : b.operator === 'not_equals' ? '≠' : '⊇'} {b.value}</span>
              )}
              {splitBy === 'persona' && b.personaId && (
                <span className="text-purple-600">👤 {b.personaId}</span>
              )}
              {splitBy === 'intent' && b.intentPattern && (
                <span className="text-orange-600">🧠 {b.intentPattern}</span>
              )}
              {splitBy === 'ai_intent' && (
                <span className="text-amber-700 italic">{b.intentDescription ? truncate(b.intentDescription, 40) : b.label || `Zweig ${i + 1}`}</span>
              )}
              {splitBy !== 'ai_intent' && !b.field && !b.personaId && !b.intentPattern && (
                <span className="text-gray-400 italic">{b.label || `Zweig ${i + 1}`}</span>
              )}
            </span>
            <Handle
              type="source" position={Position.Right} id={`branch-${i}`}
              style={{ right: -6, top: `${(i + 0.5) / totalRows * 100}%` }}
            />
          </div>
        ))}
        {branches.length === 0 && (
          <p className="text-gray-400 italic">Zweige im Panel hinzufügen</p>
        )}
        <div className="flex items-center gap-1.5 pt-1 border-t border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span className="text-gray-400 italic text-[10px]">Standard (kein Zweig trifft zu)</span>
          <Handle
            type="source" position={Position.Right} id="default"
            style={{ right: -6, top: `${(branches.length + 0.5) / totalRows * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOOL NODES  (teal, wrench/data icons)
// ─────────────────────────────────────────────────────────────────────────────

export function ToolMcpNode({ id, data, selected }: NodeProps<NodeData>) {
  const tools = data.mcpTools ?? [];
  const hasPersonaOverrides = data.personaToolParams && Object.keys(data.personaToolParams).length > 0;
  return (
    <NodeShell
      nodeId={id} stepType="tool_mcp" icon="🔧" title={data.stepId} selected={selected}
      badge={<Tag label="MCP" color="bg-black/20" />}
    >
      <InHandle />
      {/* Server URL */}
      {data.mcpServer
        ? <p className="font-mono text-[10px] text-teal-700 truncate mb-1" title={data.mcpServer}>🌐 {data.mcpServer}</p>
        : <p className="text-[10px] text-gray-400 mb-1">🌐 Standard-Server (Bot-Konfig)</p>}
      {/* Tools */}
      {tools.length === 0
        ? <p className="text-[10px] text-teal-600">🔧 Alle verfügbaren Tools</p>
        : (
          <div className="flex flex-wrap gap-1 mb-1">
            {tools.map(t => (
              <span key={t} className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded font-mono">{t}</span>
            ))}
          </div>
        )}
      {/* Params */}
      {data.toolParams && Object.keys(data.toolParams).length > 0 && (
        <p className="text-[10px] text-gray-500">⚙ {Object.keys(data.toolParams).length} Parameter</p>
      )}
      {hasPersonaOverrides && (
        <p className="text-[10px] text-purple-600 mt-0.5">👤 {Object.keys(data.personaToolParams!).length} Persona-Overrides</p>
      )}
      <OutHandle />
    </NodeShell>
  );
}

export function ToolRagNode({ id, data, selected }: NodeProps<NodeData>) {
  const bases = data.ragBases ?? [];
  return (
    <NodeShell
      nodeId={id} stepType="tool_rag" icon="🗃️" title={data.stepId} selected={selected}
      badge={<Tag label="RAG" color="bg-black/20" />}
    >
      <InHandle />
      {bases.length === 0
        ? <p className="text-gray-400 italic text-[10px]">Wissensbasis im Panel wählen</p>
        : (
          <div className="space-y-0.5">
            {bases.map(b => (
              <div key={b.id} className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-700">{b.label}</span>
              </div>
            ))}
          </div>
        )}
      {data.queryTemplate && (
        <p className="text-[10px] text-teal-700 font-mono mt-1 truncate" title={data.queryTemplate}>
          🔍 {data.queryTemplate}
        </p>
      )}
      <div className="mt-1 text-[9px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
        ⚠ RAG noch nicht in Boerdi implementiert
      </div>
      <OutHandle />
    </NodeShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PERSONA NODE  (purple, compact)
// ─────────────────────────────────────────────────────────────────────────────

const MODE_LABELS = { inherit: 'erben', default: 'zurücksetzen', set: 'setzen' } as const;
const MODE_ICONS  = { inherit: '↩', default: '⊘', set: '👤' } as const;

export function PersonaSetNode({ id, data, selected }: NodeProps<NodeData>) {
  const mode = data.personaMode ?? 'inherit';
  return (
    <NodeShell nodeId={id} stepType="persona_set" icon="👤" title={data.stepId} selected={selected} width={220}>
      <InHandle />
      <div className="flex items-center gap-2">
        <span className="text-lg">{MODE_ICONS[mode]}</span>
        <div>
          <p className="text-[11px] font-semibold text-purple-700">
            Persona {MODE_LABELS[mode]}
          </p>
          {mode === 'set' && data.personaId && (
            <p className="text-[10px] text-gray-600 font-mono">{data.personaId}</p>
          )}
          {mode === 'inherit' && (
            <p className="text-[10px] text-gray-400">Übernimmt aktive Persona</p>
          )}
          {mode === 'default' && (
            <p className="text-[10px] text-gray-400">Kein Persona-Kontext</p>
          )}
        </div>
      </div>
      <OutHandle />
    </NodeShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  AKTIONEN NODES  (orange)
// ─────────────────────────────────────────────────────────────────────────────

export function ApiCallNode({ id, data, selected }: NodeProps<NodeData>) {
  const method = data.apiMethod ?? 'GET';
  const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-green-100 text-green-800', POST: 'bg-blue-100 text-blue-800',
    PUT: 'bg-yellow-100 text-yellow-800', PATCH: 'bg-orange-100 text-orange-800',
    DELETE: 'bg-red-100 text-red-800',
  };
  return (
    <NodeShell nodeId={id} stepType="api_call" icon="🌐" title={data.stepId} selected={selected}>
      <InHandle />
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${METHOD_COLORS[method] ?? 'bg-gray-100 text-gray-700'}`}>
          {method}
        </span>
        {data.apiUrl
          ? <span className="text-[10px] font-mono text-orange-700 truncate flex-1" title={data.apiUrl}>{data.apiUrl}</span>
          : <span className="text-[10px] text-gray-400 italic">URL konfigurieren…</span>}
      </div>
      {data.apiResultVar && (
        <p className="text-[10px] text-gray-500">
          💾 <span className="font-mono text-orange-700">{data.apiResultVar}</span>
        </p>
      )}
      {data.apiBody && (
        <p className="text-[10px] text-gray-400 italic truncate" title={data.apiBody}>
          Body: {truncate(data.apiBody, 40)}
        </p>
      )}
      {/* success / error output handles */}
      <div className="flex gap-2 mt-1.5 text-[9px]">
        <span className="text-green-600 font-semibold">✓ Erfolg</span>
        <span className="text-red-500 font-semibold">✗ Fehler</span>
      </div>
      <Handle type="source" position={Position.Right} id="success"
        style={{ right: -6, top: '65%' }} />
      <Handle type="source" position={Position.Right} id="error"
        style={{ right: -6, top: '85%' }} />
    </NodeShell>
  );
}

export function SetVarNode({ id, data, selected }: NodeProps<NodeData>) {
  const vars = data.variables ?? [];
  return (
    <NodeShell nodeId={id} stepType="set_var" icon="📝" title={data.stepId} selected={selected} width={240}>
      <InHandle />
      {vars.length === 0
        ? <p className="text-gray-400 italic text-[10px]">Variablen im Panel definieren</p>
        : (
          <div className="space-y-0.5">
            {vars.map((v, i) => (
              <div key={i} className="flex items-center gap-1 font-mono text-[10px]">
                <span className="text-orange-700 font-semibold">{v.key}</span>
                <span className="text-gray-400">=</span>
                <span className="text-gray-600 truncate flex-1" title={v.value}>{v.value || '…'}</span>
              </div>
            ))}
          </div>
        )}
      <OutHandle />
    </NodeShell>
  );
}

export function HandoffNode({ id, data, selected }: NodeProps<NodeData>) {
  return (
    <NodeShell nodeId={id} stepType="handoff" icon="💬" title={data.stepId} selected={selected}>
      <InHandle />
      {data.handoffMessage
        ? <p className="leading-snug text-gray-600">{truncate(data.handoffMessage, 80)}</p>
        : <p className="text-gray-400 italic text-[10px]">Abschlussnachricht (kein Weiter-Pfeil)</p>}
    </NodeShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Registry ─────────────────────────────────────────────────────────────────────────────

export const nodeTypes = {
  messageNode:    MessageNode,
  choiceNode:     ChoiceNode,
  inputNode:      InputNode,
  chatNode:       ChatNode,
  gatewayNode:    GatewayNode,
  toolMcpNode:    ToolMcpNode,
  toolRagNode:    ToolRagNode,
  personaSetNode: PersonaSetNode,
  apiCallNode:    ApiCallNode,
  setVarNode:     SetVarNode,
  handoffNode:    HandoffNode,
  // legacy aliases – old YAML imports used startNode/endNode keys
  startNode:      MessageNode,
  endNode:        MessageNode,
};
