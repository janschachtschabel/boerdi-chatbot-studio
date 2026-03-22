import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Node, Edge } from 'reactflow';
import type { NodeData, PersonaConfig, BotConfig } from './types';
import { exportToYaml } from './yamlUtils';
import * as yaml from 'js-yaml';
import { RotateCcw, Send, X } from 'lucide-react';

const ENV_KEY = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? '';

// ── Runtime types (mirrors config.service.ts structures) ─────────────────────

interface YamlPersona { id: string; label?: string; systemPrompt?: string; }
interface YamlOption  { label: string; value: string; next?: string; persona?: string; primary?: boolean; }
interface YamlBranch  { label: string; next?: string; personaId?: string; intentDescription?: string; }
interface YamlStep {
  id: string;
  type: string;
  message?: string;
  personaMessages?: Record<string, string>;
  options?: YamlOption[];
  next?: string;
  field?: string;
  placeholder?: string;
  suggestions?: string[];
  splitBy?: string;
  branches?: YamlBranch[];
  default?: string;
  dockedPersona?: { mode: string; personaId?: string };
  dockedTools?: Array<{ type: string; tools?: string[] }>;
  // api_call fields
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  onError?: string;
  onSuccess?: string;
  resultVar?: string;
  // set_var fields
  variables?: Array<{ key: string; value: string }> | Record<string, string>;
}
interface YamlConfig {
  bot?: { name?: string; avatar?: string; tagline?: string };
  api?: { model?: string; mcpServerUrl?: string };
  personas?: YamlPersona[];
  flow?: { start?: string; steps?: YamlStep[] };
}

interface ChatMsg {
  id: string;
  role: 'bot' | 'user' | 'loading';
  text: string;
  options?: YamlOption[];
  suggestions?: string[];
}

interface LlmMsg { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: any[]; tool_call_id?: string; }

// ── WLO tool definitions for LLM ─────────────────────────────────────────────

