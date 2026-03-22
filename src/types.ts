// ── Node types ────────────────────────────────────────────────────────────────
//
//  BLAU  – Gesprächsschritte
//    message     Bot sendet Nachricht (Begrüßung, FAQ, Info)
//    input       User tippt Freitext → wird als Variable gespeichert
//    chat        Freier KI-Dialog (MCP-Suche optional)
//
//  AMBER – Verzweigungen
//    choice      User wählt eine Option (Buttons)
//    gateway     KI-Weiche nach Intent / Persona / Bedingung
//
//  Kein Start- / Ende-Knoten mehr:
//    → Erster Knoten ohne eingehende Kante = Gesprächseinstieg (Begrüßung)
//    → Neustart / Rücksprung als Option in choice (next: '__restart' | '__back')
//
//  Folgende Typen existieren nur für Rückwärtskompatibilität beim YAML-Import:
//    tool_mcp · tool_rag · persona_set · api_call · set_var · handoff

export type FlowStepType =
  | 'message' | 'choice' | 'input' | 'chat'
  | 'gateway'
  | 'tool_mcp' | 'tool_rag'
  | 'persona_set'
  | 'api_call' | 'set_var' | 'handoff'
  | 'start' | 'end';  // legacy – kept for YAML import compat only

// ── Supporting interfaces ─────────────────────────────────────────────────────

export interface FlowOption {
  id: string;
  label: string;
  value: string;
  uri?: string;
  persona?: string;   // activates this persona when chosen
  primary?: boolean;
  next?: string;      // overrides step-level next for this option (loop / back-jump)
                      // special values: '__restart' | '__back'
}

/** One branch of a Gateway node */
export interface GatewayBranch {
  id: string;
  label: string;
  // For splitBy='condition':
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains';
  value?: string;
  // For splitBy='persona':
  personaId?: string;
  // For splitBy='intent' (regex pattern):
  intentPattern?: string;
  // For splitBy='ai_intent' (LLM classifies user text — no fixed pattern needed):
  intentDescription?: string;
}

/** One knowledge base selectable in a RAG node */
export interface RagBase {
  id: string;
  label: string;
  description?: string;
}

// ── Docked attachment interfaces (defined before NodeData) ────────────────────

export interface DockedTool {
  stepId: string;
  stepType: 'tool_mcp' | 'tool_rag';
  message?: string;
  mcpServer?: string;
  mcpTools?: string[];
  toolParams?: Record<string, string>;
  personaToolParams?: Record<string, Record<string, string>>;
  ragBases?: RagBase[];
  queryTemplate?: string;
}

export interface DockedPersona {
  personaMode: 'set' | 'default' | 'inherit';
  personaId?: string;
}

// ── NodeData ──────────────────────────────────────────────────────────────────

export interface NodeData {
  stepType: FlowStepType;
  stepId: string;

  // ── Universal ──────────────────────────────────────────────────────────────
  message?: string;
  personaMessages?: Record<string, string>;  // persona-id → message text
  suggestions?: string[];
  notes?: string;

  // ── FLOW: choice ──────────────────────────────────────────────────────────
  options?: FlowOption[];
  multiSelect?: boolean;      // true = multiple allowed (checkbox style)
  skipLabel?: string;
  field?: string;             // profile field to store the answer in

  // ── FLOW: input ────────────────────────────────────────────────────────────
  placeholder?: string;       // also used as hint in choice

  // ── GATEWAY ────────────────────────────────────────────────────────────────
  splitBy?: 'condition' | 'persona' | 'intent' | 'ai_intent';
  branches?: GatewayBranch[];

  // ── TOOLS: tool_mcp ────────────────────────────────────────────────────────
  mcpServer?: string;         // overrides botConfig.mcpServerUrl when set
  mcpTools?: string[];        // [] = all available tools; or list specific names
  toolParams?: Record<string, string>;
  personaToolParams?: Record<string, Record<string, string>>;

