import React, { useState } from 'react';
import type { Node } from 'reactflow';
import type { NodeData, PersonaConfig, BotConfig, FlowOption, GatewayBranch, RagBase } from './types';
import { NODE_LABELS, NODE_COLORS } from './types';
import { Plus, Trash2, ChevronDown, ChevronUp, HelpCircle, Info } from 'lucide-react';

// ── Micro-components ──────────────────────────────────────────────────────────

function Hint({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1 align-middle">
      <button onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="text-gray-300 hover:text-blue-400" type="button" tabIndex={-1}>
        <HelpCircle size={11} />
      </button>
      {show && (
        <div className="absolute left-5 top-0 z-50 w-60 bg-gray-800 text-white text-[10px] leading-relaxed rounded-lg px-2.5 py-2 shadow-xl pointer-events-none">
          {text}
        </div>
      )}
    </span>
  );
}

function InfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 mb-3">
      <Info size={11} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function WarnBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mb-3">
      <Info size={11} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function SectionHeader({ label, open, onToggle }: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className="flex items-center justify-between w-full text-xs font-bold text-gray-600 uppercase tracking-wide py-1.5 border-b border-gray-200 mb-2">
      {label}
      {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[11px] font-medium text-gray-500 mb-1">
        {label}{hint && <Hint text={hint} />}
      </label>
      {children}
    </div>
  );
}

const inp = 'w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white';
const txa = `${inp} resize-y`;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  node: Node<NodeData> | null;
  personas: PersonaConfig[];
  botConfig: BotConfig;
  onUpdateNode: (nodeId: string, patch: Partial<NodeData>) => void;
  onUpdatePersonas: (personas: PersonaConfig[]) => void;
  onUpdateBotConfig: (cfg: BotConfig) => void;
}

// ── Sub-editors ───────────────────────────────────────────────────────────────

function OptionsEditor({ value, personas, onChange }: { value: FlowOption[]; personas: PersonaConfig[]; onChange: (v: FlowOption[]) => void }) {
  const getNextMode = (opt: FlowOption) => {
    if (!opt.next) return '';
    if (opt.next === '__restart' || opt.next === '__back') return opt.next;
    return 'custom';
  };
  return (
    <div className="space-y-2">
      {value.map((opt, i) => (
        <div key={opt.id} className="border border-indigo-100 rounded-lg p-2.5 space-y-1.5 bg-indigo-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-indigo-500">Option {i + 1}</span>
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase">Schaltflächen-Text</label>
            <input className={inp + ' mt-0.5'} placeholder="z.B. 🎒 Ich bin Schüler:in"
              value={opt.label} onChange={e => { const n=[...value]; n[i]={...n[i],label:e.target.value}; onChange(n); }} />
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase flex items-center gap-1">
              Persona aktivieren <Hint text="Wenn der User diese Option wählt, wird die Persona aktiv. Der System-Prompt der Persona fließt in alle KI-Aufrufe ein." />
            </label>
            <select className={inp + ' mt-0.5 border-purple-200 bg-purple-50'}
              value={opt.persona ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],persona:e.target.value||undefined}; onChange(n); }}>
              <option value="">– keine Persona –</option>
              {personas.map(p => <option key={p.id} value={p.id}>👤 {p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase">Danach…</label>
            <select className={inp + ' mt-0.5 border-orange-200 bg-orange-50'}
              value={getNextMode(opt)}
              onChange={e => {
                const n=[...value];
                const v = e.target.value;
                n[i] = { ...n[i], next: (v === '' || v === 'custom') ? undefined : v as string };
                onChange(n);
              }}>
              <option value="">Weiter (verbundener Schritt)</option>
              <option value="__restart">🔁 Von vorne starten</option>
              <option value="__back">⬅️ Schritt zurück</option>
              <option value="custom">📍 Bestimmten Schritt…</option>
            </select>
            {getNextMode(opt) === 'custom' && (
              <input className={inp + ' mt-1 font-mono text-[10px]'} placeholder="Step-ID eingeben…"
                value={opt.next ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],next:e.target.value||undefined}; onChange(n); }} />
            )}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] text-gray-500 cursor-pointer">
              <input type="checkbox" checked={opt.primary ?? false}
                onChange={e => { const n=[...value]; n[i]={...n[i],primary:e.target.checked||undefined}; onChange(n); }} />
              Primär hervorheben
            </label>
          </div>
          <details className="mt-0.5">
            <summary className="text-[9px] text-gray-400 cursor-pointer hover:text-gray-600">Erweitert (Wert, URI)</summary>
            <div className="mt-1.5 space-y-1.5">
              <div>
                <label className="text-[9px] text-gray-400 uppercase">Wert (intern)</label>
                <input className={inp + ' mt-0.5 font-mono'} placeholder="z.B. learner"
                  value={opt.value} onChange={e => { const n=[...value]; n[i]={...n[i],value:e.target.value}; onChange(n); }} />
              </div>
              <div>
                <label className="text-[9px] text-gray-400 uppercase">Vokabular-URI (optional)</label>
                <input className={inp + ' mt-0.5 font-mono text-[10px]'} placeholder="http://w3id.org/…"
                  value={opt.uri ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],uri:e.target.value||undefined}; onChange(n); }} />
              </div>
            </div>
          </details>
        </div>
      ))}
      <button onClick={() => onChange([...value, {id:`opt-${value.length}`,label:'',value:`option-${value.length}`}])}
        className="flex items-center gap-1 text-[11px] text-indigo-500 hover:text-indigo-700 mt-1">
        <Plus size={11}/> Option hinzufügen
      </button>
    </div>
  );
}