const WLO_TOOLS = [
  { type: 'function', function: { name: 'search_wlo_collections', description: 'Sucht Themenseiten/Sammlungen auf WirLernenOnline.de (für Themenrecherche).', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'search_wlo_content',     description: 'Sucht konkrete Lernmaterialien auf WirLernenOnline.de (Videos, Arbeitsblätter etc.).', parameters: { type: 'object', properties: { query: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'get_collection_contents', description: 'Ruft Materialien einer WLO-Sammlung ab.', parameters: { type: 'object', properties: { nodeId: { type: 'string' }, contentFilter: { type: 'string' }, maxResults: { type: 'number' } }, required: ['nodeId'] } } },
  { type: 'function', function: { name: 'get_node_details',        description: 'Detailinfos zu einer WLO-NodeId.', parameters: { type: 'object', properties: { nodeId: { type: 'string' } }, required: ['nodeId'] } } },
  { type: 'function', function: { name: 'get_wirlernenonline_info', description: 'Informationen über WirLernenOnline als Plattform.', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_edu_sharing_network_info', description: 'Infos von edu-sharing-network.org.', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_edu_sharing_product_info', description: 'Infos von edu-sharing.com Produkt.', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_metaventis_info',          description: 'Infos von metaventis.com.', parameters: { type: 'object', properties: { path: { type: 'string' } } } } },
  { type: 'function', function: { name: 'lookup_wlo_vocabulary',         description: 'Gibt gültige Filterwerte (URIs) für Bildungsstufe, Fach, Zielgruppe oder Ressourcentyp zurück. VOR jeder Suche mit Filtern aufrufen, um korrekte URI-Parameterwerte zu erhalten.', parameters: { type: 'object', properties: { vocabulary: { type: 'string', enum: ['educationLevel', 'subject', 'audience', 'resourceType'], description: 'Welches Vokabular abgefragt werden soll' } }, required: ['vocabulary'] } } },
];

// ── Module-level LLM / MCP helpers (no component closure) ──────────────────

async function callMcp(toolName: string, args: Record<string, unknown>, mcpUrl: string): Promise<string> {
  const url = mcpUrl.replace(/\/$/, '');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/call', params: { name: toolName, arguments: args }, id: Date.now() }),
  });
  if (!r.ok) throw new Error(`MCP ${r.status}`);
  const raw = await r.text();
  let data: any;
  try { data = JSON.parse(raw); }
  catch {
    const line = raw.split('\n').find(l => l.startsWith('data:'));
    data = line ? JSON.parse(line.slice(5)) : null;
  }
  if (!data) throw new Error('Unbekanntes MCP-Antwortformat');
  if (data.error) throw new Error(data.error.message);
  const content = data.result?.content ?? [];
  return content.filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('\n\n');
}

async function llmCall(
  messages: LlmMsg[], sys: string, model: string, apiKey: string, tools?: any[]
): Promise<{ finish_reason: string; message: any }> {
  const body: any = { model, messages: [{ role: 'system', content: sys }, ...messages] };
  if (tools?.length) body.tools = tools;
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return { finish_reason: data.choices[0]?.finish_reason, message: data.choices[0]?.message };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _counter = 0;
const uid = () => `pm-${++_counter}`;
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

function simpleMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-blue-600 underline break-all">$1</a>')
    .replace(/^### (.+)$/gm, '<div class="font-bold text-[11px] mt-2">$1</div>')
    .replace(/^## (.+)$/gm,  '<div class="font-bold text-xs mt-2">$1</div>')
    .replace(/^# (.+)$/gm,   '<div class="font-bold text-xs mt-2">$1</div>')
    .replace(/^- (.+)$/gm,   '<div class="ml-2 text-[11px]">• $1</div>')
    .replace(/\n\n/g, '<div class="mt-1.5"></div>')
    .replace(/\n/g, '<br/>');
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FlowPreview({
  nodes, edges, personas, botConfig, onClose,
}: {
  nodes: Node<NodeData>[];
  edges: Edge[];
  personas: PersonaConfig[];
  botConfig: BotConfig;
  onClose?: () => void;
}) {
  const [messages,      setMessages]      = useState<ChatMsg[]>([]);
  const [input,         setInput]         = useState('');
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [personaId,     setPersonaId]     = useState<string>(botConfig.defaultPersona ?? '');
  const [isLoading,     setIsLoading]     = useState(false);
  const [chatHistory,   setChatHistory]   = useState<LlmMsg[]>([]);
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [profile,       setProfile]       = useState<Record<string, string>>({});
  const bottomRef      = useRef<HTMLDivElement>(null);
  const startedRef     = useRef(false);          // guard against React StrictMode double-invoke
  const chatHistoryRef = useRef<LlmMsg[]>([]);   // always-fresh snapshot for effects
  const personaIdRef   = useRef<string>('');     // always-fresh persona for effects
  const autoSearchedRef= useRef(new Set<string>());  // tracks which chat steps have been auto-searched

  // Parse exported YAML to runtime config
  const getConfig = useCallback((): YamlConfig | null => {
    try {
      const yamlStr = exportToYaml(nodes, edges, personas, botConfig);
      return yaml.load(yamlStr) as YamlConfig;
    } catch (e) {
      console.error('[FlowPreview] YAML parse error', e);
      return null;
    }
  }, [nodes, edges, personas, botConfig]);

  const getStep = (cfg: YamlConfig, id: string): YamlStep | undefined =>
    cfg.flow?.steps?.find(s => s.id === id);

  const getPersonaPrompt = (cfg: YamlConfig, pid: string): string =>
    cfg.personas?.find(p => p.id === pid)?.systemPrompt
    ?? 'Du bist ein hilfreicher Assistent für WirLernenOnline.de.';

  const interpolate = useCallback((text: string, prof: Record<string, string>): string => {
    return text
      .replace(/\{\{\s*profile\.(\w+)\s*\}\}/g, (_, key) => prof[key] ?? `{{profile.${key}}}`)
      .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => prof[key] ?? `{{${key}}}`);
  }, []);

  const getMsg = (step: YamlStep, pid: string, prof: Record<string, string> = {}): string => {
    const raw = step.personaMessages?.[pid]
      ?? Object.values(step.personaMessages ?? {}).find(Boolean)
      ?? step.message ?? '';
    return interpolate(raw, prof);
  };

  // ── Message helpers ───────────────────────────────────────────────────────
  const addMsg = useCallback((msg: Omit<ChatMsg, 'id'>): string => {
    const id = uid();
    setMessages(prev => [...prev, { ...msg, id }]);
    return id;
  }, []);

  const replaceMsg = useCallback((id: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text, role: 'bot' as const } : m));
  }, []);

  const removeMsg = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  const disableOptions = useCallback(() => {
    setMessages(prev => prev.map(m => ({ ...m, options: undefined })));
  }, []);

  // ── Flow execution ────────────────────────────────────────────────────────
  const runFrom = useCallback(async (
    startId: string,
    cfg: YamlConfig,
    pid: string,
    hist: LlmMsg[],
    prof: Record<string, string> = {},
  ): Promise<void> => {
    let id: string | undefined = startId;
    let curPid = pid;

    while (id) {
      const step = getStep(cfg, id);
      if (!step) break;

      setCurrentStepId(step.id);

      // Activate dockedPersona
      if (step.dockedPersona?.mode === 'set' && step.dockedPersona.personaId) {
        curPid = step.dockedPersona.personaId;
        setPersonaId(curPid);
      }

      const msg = getMsg(step, curPid, prof);

      if (step.type === 'message') {
        addMsg({ role: 'bot', text: msg });
        if (msg) hist = [...hist, { role: 'assistant' as const, content: msg }];
        await delay(350);
        id = step.next;
        continue;
      }

      if (step.type === 'choice') {
        addMsg({ role: 'bot', text: msg, options: step.options });
        if (msg) hist = [...hist, { role: 'assistant' as const, content: msg }];
        setChatHistory(hist);
        setPersonaId(curPid);
        break;
      }

      if (step.type === 'input' || step.type === 'freetext') {
        addMsg({ role: 'bot', text: msg, suggestions: step.suggestions });
        if (msg) hist = [...hist, { role: 'assistant' as const, content: msg }];
        setChatHistory(hist);
        setPersonaId(curPid);
        break;
      }

      if (step.type === 'chat') {
        const chatMsg = msg || 'Wie kann ich dir helfen?';
        addMsg({ role: 'bot', text: chatMsg, suggestions: step.suggestions });
        hist = [...hist, { role: 'assistant' as const, content: chatMsg }];
        setChatHistory(hist);
        setPersonaId(curPid);
        break;
      }

      if (step.type === 'gateway') {
        if (step.splitBy === 'ai_intent') {
          addMsg({ role: 'bot', text: step.message ?? 'Wie kann ich dir helfen?', suggestions: step.suggestions });
          setChatHistory(hist);
          setPersonaId(curPid);
          break;
        }
        // Immediate routing (condition / persona)
        const nextId = resolveGateway(step, curPid);
        id = nextId ?? step.default;
        continue;
      }

      if (step.type === 'handoff') {
        const farewell = step.message ?? 'Du wirst weitergeleitet …';
        addMsg({ role: 'bot', text: farewell });
        if (step.next) { await delay(300); id = step.next; } else break;
        continue;
      }

      if (step.type === 'set_var') {
        const vars = step.variables;
        const updates: Record<string, string> = {};
        if (Array.isArray(vars)) {
          for (const entry of vars) updates[entry.key] = interpolate(String(entry.value ?? ''), prof);
        } else if (vars && typeof vars === 'object') {
          for (const [k, v] of Object.entries(vars)) updates[k] = interpolate(String(v), prof);
        }
        prof = { ...prof, ...updates };
        setProfile(prev => ({ ...prev, ...updates }));
        id = step.next;
        continue;
      }

      if (step.type === 'api_call') {
        const rawUrl = step.url ?? '';
        const resolvedUrl = interpolate(rawUrl, prof);
        const statusId = addMsg({ role: 'loading', text: '' });
        try {
          const res = await fetch(resolvedUrl, {
            method: step.method ?? 'GET',
            headers: { 'Content-Type': 'application/json', ...(step.headers ?? {}) },
            ...(step.body ? { body: interpolate(step.body, prof) } : {}),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          // Flatten top-level response keys into profile
          const flat: Record<string, string> = {};
          const varKey = step.resultVar ?? 'apiResult';
          flat[varKey] = JSON.stringify(data);
          if (typeof data === 'object' && data !== null) {
            for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
              flat[k] = String(v);
              flat[`${varKey}.${k}`] = String(v);
            }
          }
          prof = { ...prof, ...flat };
          setProfile(prev => ({ ...prev, ...flat }));
          removeMsg(statusId);
          id = step.onSuccess ?? step.next;
        } catch (e: any) {
          removeMsg(statusId);
          const errKey = `${step.resultVar ?? 'apiResult'}.error`;
          prof = { ...prof, [errKey]: e.message };
          setProfile(prev => ({ ...prev, [errKey]: e.message }));
          id = step.onError ?? step.next;
        }
        continue;
      }

      // Unknown step type — skip and follow next to prevent hanging
      if (step.next) { id = step.next; continue; }
      break;
    }
  }, [addMsg]);

  const resolveGateway = (step: YamlStep, pid: string): string | undefined => {
    for (const b of step.branches ?? []) {
      if (step.splitBy === 'persona' && b.personaId === pid) return b.next;
    }
    return step.default;
  };

  // ── Start / reset ─────────────────────────────────────────────────────────
  const startFlow = useCallback(() => {
    setMessages([]);
    setChatHistory([]);
    setProfile({});
    autoSearchedRef.current.clear();
    setApiError(null);
    setInput('');
    const cfg = getConfig();
    if (!cfg) {
      setMessages([{ id: uid(), role: 'bot', text: '⚠️ Flow konnte nicht geparst werden. Prüfe die Knotenverbindungen.' }]);
      return;
    }
    const startId = cfg.flow?.start ?? cfg.flow?.steps?.[0]?.id;
    if (!startId) {
      setMessages([{ id: uid(), role: 'bot', text: '⚠️ Kein Startknoten gefunden. Verbinde einen Start-Knoten mit dem ersten Schritt.' }]);
      return;
    }
    const initPid = botConfig.defaultPersona ?? '';
    setPersonaId(initPid);
    setCurrentStepId(startId);
    runFrom(startId, cfg, initPid, [], {});
  }, [getConfig, botConfig, runFrom]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startFlow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep refs in sync
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);
  useEffect(() => { personaIdRef.current = personaId; }, [personaId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Auto-search: when entering a chat step with docked MCP tools ─────────
  useEffect(() => {
    if (!currentStepId) return;
    if (autoSearchedRef.current.has(currentStepId)) return;
    const apiKey = ENV_KEY || botConfig.apiKey || '';
    if (!apiKey) return;
    const cfg = getConfig();
    if (!cfg) return;
    const step = getConfig() ? cfg.flow?.steps?.find(s => s.id === currentStepId) : undefined;
    if (!step || step.type !== 'chat') return;
    const mcpList = (step.dockedTools ?? []).filter((t: any) => t.type === 'tool_mcp');
    if (!mcpList.length) return;
    autoSearchedRef.current.add(currentStepId);
    const pid     = personaIdRef.current;
    const hist    = chatHistoryRef.current;
    const allowed = [...new Set(mcpList.flatMap((t: any) => (t.tools ?? []) as string[]))];
    const tools   = allowed.length ? WLO_TOOLS.filter(t => allowed.includes(t.function.name)) : WLO_TOOLS;
    const mcpUrl  = botConfig.mcpServerUrl || cfg.api?.mcpServerUrl || 'https://wlo-mcp-server.vercel.app/mcp';
    const model   = cfg.api?.model || botConfig.apiModel || 'gpt-4.1-mini';
    const sysPr   = getPersonaPrompt(cfg, pid)
      + '\n\nFühre jetzt eine initiale WLO-Suche durch. '
      + 'Rufe zuerst lookup_wlo_vocabulary (educationLevel, dann subject) auf um korrekte URI-Filterwerte zu erhalten, '
      + 'dann search_wlo_collections mit den Profildaten aus dem Gesprächsverlauf. '
      + 'Fasse die Ergebnisse auf Deutsch zusammen.';
    (async () => {
      const loadId = addMsg({ role: 'loading', text: '' });
      setIsLoading(true);
      setApiError(null);
      try {
        let curHist = [...hist];
        let finalReply = '';
        let keepGoing = true;
        while (keepGoing) {
          const result = await llmCall(curHist, sysPr, model, apiKey, tools);
          if (result.finish_reason === 'tool_calls') {
            curHist = [...curHist, { role: 'assistant', content: result.message.content ?? '', tool_calls: result.message.tool_calls }];
            for (const tc of result.message.tool_calls ?? []) {
              const args = JSON.parse(tc.function.arguments || '{}');
              try {
                const res = await callMcp(tc.function.name, args, mcpUrl);
                curHist = [...curHist, { role: 'tool', tool_call_id: tc.id, content: res }];
              } catch (e: any) {
                curHist = [...curHist, { role: 'tool', tool_call_id: tc.id, content: `Fehler: ${e.message}` }];
              }
            }
          } else {
            finalReply = result.message.content ?? '(keine Ergebnisse)';
            keepGoing = false;
          }
        }
        curHist = [...curHist, { role: 'assistant', content: finalReply }];
        setChatHistory(curHist);
        replaceMsg(loadId, finalReply);
      } catch (e: any) {
        replaceMsg(loadId, `❌ ${e.message}`);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentStepId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Option click ──────────────────────────────────────────────────────────
  const selectOption = async (opt: YamlOption) => {
    disableOptions();
    setMessages(prev => [...prev, { id: uid(), role: 'user', text: opt.label }]);
    const cfg = getConfig();
    if (!cfg) return;
    const step = getStep(cfg, currentStepId ?? '');
    let pid = personaId;
    if (opt.persona) { pid = opt.persona; setPersonaId(pid); }
    // Add user choice to history so LLM has context in later chat steps
    const newHist: LlmMsg[] = [...chatHistory, { role: 'user' as const, content: opt.label }];
    setChatHistory(newHist);
    const nextId = opt.next ?? step?.next;
    if (nextId === '__restart') { startFlow(); return; }
    if (nextId === '__back')    { return; }
    if (nextId) { await delay(200); runFrom(nextId, cfg, pid, newHist, profile); }
  };

  // ── User sends a message ──────────────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    setMessages(prev => [...prev, { id: uid(), role: 'user', text: trimmed }]);
    const cfg = getConfig();
    if (!cfg) return;
    const step = getStep(cfg, currentStepId ?? '');
    if (!step) return;

    if (step.type === 'input' || step.type === 'freetext') {
      // Store in profile for {{profile.field}} interpolation in later messages
      const newProfile = step.field ? { ...profile, [step.field]: trimmed } : profile;
      if (step.field) setProfile(newProfile);
      // Add user answer to history so LLM has context in later chat steps
      const newHist: LlmMsg[] = [...chatHistory, { role: 'user' as const, content: trimmed }];
      setChatHistory(newHist);
      await delay(200);
      if (step.next) runFrom(step.next, cfg, personaId, newHist, newProfile);
      return;
    }

    if (step.type === 'gateway' && step.splitBy === 'ai_intent') {
      await classifyAndRoute(trimmed, step, cfg);
      return;
    }

    // chat step (or fallback)
    await sendChat(trimmed, step, cfg);
  };

  // ── AI Intent classify ────────────────────────────────────────────────────
  const classifyAndRoute = async (text: string, step: YamlStep, cfg: YamlConfig) => {
    if (!resolvedKey) { setApiError('Kein API-Schlüssel – LLM nicht verfügbar.'); return; }
    const loadId = addMsg({ role: 'loading', text: '' });
    setIsLoading(true);
    setApiError(null);
    try {
      const branches = step.branches ?? [];
      const list = branches.map((b, i) => `${i}: ${b.label}${b.intentDescription ? ' – ' + b.intentDescription : ''}`).join('\n');
      const reply = (await llmCall(
        [{ role: 'user', content: `Klassifiziere die Nutzeranfrage in eine Kategorie.\n\nEingabe: "${text}"\n\nKategorien:\n${list}\n\nAntworte NUR mit der Zahl (0,1,…) oder "default".` }],
        'Du klassifizierst Nutzeranfragen. Antworte nur mit einer einzelnen Zahl oder "default".',
        getModel(cfg),
        resolvedKey,
      )).message?.content ?? '';
      removeMsg(loadId);
      const idx = parseInt(reply.trim(), 10);
      const branch = (!isNaN(idx) && idx < branches.length) ? branches[idx] : null;
      let pid = personaId;
      if (branch?.personaId) { pid = branch.personaId; setPersonaId(pid); }
      const nextId = branch?.next ?? step.default;
      if (nextId) runFrom(nextId, cfg, pid, chatHistory);
    } catch (e: any) {
      replaceMsg(loadId, `❌ Fehler: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Chat with tools ───────────────────────────────────────────────────────
  const sendChat = async (text: string, step: YamlStep, cfg: YamlConfig) => {
    if (!resolvedKey) {
      setApiError('Kein API-Schlüssel. Bitte VITE_OPENAI_API_KEY setzen oder im Bot-Tab eintragen.');
      return;
    }
    const loadId = addMsg({ role: 'loading', text: '' });
    setIsLoading(true);
    setApiError(null);

    const basePrompt   = getPersonaPrompt(cfg, personaId);
    const mcpDocked    = (step.dockedTools ?? []).filter(t => t.type === 'tool_mcp');
    const hasMcp       = mcpDocked.length > 0;
    // Collect all allowed tool names across all docked MCP tools
    const allowed      = hasMcp ? [...new Set(mcpDocked.flatMap(t => t.tools ?? []))] : [];
    const tools        = hasMcp ? (allowed.length ? WLO_TOOLS.filter(t => allowed.includes(t.function.name)) : WLO_TOOLS) : [];
    const mcpUrl       = botConfig.mcpServerUrl || cfg.api?.mcpServerUrl || 'https://wlo-mcp-server.vercel.app/mcp';
    // Append tool-usage instruction so LLM proactively calls the tools
    const toolHint     = hasMcp
      ? '\n\nWICHTIG: Nutze die WLO-Suchwerkzeuge aktiv. Rufe zuerst lookup_wlo_vocabulary (educationLevel, subject) auf, '
        + 'um gültige URI-Filterwerte zu erhalten. Dann search_wlo_collections oder search_wlo_content mit diesen Werten. '
        + 'Antworte auf Deutsch.'
      : '';
    const systemPrompt = basePrompt + toolHint;

    const hist: LlmMsg[] = [...chatHistory, { role: 'user', content: text }];

    try {
      let finalReply = '';
      let keepGoing  = true;
      let curHist    = hist;

      while (keepGoing) {
        const result = await llmCall(curHist, systemPrompt, getModel(cfg), resolvedKey, tools);

        if (result.finish_reason === 'tool_calls') {
          curHist = [...curHist, { role: 'assistant', content: result.message.content ?? '', tool_calls: result.message.tool_calls }];
          for (const tc of result.message.tool_calls ?? []) {
            const args = JSON.parse(tc.function.arguments || '{}');
            try {
              const res = await callMcp(tc.function.name, args, mcpUrl);
              curHist = [...curHist, { role: 'tool', tool_call_id: tc.id, content: res }];
            } catch (e: any) {
              curHist = [...curHist, { role: 'tool', tool_call_id: tc.id, content: `Fehler: ${e.message}` }];
            }
          }
        } else {
          finalReply = result.message.content ?? '(keine Antwort)';
          keepGoing  = false;
        }
      }

      curHist = [...curHist, { role: 'assistant', content: finalReply }];
      setChatHistory(curHist);
      replaceMsg(loadId, finalReply);
    } catch (e: any) {
      replaceMsg(loadId, `❌ ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── LLM helpers ───────────────────────────────────────────────────────────
  const resolvedKey = ENV_KEY || botConfig.apiKey || '';
  const getModel = (cfg: YamlConfig) => cfg.api?.model || botConfig.apiModel || 'gpt-4.1-mini';

  // ── Derived state ─────────────────────────────────────────────────────────
  const currentStep  = (() => { const cfg = getConfig(); return cfg ? getStep(cfg, currentStepId ?? '') : undefined; })();
  const suggestions  = currentStep?.suggestions ?? [];
  const placeholder  = currentStep?.placeholder ?? 'Nachricht…';
  const inputActive  = ['input', 'freetext', 'chat', 'gateway'].includes(currentStep?.type ?? '');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200" style={{ minWidth: 300, maxWidth: 360 }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-blue-600 text-white flex-shrink-0">
        <span className="text-lg leading-none">{botConfig.avatar || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold truncate">{botConfig.name}</p>
          <p className="text-[9px] opacity-70 truncate">{botConfig.tagline || 'Live-Vorschau'}</p>
        </div>
        <button onClick={startFlow} title="Neu starten" className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20">
          <RotateCcw size={13} />
        </button>
        {onClose && (
          <button onClick={onClose} title="Schließen" className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/20">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Warnings */}
      {!resolvedKey && (
        <div className="mx-2 mt-2 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700 flex-shrink-0">
          ⚠️ Kein API-Schlüssel – Chat-Schritte & KI-Weichen inaktiv.<br/>Setze <code>VITE_OPENAI_API_KEY</code> oder trage den Schlüssel im Bot-Tab ein.
        </div>
      )}
      {apiError && (
        <div className="mx-2 mt-1 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-600 flex-shrink-0">
          {apiError}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-2">
        {messages.map(m => (
          <div key={m.id} className="flex flex-col gap-1.5">
            {m.role === 'bot' && (
              <div className="flex gap-1.5 items-end">
                <span className="text-base leading-none flex-shrink-0 self-start mt-0.5">{botConfig.avatar || '🤖'}</span>
                <div className="flex flex-col gap-1.5 max-w-[88%]">
                  <div
                    className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2 text-[11px] text-gray-800 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(m.text) }}
                  />
                  {m.options && m.options.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pl-0.5">
                      {m.options.map((opt, i) => (
                        <button key={i} onClick={() => selectOption(opt)}
                          className={`text-[10px] px-2.5 py-1.5 rounded-full border font-medium transition-all hover:shadow-sm ${
                            opt.primary
                              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                              : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {m.role === 'user' && (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-[11px] max-w-[88%] leading-relaxed">
                  {m.text}
                </div>
              </div>
            )}
            {m.role === 'loading' && (
              <div className="flex gap-1.5 items-end">
                <span className="text-base leading-none flex-shrink-0">{botConfig.avatar || '🤖'}</span>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5">
                  <div className="flex gap-1 items-center">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {suggestions.length > 0 && !isLoading && inputActive && (
        <div className="px-2 pb-1 flex flex-wrap gap-1 flex-shrink-0">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => sendMessage(s)}
              className="text-[10px] px-2.5 py-1 rounded-full border border-gray-300 bg-white hover:bg-gray-50 text-gray-600 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Text input */}
      {inputActive && (
        <div className="flex items-center gap-1.5 px-2 py-2 border-t border-gray-100 bg-white flex-shrink-0">
          <input
            className="flex-1 text-[11px] border border-gray-200 rounded-full px-3 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-all disabled:opacity-50"
            placeholder={placeholder}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-full bg-blue-600 text-white disabled:opacity-30 hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <Send size={12} />
          </button>
        </div>
      )}

      {/* Step indicator */}
      <div className="px-3 py-1 bg-gray-50 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
        <span className="text-[9px] text-gray-400">
          Schritt: <span className="font-mono text-gray-500">{currentStepId ?? '–'}</span>
        </span>
        <span className="text-[9px] text-purple-500">
          {personaId ? `👤 ${personaId}` : ''}
        </span>
      </div>
    </div>
  );
}