  // ── TOOLS: tool_rag ────────────────────────────────────────────────────────
  ragBases?: RagBase[];
  queryTemplate?: string;

  // ── PERSONA: persona_set ───────────────────────────────────────────────────
  personaMode?: 'inherit' | 'default' | 'set';
  personaId?: string;

  // ── AKTIONEN: api_call ─────────────────────────────────────────────────────
  apiUrl?: string;                           // URL, supports {{ }} templates
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  apiHeaders?: Record<string, string>;       // optional request headers
  apiBody?: string;                          // JSON body template
  apiResultVar?: string;                     // context key to store response

  // ── AKTIONEN: set_var ──────────────────────────────────────────────────────
  variables?: Array<{ key: string; value: string }>;  // key = value (template)

  // ── AKTIONEN: handoff ─────────────────────────────────────────────────────
  handoffTarget?: string;                    // queue / agent group name
  handoffMessage?: string;                   // optional farewell message

  // ── DOCKED ATTACHMENTS ────────────────────────────────────────────
  // Tool and persona modules rendered inline within this workflow node
  dockedTools?: DockedTool[];
  dockedPersona?: DockedPersona;
}

// ── Project-level config ──────────────────────────────────────────────────────

export interface PersonaConfig {
  id: string;
  label: string;
  uri: string;
  systemPrompt: string;
}

export interface BotConfig {
  name: string;
  avatar: string;
  tagline: string;
  apiModel: string;
  mcpServerUrl: string;
  defaultPersona?: string;  // persona-id active when none set; empty = no persona
  apiKey?: string;          // OpenAI API key for live preview (NOT exported to YAML)
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: import('reactflow').Node<NodeData>[];
  edges: import('reactflow').Edge[];
  personas: PersonaConfig[];
  botConfig: BotConfig;
}

// ── Node type → React Flow component mapping ──────────────────────────────────

export const NODE_TYPE_MAP: Record<FlowStepType, string> = {
  message:     'messageNode',
  choice:      'choiceNode',
  input:       'inputNode',
  chat:        'chatNode',
  gateway:     'gatewayNode',
  tool_mcp:    'toolMcpNode',
  tool_rag:    'toolRagNode',
  persona_set: 'personaSetNode',
  api_call:    'apiCallNode',
  set_var:     'setVarNode',
  handoff:     'messageNode',  // legacy → render as message node
  start:       'messageNode',  // legacy → render as message node
  end:         'messageNode',  // legacy → render as message node
};

export const NODE_LABELS: Record<FlowStepType, string> = {
  message:     'Nachricht',
  choice:      'Auswahl',
  input:       'Eingabe',
  chat:        'Freier Chat',
  gateway:     'Weiche',
  tool_mcp:    'MCP Tool',
  tool_rag:    'RAG Suche',
  persona_set: 'Persona',
  api_call:    'API-Aufruf',
  set_var:     'Variable setzen',
  handoff:     'Nachricht',
  start:       'Nachricht',
  end:         'Nachricht',
};

// Blue  → message, input, chat, + compat types
// Amber → choice, gateway
const BLUE  = { bg: 'bg-blue-50',  border: 'border-blue-200',  header: 'bg-blue-600',  text: 'text-white' };
const AMBER = { bg: 'bg-amber-50', border: 'border-amber-300', header: 'bg-amber-500', text: 'text-white' };
export const NODE_COLORS: Record<FlowStepType, { bg: string; border: string; header: string; text: string }> = {
  message:     BLUE,
  input:       BLUE,
  chat:        BLUE,
  choice:      AMBER,
  gateway:     AMBER,
  tool_mcp:    { bg: 'bg-teal-50',   border: 'border-teal-300',   header: 'bg-teal-700',   text: 'text-white' },
  tool_rag:    { bg: 'bg-teal-50',   border: 'border-teal-300',   header: 'bg-teal-600',   text: 'text-white' },
  persona_set: { bg: 'bg-purple-50', border: 'border-purple-300', header: 'bg-purple-600', text: 'text-white' },
  api_call:    BLUE,
  set_var:     BLUE,
  handoff:     BLUE,
  start:       BLUE,
  end:         BLUE,
};