function GatewayExpertToggle({ splitBy, onChangeSplitBy }: {
  splitBy: NodeData['splitBy'];
  onChangeSplitBy: (v: NodeData['splitBy']) => void;
}) {
  const [expert, setExpert] = useState(splitBy !== 'ai_intent' && splitBy !== undefined);
  return (
    <div className="mb-3">
      {!expert ? (
        <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-sm">✨</span>
            <div>
              <p className="text-xs font-semibold text-amber-800">KI-Weiche (empfohlen)</p>
              <p className="text-[10px] text-amber-600">KI entscheidet anhand der Beschreibung</p>
            </div>
          </div>
          <button onClick={() => { setExpert(true); onChangeSplitBy('condition'); }}
            className="text-[10px] text-gray-400 hover:text-gray-600 underline">Experten-Modus</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Verzweigungstyp</span>
            <button onClick={() => { setExpert(false); onChangeSplitBy('ai_intent'); }}
              className="text-[10px] text-amber-600 hover:text-amber-800 underline">✨ KI-Modus</button>
          </div>
          <div className="flex gap-1.5">
            {(['condition','persona','intent','ai_intent'] as const).map(t => (
              <button key={t}
                className={`flex-1 text-[10px] py-1.5 rounded-lg border transition-all ${splitBy===t ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'}`}
                onClick={() => onChangeSplitBy(t)}>
                {({condition:'⚙️ Feld', persona:'👤 Persona', intent:'🧠 Regex', ai_intent:'✨ KI'} as Record<string,string>)[t]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GatewayBranchEditor({
  splitBy, value, personas, onChange
}: {
  splitBy: NodeData['splitBy'];
  value: GatewayBranch[];
  personas: PersonaConfig[];
  onChange: (v: GatewayBranch[]) => void;
}) {
  const add = () => onChange([...value, { id: `branch-${value.length}`, label: `Zweig ${value.length + 1}` }]);
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={b.id} className="border border-amber-200 rounded-lg p-2.5 space-y-1.5 bg-amber-50/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-600">Zweig {i + 1}</span>
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
          </div>
          <div>
            <label className="text-[9px] text-gray-400 uppercase">Label (Kanten-Beschriftung)</label>
            <input className={inp + ' mt-0.5'} value={b.label}
              onChange={e => { const n=[...value]; n[i]={...n[i],label:e.target.value}; onChange(n); }} />
          </div>
          {splitBy === 'condition' && (
            <div className="space-y-1">
              <div className="flex gap-1">
                <input className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" placeholder="Feld"
                  value={b.field ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],field:e.target.value}; onChange(n); }} />
                <select className="text-xs border border-gray-300 rounded px-1 py-1 bg-white"
                  value={b.operator ?? 'equals'} onChange={e => { const n=[...value]; n[i]={...n[i],operator:e.target.value as GatewayBranch['operator']}; onChange(n); }}>
                  <option value="equals">= gleich</option>
                  <option value="not_equals">≠ ungleich</option>
                  <option value="contains">⊇ enthält</option>
                </select>
                <input className="flex-1 text-xs border border-gray-300 rounded px-2 py-1" placeholder="Wert"
                  value={b.value ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],value:e.target.value}; onChange(n); }} />
              </div>
            </div>
          )}
          {splitBy === 'persona' && (
            <div>
              <label className="text-[9px] text-gray-400 uppercase">Persona</label>
              <select className={inp + ' mt-0.5'}
                value={b.personaId ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],personaId:e.target.value}; onChange(n); }}>
                <option value="">– wählen –</option>
                {personas.map(p => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
              </select>
            </div>
          )}
          {splitBy === 'intent' && (
            <div>
              <label className="text-[9px] text-gray-400 uppercase">Intent-Muster (Regex / Schlüsselwörter)</label>
              <input className={inp + ' mt-0.5 font-mono'} placeholder="z.B. buchempfehlung|buch suchen"
                value={b.intentPattern ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],intentPattern:e.target.value}; onChange(n); }} />
            </div>
          )}
          {splitBy === 'ai_intent' && (
            <div>
              <label className="text-[9px] text-gray-400 uppercase">Beschreibung für KI (wann trifft dieser Zweig zu?)</label>
              <textarea className={inp + ' mt-0.5 resize-none'} rows={2}
                placeholder="z.B. Lehrkraft, unterrichtet, Unterrichtsmaterial, Klasse"
                value={b.intentDescription ?? ''} onChange={e => { const n=[...value]; n[i]={...n[i],intentDescription:e.target.value}; onChange(n); }} />
            </div>
          )}
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 mt-1">
        <Plus size={11}/> Zweig hinzufügen
      </button>
      <div className="text-[10px] text-gray-400 bg-gray-50 rounded px-2 py-1.5 border border-gray-200">
        ↳ <strong>Standard-Ausgang</strong>: trifft immer zu, wenn kein Zweig greift
      </div>
    </div>
  );
}

function ParamsEditor({ value, onChange }: { value: Record<string,string>; onChange: (v: Record<string,string>) => void }) {
  const entries = Object.entries(value);
  return (
    <div className="space-y-1">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1 items-center">
          <input className="w-24 text-xs border border-gray-300 rounded px-1.5 py-1 font-mono" placeholder="key" value={k}
            onChange={e => { const n={...value}; delete n[k]; n[e.target.value]=v; onChange(n); }} />
          <span className="text-gray-400">=</span>
          <input className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1" placeholder="wert" value={v}
            onChange={e => onChange({...value,[k]:e.target.value})} />
          <button onClick={() => { const n={...value}; delete n[k]; onChange(n); }} className="text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
        </div>
      ))}
      <button onClick={() => onChange({...value,'':''})} className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800 mt-1">
        <Plus size={11}/> Parameter hinzufügen
      </button>
    </div>
  );
}