// Palette groups shown in sidebar (5 core building blocks)
export const PALETTE_GROUPS: { group: string; items: { type: FlowStepType; emoji: string; desc: string }[] }[] = [
  {
    group: 'Gesprächsbausteine',
    items: [
      { type: 'message', emoji: '💬', desc: 'Bot sendet einen Text oder FAQ-Hinweis' },
      { type: 'input',   emoji: '✏️', desc: 'User gibt Freitext ein' },
      { type: 'chat',    emoji: '🗨️', desc: 'Freier KI-Dialog (MCP optional)' },
      { type: 'choice',  emoji: '🗳️', desc: 'Auswahl per Schaltfläche' },
      { type: 'gateway', emoji: '🔀', desc: 'KI-Weiche – verzweigt nach Absicht' },
    ],
  },
];

// Flat list for drag-and-drop detection
export const PALETTE_NODES = PALETTE_GROUPS.flatMap(g => g.items);

export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: 'Boerdi',
  avatar: '🦉',
  tagline: 'Dein persönlicher Guide für WirLernenOnline.de',
  apiModel: 'gpt-4.1-mini',
  mcpServerUrl: 'https://wlo-mcp-server.vercel.app/mcp',
  defaultPersona: '',
};

export const DEFAULT_PERSONAS: PersonaConfig[] = [
  { id: 'learner',    label: 'Lerner/in',  uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    systemPrompt: '# Lerner/in\n\nDu bist Boerdi, ein freundlicher Lernbegleiter. Sprich Schüler:innen und Lernende direkt an (Du). Nutze einfache, klare Sprache und erkläre Konzepte anschaulich.' },
  { id: 'teacher',   label: 'Lehrer/in',  uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',   systemPrompt: '# Lehrer/in\n\nDu bist Boerdi, ein professioneller Assistent für Lehrende. Sieze die Nutzer:innen. Gehe auf fachdidaktische und methodische Aspekte ein. Weise auf Differenzierungsmöglichkeiten hin.' },
  { id: 'counsellor',label: 'Berater/in', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', systemPrompt: '# Berater/in\n\nDu bist Boerdi, ein Assistent für Bildungsberatende. Sieze die Nutzer:innen. Gehe auf strukturelle und organisatorische Fragen ein. Liefere überblickartige Informationen.' },
  { id: 'parent',    label: 'Eltern',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/parent',    systemPrompt: '# Eltern\n\nDu bist Boerdi, ein freundlicher Assistent für Eltern. Erkläre Inhalte verständlich, gehe auf häusliches Lernen und Unterstützung der Kinder ein. Sprich die Nutzer:innen mit Sie an.' },
  { id: 'author',    label: 'Autor/in',   uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/author',    systemPrompt: '# Autor/in\n\nDu bist Boerdi, ein Assistent für Materialersteller:innen. Sieze die Nutzer:innen. Gehe auf OER-Lizenzierung, Metadatenqualität und didaktische Aufbereitung ein.' },
  { id: 'manager',   label: 'Verwaltung', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/manager',   systemPrompt: '# Verwaltung / Schulleitung\n\nDu bist Boerdi, ein Assistent für Verwaltung und Schulleitung. Sieze die Nutzer:innen. Liefere überblickartige Ressourcenübersichten und beziehe dich auf Schulentwicklung.' },
  { id: 'other',     label: 'Andere',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',     systemPrompt: '# Allgemein\n\nDu bist Boerdi, ein hilfreicher Assistent für WirLernenOnline.de. Hilf beim Erkunden von Bildungsressourcen.' },
];