function PersonaOverrideEditor({
  personas, value, defaultParams, onChange
}: {
  personas: PersonaConfig[];
  value: Record<string, Record<string,string>>;
  defaultParams: Record<string,string>;
  onChange: (v: Record<string, Record<string,string>>) => void;
}) {
  const [open, setOpen] = useState<string|null>(null);
  return (
    <div className="space-y-1.5">
      {personas.map(p => {
        const overrides = value[p.id] ?? {};
        const has = Object.keys(overrides).length > 0;
        const isOpen = open === p.id;
        return (
          <div key={p.id} className={`rounded-lg border ${has ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
            <button className="flex items-center justify-between w-full px-2.5 py-1.5 text-[11px]"
              onClick={() => setOpen(isOpen ? null : p.id)}>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${has ? 'bg-purple-500' : 'bg-gray-300'}`} />
                <span className={`font-semibold ${has ? 'text-purple-700' : 'text-gray-500'}`}>{p.label}</span>
                {has && <span className="text-[9px] text-purple-400">{Object.keys(overrides).length} override(s)</span>}
              </span>
              {isOpen ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
            </button>
            {isOpen && (
              <div className="px-2.5 pb-2.5 pt-1 border-t border-purple-200 space-y-1.5">
                <p className="text-[10px] text-purple-600">Überschreibt Standard-Params für <strong>{p.label}</strong>:</p>
                {Object.entries(defaultParams).map(([k]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="w-20 text-[10px] font-mono text-gray-500 flex-shrink-0 truncate">{k}:</span>
                    <input className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1"
                      placeholder={defaultParams[k] || '(Standard)'} value={overrides[k] ?? ''}
                      onChange={e => onChange({...value,[p.id]:{...overrides,[k]:e.target.value}})} />
                  </div>
                ))}
                <button className="flex items-center gap-1 text-[10px] text-red-400 hover:text-red-600 mt-1"
                  onClick={() => { const n={...value}; delete n[p.id]; onChange(n); }}>
                  <Trash2 size={10}/> Overrides zurücksetzen
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RagBasesEditor({ value, onChange }: { value: RagBase[]; onChange: (v: RagBase[]) => void }) {
  const KNOWN: RagBase[] = [
    { id: 'wlo-general-faq',      label: 'WLO Allgemeine FAQ',      description: 'Häufige Fragen zu WLO' },
    { id: 'wlo-project-info',     label: 'WLO Projektinformationen', description: 'Infos zu edu-sharing Projekten' },
    { id: 'oeh-pedagogy',         label: 'OEH Pädagogik-Wissen',    description: 'Didaktische Grundlagen' },
    { id: 'custom',               label: 'Eigene Wissensbasis',      description: 'Benutzerdefinierte Basis' },
  ];
  const toggle = (base: RagBase) => {
    const exists = value.find(v => v.id === base.id);
    if (exists) onChange(value.filter(v => v.id !== base.id));
    else onChange([...value, base]);
  };
  return (
    <div className="space-y-1.5">
      {KNOWN.map(base => {
        const selected = !!value.find(v => v.id === base.id);
        return (
          <label key={base.id} className={`flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-all ${
            selected ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300'
          }`}>
            <input type="checkbox" checked={selected} onChange={() => toggle(base)} className="accent-teal-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700">{base.label}</p>
              <p className="text-[10px] text-gray-400 font-mono">{base.id}</p>
              {base.description && <p className="text-[10px] text-gray-400">{base.description}</p>}
            </div>
          </label>
        );
      })}
    </div>
  );
}

function SuggestionsEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      {value.map((s, i) => (
        <div key={i} className="flex gap-1">
          <input className={`${inp} flex-1`} value={s}
            onChange={e => { const n=[...value]; n[i]=e.target.value; onChange(n); }} />
          <button onClick={() => onChange(value.filter((_,j)=>j!==i))} className="text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
        </div>
      ))}
      <button onClick={() => onChange([...value,''])} className="flex items-center gap-1 text-[11px] text-blue-500 hover:text-blue-700 mt-1">
        <Plus size={11}/> Vorschlag hinzufügen
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PropertiesPanel({ node, personas, botConfig, onUpdateNode, onUpdatePersonas, onUpdateBotConfig }: Props) {
  const [tab, setTab] = useState<'node'|'personas'|'bot'>('node');
  const [sections, setSections] = useState({ main: true, persona: false, suggestions: false });
  const toggle = (k: keyof typeof sections) => setSections(s => ({...s,[k]:!s[k]}));

  const patch = (p: Partial<NodeData>) => { if (node) onUpdateNode(node.id, p); };
  const d = node?.data;

  const tabCls = (t: string) =>
    `flex-1 text-xs py-2 font-medium border-b-2 transition-colors ${tab===t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200" style={{ minWidth: 310, maxWidth: 350 }}>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button className={tabCls('node')} onClick={() => setTab('node')}>Eigenschaften</button>
        <button className={tabCls('personas')} onClick={() => setTab('personas')}>Personas</button>
        <button className={tabCls('bot')} onClick={() => setTab('bot')}>Bot</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">

        {/* ── NODE TAB ── */}
        {tab === 'node' && (
          <>
            {!d ? (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <p className="text-2xl mb-2">👆</p>
                <p className="text-sm text-gray-500">Knoten anklicken</p>
                <p className="text-xs text-gray-400 mt-1">um Eigenschaften zu bearbeiten</p>
              </div>
            ) : (
              <>
                {/* Node type badge */}
                {(() => {
                  const c = NODE_COLORS[d.stepType];
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 ${c.header} text-white`}>
                      <span className="text-sm font-bold">{NODE_LABELS[d.stepType]}</span>
                      <span className="text-[10px] opacity-70 font-mono ml-auto">{d.stepId}</span>
                    </div>
                  );
                })()}

                {(d.stepType === 'start' || d.stepType === 'end') && (
                  <p className="text-xs text-gray-400 italic text-center py-4">Keine Einstellungen für Start/Ende-Events.</p>
                )}

                {d.stepType !== 'start' && d.stepType !== 'end' && (
                  <>
                    <SectionHeader label="Grundeinstellungen" open={sections.main} onToggle={() => toggle('main')} />
                    {sections.main && (
                      <>
                        <Field label="Schritt-ID" hint="Eindeutiger Bezeichner im Flow. Wird in der YAML-Datei und zum Verknüpfen von Zweigen verwendet.">
                          <input className={inp} value={d.stepId} onChange={e => patch({stepId: e.target.value})} />
                        </Field>

                        {/* Message – for flow nodes */}
                        {['message','choice','input','chat'].includes(d.stepType) && (
                          <Field label="Standard-Nachricht" hint="Bot-Text, der angezeigt wird. Wenn eine Persona aktiv ist und eine Persona-Nachricht definiert ist, wird diese stattdessen verwendet.">
                            <textarea className={txa} rows={3} value={d.message ?? ''}
                              onChange={e => patch({message: e.target.value})} />
                          </Field>
                        )}

                        {/* ── choice ── */}
                        {d.stepType === 'choice' && (
                          <>
                            <div className="flex items-center gap-3 mb-3">
                              <label className="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={d.multiSelect ?? false}
                                  onChange={e => patch({multiSelect: e.target.checked || undefined})} className="accent-indigo-600" />
                                Mehrfachauswahl
                                <Hint text="Erlaubt das Auswählen mehrerer Optionen gleichzeitig (Checkbox-Stil statt Radio-Stil)." />
                              </label>
                            </div>
                            <Field label="Profil-Feld" hint="Die gewählte(n) Option(en) werden unter diesem Namen im Nutzerprofil gespeichert.">
                              <input className={inp} value={d.field ?? ''} placeholder="z.B. role, educationLevel"
                                onChange={e => patch({field: e.target.value})} />
                            </Field>
                            {d.multiSelect && (
                              <Field label="Überspringen-Label">
                                <input className={inp} value={d.skipLabel ?? ''} placeholder="Überspringen"
                                  onChange={e => patch({skipLabel: e.target.value})} />
                              </Field>
                            )}
                            <Field label="Optionen">
                              <OptionsEditor value={d.options ?? []} personas={personas} onChange={v => patch({options: v})} />
                            </Field>
                          </>
                        )}

                        {/* ── input ── */}
                        {d.stepType === 'input' && (
                          <>
                            <Field label="Profil-Feld" hint="Die Antwort des Users wird unter diesem Namen im Nutzerprofil gespeichert. Kann mit {{ profile.feldname }} referenziert werden.">
                              <input className={inp} value={d.field ?? ''} placeholder="z.B. interest, topic"
                                onChange={e => patch({field: e.target.value})} />
                            </Field>
                            <Field label="Platzhaltertext">
                              <input className={inp} value={d.placeholder ?? ''} placeholder="z.B. Thema eingeben…"
                                onChange={e => patch({placeholder: e.target.value})} />
                            </Field>
                          </>
                        )}

                        {/* ── chat: MCP toggle + config ── */}
                        {d.stepType === 'chat' && (() => {
                          const mcpTool = d.dockedTools?.find(t => t.stepType === 'tool_mcp');
                          const hasMcp = !!mcpTool;
                          const patchMcpTool = (p: { mcpServer?: string; mcpTools?: string[] }) =>
                            patch({ dockedTools: (d.dockedTools ?? []).map(t => t.stepType === 'tool_mcp' ? {...t, ...p} : t) });
                          return (
                            <div className="mb-3 rounded-lg border border-teal-200 bg-teal-50 overflow-hidden">
                              <label className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer">
                                <input type="checkbox" checked={hasMcp}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      patch({ dockedTools: [...(d.dockedTools?.filter(t => t.stepType !== 'tool_mcp') ?? []), { stepId: 'mcp_wlo', stepType: 'tool_mcp' as const }] });
                                    } else {
                                      patch({ dockedTools: (d.dockedTools ?? []).filter(t => t.stepType !== 'tool_mcp') });
                                    }
                                  }}
                                  className="accent-teal-600 w-4 h-4 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-teal-800">🔧 MCP-Suche aktiv</p>
                                  <p className="text-[10px] text-teal-600">
                                    {hasMcp && mcpTool?.mcpTools?.length
                                      ? `${mcpTool.mcpTools.length} Tool${mcpTool.mcpTools.length > 1 ? 's' : ''} ausgewählt`
                                      : 'KI kann WirLernenOnline.de durchsuchen'}
                                  </p>
                                </div>
                              </label>
                              {hasMcp && (
                                <div className="px-2.5 pb-2.5 space-y-2 border-t border-teal-200 pt-2">
                                  <Field label="Server-URL (optional)" hint="Leer = Standard-URL aus dem Bot-Tab. Nur nötig für andere MCP-Server.">
                                    <input className={`${inp} font-mono text-[10px]`} value={mcpTool?.mcpServer ?? ''}
                                      placeholder="https://… (leer = Standard aus Bot-Tab)"
                                      onChange={e => patchMcpTool({ mcpServer: e.target.value || undefined })} />
                                  </Field>
                                  <Field label="Tools" hint="Leere Auswahl = alle Tools des Servers. Oder gezielt einzelne aktivieren.">
                                    <McpToolsEditor
                                      value={mcpTool?.mcpTools ?? []}
                                      onChange={v => patchMcpTool({ mcpTools: v.length ? v : undefined })}
                                      serverUrl={mcpTool?.mcpServer || botConfig.mcpServerUrl || WLO_MCP_URL} />
                                  </Field>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* ── gateway ── */}
                        {d.stepType === 'gateway' && (
                          <>
                            <InfoBanner>
                              Die KI analysiert was der User schreibt und leitet zum passenden Zweig. Kein Treffer → Standard-Ausgang.
                            </InfoBanner>
                            <GatewayExpertToggle
                              splitBy={d.splitBy ?? 'ai_intent'}
                              onChangeSplitBy={v => patch({splitBy: v})}
                            />
                            <Field label="Zweige">
                              <GatewayBranchEditor
                                splitBy={d.splitBy ?? 'ai_intent'}
                                value={d.branches ?? []}
                                personas={personas}
                                onChange={v => patch({branches: v})}
                              />
                            </Field>
                          </>
                        )}

                        {/* ── tool_mcp ── */}
                        {d.stepType === 'tool_mcp' && (
                          <>
                            <InfoBanner>
                              Ruft einen MCP-Server auf. Ohne eigene Server-URL wird die URL aus der Bot-Konfiguration verwendet.
                            </InfoBanner>
                            <Field label="Server-URL (optional)" hint="Überschreibt die Standard-MCP-URL aus der Bot-Konfiguration – nur nötig bei mehreren MCP-Servern.">
                              <input className={`${inp} font-mono text-[10px]`} value={d.mcpServer ?? ''}
                                placeholder="https://… (leer = Standard)"
                                onChange={e => patch({mcpServer: e.target.value || undefined})} />
                            </Field>
                            <Field label="Tools" hint="Leere Liste = alle verfügbaren Tools des Servers. Oder gezielt einzelne Tools auflisten.">
                              <McpToolsEditor value={d.mcpTools ?? []} onChange={v => patch({mcpTools: v})}
                                serverUrl={d.mcpServer || botConfig.mcpServerUrl || WLO_MCP_URL} />
                            </Field>
                            <Field label="Standard-Parameter" hint="Werden immer mitgesendet. Variablen wie {{ profile.interest }} werden zur Laufzeit ersetzt.">
                              <ParamsEditor value={d.toolParams ?? {}} onChange={v => patch({toolParams: v})} />
                            </Field>
                            <Field label="Persona-spezifische Parameter" hint="Überschreiben die Standard-Parameter, wenn eine bestimmte Persona aktiv ist.">
                              <PersonaOverrideEditor
                                personas={personas}
                                value={d.personaToolParams ?? {}}
                                defaultParams={d.toolParams ?? {}}
                                onChange={v => patch({personaToolParams: v})}
                              />
                            </Field>
                          </>
                        )}

                        {/* ── tool_rag ── */}
                        {d.stepType === 'tool_rag' && (
                          <>
                            <WarnBanner>RAG ist noch nicht in Boerdi implementiert – dieser Knoten dient der Planung zukünftiger Features.</WarnBanner>
                            <Field label="Wissensbasen" hint="Wähle eine oder mehrere Basen aus. Bei mehreren Basen werden die Ergebnisse zusammengeführt.">
                              <RagBasesEditor value={d.ragBases ?? []} onChange={v => patch({ragBases: v})} />
                            </Field>
                            <Field label="Abfrage-Template" hint="Vorlage für die Suchanfrage. {{ userInput }} und {{ profile.* }} werden zur Laufzeit befüllt.">
                              <input className={`${inp} font-mono`} value={d.queryTemplate ?? ''}
                                placeholder="{{ userInput }}"
                                onChange={e => patch({queryTemplate: e.target.value})} />
                            </Field>
                          </>
                        )}

                        {/* ── persona_set ── */}
                        {d.stepType === 'persona_set' && (
                          <>
                            <InfoBanner>
                              Dieser Knoten ändert die aktive Persona. Er ist ein normaler Schritt im Flow – platziere ihn vor dem Knoten, der mit der neuen Persona laufen soll.
                            </InfoBanner>
                            <Field label="Modus" hint="inherit = Persona bleibt wie sie ist · default = zurücksetzen (kein Kontext) · set = gezielt zuweisen">
                              <div className="flex gap-2">
                                {(['inherit','default','set'] as const).map(m => (
                                  <button key={m}
                                    className={`flex-1 text-xs py-1.5 rounded-lg border transition-all ${d.personaMode===m ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}
                                    onClick={() => patch({personaMode: m})}>
                                    {{inherit:'↩ Erben', default:'⊘ Reset', set:'👤 Setzen'}[m]}
                                  </button>
                                ))}
                              </div>
                            </Field>
                            {d.personaMode === 'set' && (
                              <Field label="Persona" hint="Die Persona, die ab diesem Schritt aktiv sein soll.">
                                <select className={inp} value={d.personaId ?? ''}
                                  onChange={e => patch({personaId: e.target.value})}>
                                  <option value="">– wählen –</option>
                                  {personas.map(p => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
                                </select>
                              </Field>
                            )}
                          </>
                        )}

                        {/* ── api_call ── */}
                        {d.stepType === 'api_call' && (
                          <>
                            <InfoBanner>
                              Ruft eine externe HTTP-API auf. Ergebnis wird als Variable gespeichert. Zwei Ausgänge: Erfolg (2xx) und Fehler.
                            </InfoBanner>
                            <Field label="Methode">
                              <div className="flex gap-1.5">
                                {(['GET','POST','PUT','PATCH','DELETE'] as const).map(m => (
                                  <button key={m}
                                    className={`flex-1 text-[10px] py-1 rounded border font-mono font-bold transition-all ${d.apiMethod===m ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'}`}
                                    onClick={() => patch({apiMethod: m})}>{m}</button>
                                ))}
                              </div>
                            </Field>
                            <Field label="URL" hint="Unterstützt {{ }}-Templates, z.B. https://api.example.com/orders/{{ profile.orderId }}">
                              <input className={`${inp} font-mono text-[10px]`} value={d.apiUrl ?? ''}
                                placeholder="https://api.example.com/…"
                                onChange={e => patch({apiUrl: e.target.value || undefined})} />
                            </Field>
                            <Field label="Request Body (JSON)" hint="Nur bei POST/PUT/PATCH. Unterstützt {{ }}-Templates.">
                              <textarea className={`${txa} font-mono text-[10px]`} rows={3} value={d.apiBody ?? ''}
                                placeholder={'{\n  "query": "{{ profile.interest }}"\n}'}
                                onChange={e => patch({apiBody: e.target.value || undefined})} />
                            </Field>
                            <Field label="Ergebnis speichern als" hint="Name der Kontextvariable für die Antwort. Zugriff danach z.B. mit {{ apiResult.id }}">
                              <input className={`${inp} font-mono`} value={d.apiResultVar ?? ''}
                                placeholder="apiResult"
                                onChange={e => patch({apiResultVar: e.target.value || undefined})} />
                            </Field>
                            <Field label="Request Headers (optional)" hint="z.B. Authorization: Bearer {{ env.API_KEY }}">
                              <ParamsEditor value={d.apiHeaders ?? {}} onChange={v => patch({apiHeaders: v})} />
                            </Field>
                          </>
                        )}

                        {/* ── set_var ── */}
                        {d.stepType === 'set_var' && (
                          <>
                            <InfoBanner>
                              {'Setzt eine oder mehrere Kontextvariablen. Werte unterstützen {{ }}-Templates und können auf andere Variablen oder Profil-Felder zugreifen.'}
                            </InfoBanner>
                            <Field label="Variablen" hint="key = Variablenname · value = Wert oder Template wie {{ apiResult.name }}">
                              <ParamsEditor
                                value={Object.fromEntries((d.variables ?? []).map(v => [v.key, v.value]))}
                                onChange={obj => patch({ variables: Object.entries(obj).map(([key, value]) => ({ key, value })) })}
                              />
                            </Field>
                          </>
                        )}


                        {/* Notes */}
                        <Field label="Designer-Notizen">
                          <textarea className={txa} rows={2} value={d.notes ?? ''}
                            placeholder="Interne Kommentare (nicht exportiert)…"
                            onChange={e => patch({notes: e.target.value})} />
                        </Field>
                      </>
                    )}

                    {/* Persona-Nachrichten */}
                    {['message','choice','input','chat'].includes(d.stepType) && (
                      <>
                        <SectionHeader label="Persona-Nachrichten" open={sections.persona} onToggle={() => toggle('persona')} />
                        {sections.persona && (
                          <div className="space-y-2">
                            <InfoBanner>
                              Überschreiben die Standard-Nachricht, wenn eine Persona aktiv ist. Leer = Standard wird angezeigt.
                            </InfoBanner>
                            {personas.map(p => (
                              <div key={p.id}>
                                <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-600 mb-0.5">
                                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                                  {p.label} <span className="text-gray-400 font-normal">({p.id})</span>
                                </label>
                                <textarea className={txa} rows={2}
                                  placeholder={`Nachricht für ${p.label}…`}
                                  value={d.personaMessages?.[p.id] ?? ''}
                                  onChange={e => patch({personaMessages:{...(d.personaMessages??{}),[p.id]:e.target.value}})} />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {/* Suggestions */}
                    {['input','chat'].includes(d.stepType) && (
                      <>
                        <SectionHeader label="Schnell-Antworten / Vorschläge" open={sections.suggestions} onToggle={() => toggle('suggestions')} />
                        {sections.suggestions && (
                          <SuggestionsEditor value={d.suggestions ?? []} onChange={v => patch({suggestions: v})} />
                        )}
                      </>
                    )}

                    {/* Docked Persona Config – visible when persona_set was dropped onto this workflow node */}
                    {['message','choice','input','chat'].includes(d.stepType) && d.dockedPersona && (
                      <div className="mt-3 rounded-lg border border-purple-200 bg-purple-50 p-3 space-y-2">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold text-purple-700">👤 Angedockte Persona</span>
                          <button onClick={() => patch({ dockedPersona: undefined })}
                            className="text-[10px] text-red-400 hover:text-red-600 font-medium">✕ Entfernen</button>
                        </div>
                        <div className="flex gap-1.5">
                          {(['inherit','default','set'] as const).map(m => (
                            <button key={m}
                              className={`flex-1 text-[10px] py-1 rounded border transition-all ${
                                d.dockedPersona!.personaMode===m
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                              }`}
                              onClick={() => patch({ dockedPersona: { ...d.dockedPersona!, personaMode: m } })}>
                              {{inherit:'↩ Erben', default:'⊘ Reset', set:'👤 Setzen'}[m]}
                            </button>
                          ))}
                        </div>
                        {d.dockedPersona.personaMode === 'set' && (
                          <select className={inp} value={d.dockedPersona.personaId ?? ''}
                            onChange={e => patch({ dockedPersona: { ...d.dockedPersona!, personaId: e.target.value } })}>
                            <option value="">– Persona wählen –</option>
                            {personas.map(p => <option key={p.id} value={p.id}>{p.label} ({p.id})</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ── PERSONAS TAB ── */}
        {tab === 'personas' && (
          <PersonasTab personas={personas} botConfig={botConfig} onUpdate={onUpdatePersonas} />
        )}

        {/* ── BOT TAB ── */}
        {tab === 'bot' && (
          <BotConfigTab config={botConfig} personas={personas} onUpdate={onUpdateBotConfig} />
        )}
      </div>
    </div>
  );
}

// ── MCP Tools Editor ──────────────────────────────────────────────────────────

const WLO_MCP_URL = 'https://wlo-mcp-server.vercel.app/mcp';

const KNOWN_TOOLS = [
  { id: 'search_wlo_collections', label: 'Sammlungssuche',  desc: 'Sucht Themenseiten (Sammlungen) in WLO' },
  { id: 'search_wlo_content',     label: 'Inhaltssuche',    desc: 'Sucht einzelne Lernmaterialien in WLO' },
  { id: 'get_collection_contents',label: 'Sammlungsinhalte',desc: 'Liest Materialien einer Sammlung aus' },
  { id: 'get_wirlernenonline_info',label: 'WLO-Info',        desc: 'Informationen über die WLO-Plattform' },
];

function McpToolsEditor({ value, onChange, serverUrl }: { value: string[]; onChange: (v: string[]) => void; serverUrl?: string }) {
  const [fetchedTools, setFetchedTools] = useState<{ id: string; label: string; desc: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchTools = async () => {
    if (!serverUrl) return;
    setLoading(true); setFetchError(null);
    try {
      const url = serverUrl.replace(/\/$/, '');
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', params: {}, id: 1 }),
      });
      const text = await resp.text();
      // Handle both plain JSON and SSE (data: {...})
      const jsonStr = text.startsWith('data:') ? text.split('\n').find(l => l.startsWith('data:'))?.slice(5) ?? text : text;
      const data = JSON.parse(jsonStr);
      const tools: { name: string; description?: string }[] = data?.result?.tools ?? [];
      setFetchedTools(tools.map(t => ({ id: t.name, label: t.name, desc: t.description ?? '' })));
    } catch {
      setFetchError('Fehler beim Laden – CORS oder falsches Format?');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  const allSelected = value.length === 0;

  // Merge known + dynamically fetched (deduplicated)
  const displayTools = [
    ...KNOWN_TOOLS,
    ...fetchedTools.filter(f => !KNOWN_TOOLS.find(k => k.id === f.id)),
  ];

  return (
    <div className="space-y-1.5">
      <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${allSelected ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white'}`}>
        <input type="radio" name={`mcp-mode-${serverUrl}`} checked={allSelected} onChange={() => onChange([])} className="accent-teal-600" />
        <div>
          <p className="text-xs font-semibold text-gray-700">Alle verfügbaren Tools</p>
          <p className="text-[10px] text-gray-400">Der Server entscheidet welches Tool passt</p>
        </div>
      </label>
      {displayTools.map(t => (
        <label key={t.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${value.includes(t.id) ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300'}`}>
          <input type="checkbox" checked={value.includes(t.id)} onChange={() => toggle(t.id)} className="accent-teal-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-gray-700">{t.label}</p>
            <p className="text-[10px] font-mono text-gray-400">{t.id}</p>
            {t.desc && <p className="text-[10px] text-gray-400">{t.desc}</p>}
          </div>
        </label>
      ))}
      {serverUrl && (
        <button onClick={fetchTools} disabled={loading}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-teal-300 text-teal-700 text-[11px] font-medium hover:bg-teal-50 disabled:opacity-50 transition-colors">
          {loading ? '⏳ Lade…' : '🔄 Tools vom Server laden'}
        </button>
      )}
      {fetchError && <p className="text-[10px] text-red-500">{fetchError}</p>}
      <p className="text-[10px] text-gray-400 mt-1">Weiteres Tool manuell eingeben:</p>
      {value.filter(v => !displayTools.find(t => t.id === v)).map((t, i) => (
        <div key={i} className="flex gap-1">
          <input className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 font-mono" value={t}
            onChange={e => { const n=[...value]; n[value.indexOf(t)]=e.target.value; onChange(n); }} />
          <button onClick={() => onChange(value.filter(x => x !== t))} className="text-gray-400 hover:text-red-500"><Trash2 size={11}/></button>
        </div>
      ))}
      <button onClick={() => onChange([...value, ''])} className="flex items-center gap-1 text-[11px] text-teal-600 hover:text-teal-800">
        <Plus size={11}/> Weiteres Tool hinzufügen
      </button>
    </div>
  );
}

// ── Personas Tab ──────────────────────────────────────────────────────────────

function PersonasTab({ personas, botConfig, onUpdate }: { personas: PersonaConfig[]; botConfig: BotConfig; onUpdate: (p: PersonaConfig[]) => void }) {
  const [sel, setSel] = useState(0);
  const p = personas[sel];
  return (
    <div className="space-y-3">
      <InfoBanner>
        Jede Persona hat einen eigenen <strong>System-Prompt</strong>, der in alle LLM-Aufrufe eingefügt wird, sobald der User diese Rolle gewählt hat. Die Aktivierung erfolgt über das Feld <em>„Persona aktivieren"</em> in einem Auswahl-Knoten oder über einen <em>Persona</em>-Knoten im Flow.
      </InfoBanner>
      <div className="flex gap-1 flex-wrap">
        {personas.map((per, i) => (
          <button key={per.id} onClick={() => setSel(i)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${i===sel ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'}`}>
            {per.label}
          </button>
        ))}
        <button
          onClick={() => { onUpdate([...personas, {id:`persona-${personas.length}`,label:'Neue Persona',uri:'',systemPrompt:'# Neue Persona\n\nDu bist Boerdi, ein hilfreicher Assistent.'}]); setSel(personas.length); }}
          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500">
          + Neu
        </button>
      </div>
      {p && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-0.5">
                ID<Hint text="Interner Bezeichner (keine Leerzeichen). Dieser Wert wird im Auswahl-Knoten unter 'Persona aktivieren' eingetragen." />
              </label>
              <input className={`${inp} font-mono`} value={p.id} onChange={e => { const n=[...personas]; n[sel]={...n[sel],id:e.target.value}; onUpdate(n); }} />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-medium block mb-0.5">Label</label>
              <input className={inp} value={p.label} onChange={e => { const n=[...personas]; n[sel]={...n[sel],label:e.target.value}; onUpdate(n); }} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-medium block mb-0.5">
              URI<Hint text="Optionale Vokabular-URI, z.B. aus OpenEduHub intendedEndUserRole. Für maschinenlesbare Filterung." />
            </label>
            <input className={`${inp} font-mono text-[10px]`} placeholder="http://w3id.org/…" value={p.uri} onChange={e => { const n=[...personas]; n[sel]={...n[sel],uri:e.target.value}; onUpdate(n); }} />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 font-medium block mb-0.5">
              System-Prompt (Markdown)<Hint text="Dieser Text wird als System-Nachricht vor jede LLM-Anfrage gestellt, wenn diese Persona aktiv ist. Beschreibe Ton, Sprache und fachlichen Fokus." />
            </label>
            <textarea className={`${txa} font-mono leading-relaxed`} rows={14}
              value={p.systemPrompt} onChange={e => { const n=[...personas]; n[sel]={...n[sel],systemPrompt:e.target.value}; onUpdate(n); }} />
            <p className="text-[10px] text-gray-400 mt-1">Export: <code className="bg-gray-100 px-1 rounded">assets/personas/{p.id}.md</code></p>
          </div>
          {personas.length > 1 && (
            <button onClick={() => { onUpdate(personas.filter((_,i) => i !== sel)); setSel(Math.max(0, sel-1)); }}
              className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600">
              <Trash2 size={11}/> Persona löschen
            </button>
          )}
        </div>
      )}
      {botConfig.defaultPersona !== undefined && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <p className="text-[10px] text-gray-500 font-medium mb-1">
            Standard-Persona<Hint text="Aktive Persona am Anfang des Flows, bevor der User eine Wahl getroffen hat. Leer = kein Kontext." />
          </p>
          <p className="text-[10px] text-gray-400">→ Einstellbar unter <em>Bot</em>-Tab</p>
        </div>
      )}
    </div>
  );
}

// ── Bot Config Tab ────────────────────────────────────────────────────────────

const ENV_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? '';

function BotConfigTab({ config, personas, onUpdate }: { config: BotConfig; personas: PersonaConfig[]; onUpdate: (c: BotConfig) => void }) {
  const set = (patch: Partial<BotConfig>) => onUpdate({...config, ...patch});
  return (
    <div className="space-y-3">
      <InfoBanner>
        Wird als <code className="bg-blue-100 px-1 rounded">config.yml</code> exportiert.
      </InfoBanner>
      <Field label="Bot-Name" hint="Anzeigename in der Chat-Oberfläche.">
        <input className={inp} value={config.name} onChange={e => set({name: e.target.value})} />
      </Field>
      <Field label="Avatar (Emoji)" hint="Emoji-Symbol neben Bot-Nachrichten.">
        <input className={`${inp} text-xl`} value={config.avatar} onChange={e => set({avatar: e.target.value})} />
      </Field>
      <Field label="Tagline">
        <input className={inp} value={config.tagline} onChange={e => set({tagline: e.target.value})} />
      </Field>
      <Field label="Standard-Persona" hint="Aktive Persona am Anfang des Flows (vor der Rollenwahl). Leer = keine Persona aktiv.">
        <select className={`${inp} bg-white`} value={config.defaultPersona ?? ''}
          onChange={e => set({defaultPersona: e.target.value || undefined})}>
          <option value="">– keine (vor Rollenwahl) –</option>
          {personas.map(p => <option key={p.id} value={p.id}>👤 {p.label}</option>)}
        </select>
      </Field>
      <details>
        <summary className="text-[11px] text-gray-500 cursor-pointer hover:text-gray-700 font-medium">⚙️ Technische Einstellungen</summary>
        <div className="mt-2 space-y-3">
          <Field label="LLM-Modell" hint="OpenAI-Modell für alle LLM-Aufrufe.">
            <select className={`${inp} bg-white`} value={config.apiModel} onChange={e => set({apiModel: e.target.value})}>
              <option value="gpt-4.1-mini">gpt-4.1-mini (schnell, günstig)</option>
              <option value="gpt-4.1">gpt-4.1 (präzise)</option>
              <option value="gpt-4o">gpt-4o (multimodal)</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </select>
          </Field>
          <Field label="MCP-Server URL" hint="Standard-URL für WLO-Suche in Chat-Knoten.">
            <input className={`${inp} font-mono text-[10px]`} value={config.mcpServerUrl} onChange={e => set({mcpServerUrl: e.target.value})} />
          </Field>
          {ENV_KEY ? (
            <div className="flex items-center gap-2 px-2.5 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-600 text-xs">✅</span>
              <span className="text-[11px] text-green-700 font-medium">API-Schlüssel aus <code>VITE_OPENAI_API_KEY</code></span>
            </div>
          ) : (
            <Field label="API-Schlüssel (Vorschau)" hint="OpenAI-Schlüssel für die Live-Vorschau. Bleibt lokal – wird nicht exportiert.">
              <input className={`${inp} font-mono text-[10px]`} type="password"
                value={config.apiKey ?? ''} placeholder="sk-..."
                onChange={e => set({apiKey: e.target.value || undefined})} />
            </Field>
          )}
        </div>
      </details>
    </div>
  );
}
