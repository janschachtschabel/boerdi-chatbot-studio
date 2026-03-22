import type { Node, Edge } from 'reactflow';
import type { NodeData, FlowTemplate, DockedTool, DockedPersona } from './types';
import { DEFAULT_BOT_CONFIG, DEFAULT_PERSONAS } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let idSeq = 1;
const id = () => `n${idSeq++}`;

function makeNode(nodeId: string, type: string, x: number, y: number, data: NodeData): Node<NodeData> {
  return { id: nodeId, type, position: { x, y }, data };
}

function makeEdge(source: string, target: string, opts: Partial<Edge> = {}): Edge {
  return {
    id: `e-${source}-${opts.sourceHandle ?? 'out'}-${target}`,
    source, target,
    sourceHandle: opts.sourceHandle ?? 'out',
    targetHandle: opts.targetHandle ?? 'in',
    ...opts,
  };
}

// ── Template 1: WLO Boerdi – aktueller Produktionsflow ───────────────────────
//
//  Start → Willkommen → [persona_set: inherit]
//       → Rollenauswahl (choice, setzt Persona)
//       → Bildungsstufe (choice)  → Thema (input)
//       → MCP Sammlungssuche (tool_mcp)
//       → MCP Inhalte (tool_mcp, persona-spezifische Params)
//       → Chat → Ende
//
//  Persona-Nachrichten auf choice + input zeigen, wie sich Boerdi je Rolle anpasst.

export function buildBoerdiWloTemplate(): FlowTemplate {
  idSeq = 100;
  const nWelcome = id(), nRole = id();
  const nEdu = id(), nInterest = id(), nChat = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nWelcome, 'messageNode', 80,   300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hi, ich bin **Boerdi** 🦉 und möchte dich bei der Suche nach Bildungsressourcen unterstützen!\n\nAuf **WirLernenOnline.de** findest du tausende freie Bildungsmaterialien (OER) – und ich helfe dir, genau das Richtige für dich zu entdecken. 👇',
    }),
    makeNode(nRole, 'choiceNode', 460, 300, {
      stepType: 'choice', stepId: 'role', field: 'role',
      message: 'Für wen suchst du Materialien? Das hilft mir, besser auf dich einzugehen.',
      options: [
        { id: 'opt-0', label: '🎒 Ich lerne (Schüler/in, Student/in)',      value: 'learner',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    persona: 'learner',    primary: true },
        { id: 'opt-1', label: '📚 Ich unterrichte (Lehrer/in)',              value: 'teacher',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',    persona: 'teacher' },
        { id: 'opt-2', label: '👪 Als Elternteil / Erziehungsberechtigte*r', value: 'parent',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/parent',     persona: 'parent' },
        { id: 'opt-3', label: '🤝 Als Berater/in',                           value: 'counsellor', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', persona: 'counsellor' },
        { id: 'opt-4', label: '✏️ Als Autor/in (Materialerstellung)',         value: 'author',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/author',     persona: 'author' },
        { id: 'opt-5', label: '🏛️ Verwaltung / Schulleitung',                value: 'manager',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/manager',    persona: 'manager' },
        { id: 'opt-6', label: '🔍 Anderes / Nur erkunden',                   value: 'other',      uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',      persona: 'other' },
      ],
    }),
    makeNode(nEdu, 'choiceNode', 984, 300, {
      stepType: 'choice', stepId: 'educationLevel', field: 'educationLevels',
      personaMessages: {
        learner: 'In welcher Schulstufe lernst du gerade?', teacher: 'Für welche Bildungsstufen unterrichten Sie?',
        counsellor: 'Auf welche Bildungsstufen bezieht sich Ihre Beratungstätigkeit?', parent: 'Welche Schulstufe besucht Ihr Kind?',
        author: 'Für welche Bildungsstufen erstellen Sie Materialien?', manager: 'Welche Bildungsstufen umfasst Ihre Einrichtung?',
        other: 'Welche Bildungsbereiche interessieren dich?',
      },
      message: 'Welche Bildungsstufe interessiert dich?',
      options: [
        { id: 'opt-0',  label: '🧒 Elementarbereich',            value: 'elementarbereich',   uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/elementarbereich' },
        { id: 'opt-1',  label: '🏫 Schule (allgemein)',           value: 'schule',             uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/schule' },
        { id: 'opt-2',  label: '📗 Primarstufe (Grundschule)',    value: 'grundschule',        uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/grundschule' },
        { id: 'opt-3',  label: '📘 Sekundarstufe I (Kl. 5–10)',  value: 'sekundarstufe_1',    uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1' },
        { id: 'opt-4',  label: '📙 Sekundarstufe II (Kl. 11–13)',value: 'sekundarstufe_2',    uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_2' },
        { id: 'opt-5',  label: '🎓 Hochschule',                  value: 'hochschule',         uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/hochschule' },
        { id: 'opt-6',  label: '🔧 Berufliche Bildung',          value: 'berufliche_bildung', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/berufliche_bildung' },
        { id: 'opt-7',  label: '📈 Fortbildung',                 value: 'fortbildung',        uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/fortbildung' },
        { id: 'opt-8',  label: '🌱 Erwachsenenbildung',          value: 'erwachsenenbildung', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/erwachsenenbildung' },
        { id: 'opt-9',  label: '🌟 Förderschule',               value: 'foerderschule',      uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/foerderschule' },
        { id: 'opt-10', label: '💻 Fernunterricht',              value: 'fernunterricht',     uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/fernunterricht' },
        { id: 'opt-11', label: '🔓 Informelles Lernen',          value: 'informelles_lernen', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/informelles_lernen' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 1344, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      personaMessages: {
        learner: 'Super! 🎉 Für welches **Thema** suchst du Lernmaterialien?',
        teacher: 'Für welches **Thema** suchen Sie Unterrichtsmaterialien?',
        counsellor: 'Zu welchem **Thema** suchen Sie Beratungs- oder Fördermaterial?',
        parent: 'Wobei möchtest du dein Kind unterstützen? Welches **Thema**?',
        author: 'Zu welchem **Thema** suchen Sie Quellen oder Inspiration?',
        manager: 'Zu welchem **Thema** suchen Sie Ressourcen für Ihre Einrichtung?',
        other: 'Für welches **Thema** soll ich suchen?',
      },
      message: 'Welches Thema interessiert dich?',
      placeholder: 'z.B. Mathematik Bruchrechnung, Klimawandel …',
      suggestions: [
        'Addition und Subtraktion', 'Klimawandel und Nachhaltigkeit', 'Demokratie und Gesellschaft',
        'Bruchrechnung', 'Deutsch Grammatik', 'Programmieren lernen',
        'Englisch Grundschule', 'Biologie Zelle', 'Geschichte Zweiter Weltkrieg', 'Physik Mechanik',
      ],
    }),

    // ── Chat-Knoten mit 2 inline gedockten MCP-Tools ────────────────────────
    makeNode(nChat, 'chatNode', 1724, 300, {
      stepType: 'chat', stepId: 'chat',
      personaMessages: {
        learner:    'Ich habe passende Themenseiten für dich gefunden! 😊 Stelle mir weitere Fragen – z.B. zu den Inhalten einer Sammlung.',
        teacher:    'Hier sind passende Sammlungen. Möchten Sie die Inhalte einer Sammlung sehen, oder haben Sie weitere Fragen?',
        counsellor: 'Hier sind passende Sammlungen zum Thema. Wie kann ich weiter helfen?',
        parent:     'Hier sind passende Themenseiten. Soll ich die Inhalte anzeigen oder ein anderes Thema erkunden?',
        author:     'Hier sind thematisch passende Sammlungen. Möchten Sie mehr dazu?',
        manager:    'Hier sind relevante Sammlungen für Ihre Einrichtung. Wie kann ich weiter helfen?',
        other:      'Hier sind die gefundenen Themenseiten. Wie kann ich weiter helfen?',
      },
      message: 'Hier sind passende Inhalte. Wie kann ich dir weiterhelfen?',
      suggestions: ['Zeig mir die Inhalte dieser Sammlung', 'Gibt es Untersammlungen dazu?', 'Anderes Thema suchen', 'Andere Bildungsstufe wählen', 'Was ist WirLernenOnline?', 'Gibt es Videos dazu?'],
      dockedTools: [
        {
          stepId: 'search_collections', stepType: 'tool_mcp',
          message: 'Suche passende Themenseiten …',
          mcpTools: ['lookup_wlo_vocabulary', 'search_wlo_collections'],
          toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}' },
        } satisfies DockedTool,
        {
          stepId: 'search_content', stepType: 'tool_mcp',
          message: 'Lade Inhalte aus der Sammlung …',
          mcpTools: ['lookup_wlo_vocabulary', 'get_collection_contents', 'search_wlo_content'],
          toolParams: { nodeId: '{{ mcpResult.nodeId }}', maxResults: '4', contentFilter: 'files' },
          personaToolParams: {
            teacher: { maxResults: '8', contentFilter: 'files' },
            counsellor: { maxResults: '6', contentFilter: 'files' },
            author: { maxResults: '10', contentFilter: 'files' },
          },
        } satisfies DockedTool,
      ],
    }),
  ];

  const edges: Edge[] = [
    makeEdge(nWelcome,       nRole),
    makeEdge(nRole,          nEdu),
    makeEdge(nEdu,           nInterest),
    makeEdge(nInterest,      nChat),
  ];

  return {
    id: 'boerdi-wlo',
    name: '🦉 WLO Boerdi (Produktionsflow)',
    description: 'Linearer Flow · 7 Rollen · 12 Bildungsstufen · 2 MCP-Tools gedockt am Chat-Knoten',
    nodes, edges,
    personas: DEFAULT_PERSONAS,
    botConfig: DEFAULT_BOT_CONFIG,
  };
}

// ── Template 2: Persona-Weiche → je eigener MCP-Aufruf pro Zielgruppe ────────
//
//  Zeigt: Gateway (splitBy=persona) → 3 Zweige + Default
//
//  Rollenauswahl → Thema → Gateway (Persona-Weiche)
//    Zweig Lernende   → tool_mcp (Lernmaterialien, educationLevel)
//    Zweig Lehrende   → tool_mcp (Unterrichtsmaterialien, didaktisch, mehr Treffer)
//    Zweig Berater/in → tool_mcp (Beratungsressourcen, Projekt-Kontext)
//    Default (alle anderen) → tool_mcp (allgemein)
//  → Gemeinsamer Chat → Ende

// ── Template 2: Persona-Weiche → je eigener Chat+Tool pro Zielgruppe ─────────
//  Gateway (persona) → 4 Chat-Knoten, jeder mit einem gedockten MCP-Tool
//  → jede Persona bekommt einen eigenen Suchaufruf mit angepassten Parametern

export function buildPersonaDemoTemplate(): FlowTemplate {
  idSeq = 200;
  const nWelcome = id(), nRole = id(), nInterest = id(), nGateway = id();
  const nChatLearner = id(), nChatTeacher = id(), nChatCounsellor = id(), nChatGeneral = id();

  //  Einstieg: x=80..1404 (linear, y=300)
  //  4 Chat-Zweige: x=1784, y=60/250/440/630
  //  End: x=2164, y=300

  const nodes: Node<NodeData>[] = [
    makeNode(nWelcome, 'messageNode', 80,  300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! Ich bin **Boerdi** 🦉.\n\nWähle deine Rolle – die Suche wird automatisch auf dich abgestimmt.',
    }),
    makeNode(nRole, 'choiceNode', 460, 300, {
      stepType: 'choice', stepId: 'role', field: 'role',
      message: 'Für wen suchst du Materialien?',
      options: [
        { id: 'opt-0', label: '🎒 Lernende/r',  value: 'learner',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    persona: 'learner',    primary: true },
        { id: 'opt-1', label: '📚 Lehrende/r',  value: 'teacher',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',    persona: 'teacher' },
        { id: 'opt-2', label: '🤝 Berater/in',  value: 'counsellor', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', persona: 'counsellor' },
        { id: 'opt-3', label: '🔍 Andere',      value: 'other',      uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',      persona: 'other' },
        { id: 'opt-4', label: '🔁 Von vorne starten', value: 'restart', next: '__restart' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 840, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      personaMessages: {
        learner: '🎉 Für welches Thema suchst du Lernmaterialien?',
        teacher: 'Für welches Thema suchen Sie Unterrichtsmaterialien?',
        counsellor: 'Zu welchem Thema suchen Sie Beratungsressourcen?',
        other: 'Für welches Thema soll ich suchen?',
      },
      message: 'Welches Thema interessiert dich?',
      placeholder: 'z.B. Klimawandel, Bruchrechnung …',
      suggestions: ['Klimawandel', 'Bruchrechnung', 'Demokratie', 'Programmieren', 'Physik Mechanik'],
    }),
    makeNode(nGateway, 'gatewayNode', 1220, 300, {
      stepType: 'gateway', stepId: 'persona_weiche',
      splitBy: 'persona',
      branches: [
        { id: 'branch-0', label: 'Lernende/r',  personaId: 'learner' },
        { id: 'branch-1', label: 'Lehrende/r',  personaId: 'teacher' },
        { id: 'branch-2', label: 'Berater/in',  personaId: 'counsellor' },
      ],
    }),

    // ── Zweig Lernende (y=60) ─────────────────────────────────────────────────────
    makeNode(nChatLearner, 'chatNode', 1600, 60, {
      stepType: 'chat', stepId: 'chat_learner',
      message: 'Hier sind Lernmaterialien für dich! 😊 Hast du weitere Fragen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Was ist WirLernenOnline?'],
      dockedTools: [{ stepId: 'mcp_learner', stepType: 'tool_mcp', message: 'Suche Lernmaterialien …', mcpTools: ['lookup_wlo_vocabulary', 'search_wlo_collections', 'get_collection_contents'], toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}', maxResults: '5', audience: 'learner' } } satisfies DockedTool],
    }),

    // ── Zweig Lehrende (y=250) ────────────────────────────────────────────────────
    makeNode(nChatTeacher, 'chatNode', 1600, 250, {
      stepType: 'chat', stepId: 'chat_teacher',
      message: 'Hier sind Unterrichtsmaterialien. Haben Sie weitere Fragen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Untersammlungen anzeigen'],
      dockedTools: [{ stepId: 'mcp_teacher', stepType: 'tool_mcp', message: 'Suche Unterrichtsmaterialien …', mcpTools: ['lookup_wlo_vocabulary', 'search_wlo_collections', 'get_collection_contents'], toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}', maxResults: '10', audience: 'teacher', contentFilter: 'didactic' } } satisfies DockedTool],
    }),

    // ── Zweig Berater/in (y=440) ────────────────────────────────────────────────────
    makeNode(nChatCounsellor, 'chatNode', 1600, 440, {
      stepType: 'chat', stepId: 'chat_counsellor',
      message: 'Hier sind Beratungsressourcen. Wie kann ich weiter helfen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Überblick geben'],
      dockedTools: [{ stepId: 'mcp_counsellor', stepType: 'tool_mcp', message: 'Suche Beratungsressourcen …', mcpTools: ['lookup_wlo_vocabulary', 'search_wlo_collections', 'get_collection_contents'], toolParams: { query: '{{ profile.interest }}', maxResults: '8', audience: 'counsellor', contentFilter: 'overview' } } satisfies DockedTool],
    }),

    // ── Default-Zweig (y=630) ─────────────────────────────────────────────────────
    makeNode(nChatGeneral, 'chatNode', 1600, 630, {
      stepType: 'chat', stepId: 'chat_general',
      message: 'Hier sind passende Inhalte. Wie kann ich helfen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Was ist WirLernenOnline?'],
      dockedTools: [{ stepId: 'mcp_general', stepType: 'tool_mcp', message: 'Suche passende Inhalte …', mcpTools: ['lookup_wlo_vocabulary', 'search_wlo_collections', 'get_collection_contents'], toolParams: { query: '{{ profile.interest }}', maxResults: '6' } } satisfies DockedTool],
    }),

  ];

  const edges: Edge[] = [
    makeEdge(nWelcome,  nRole),
    makeEdge(nRole,     nInterest),
    makeEdge(nInterest, nGateway),
    makeEdge(nGateway, nChatLearner,   { sourceHandle: 'branch-0', label: '🎒 Lernende/r' }),
    makeEdge(nGateway, nChatTeacher,   { sourceHandle: 'branch-1', label: '📚 Lehrende/r' }),
    makeEdge(nGateway, nChatCounsellor,{ sourceHandle: 'branch-2', label: '🤝 Berater/in' }),
    makeEdge(nGateway, nChatGeneral,   { sourceHandle: 'default',  label: 'Alle anderen' }),
  ];

  return {
    id: 'persona-weiche-demo',
    name: '◇ Persona-Weiche + gedockte Tools',
    description: 'Gateway (Persona) → 4 Chat-Knoten, jeder mit eigenem gedockten MCP-Tool',
    nodes, edges,
    personas: DEFAULT_PERSONAS,
    botConfig: DEFAULT_BOT_CONFIG,
  };
}

// ── Template 3: Bedingungsweiche → Chat+Tool je Bildungsstufe ────────────────
//  Persona-Badge gedockt über dem Willkommens-Knoten
//  Gateway (condition) → 4 Chat-Knoten, jeder mit eigenem gedockten MCP-Tool

export function buildSimpleStudentTemplate(): FlowTemplate {
  idSeq = 300;
  const nWelcome = id();
  const nEdu = id(), nInterest = id(), nGateway = id();
  const nChatGs = id(), nChatSek1 = id(), nChatSek2 = id(), nChatGeneral = id();

  const nodes: Node<NodeData>[] = [
    // ── Willkommen mit gedocktem Persona-Badge ────────────────────────────────
    makeNode(nWelcome, 'messageNode', 80, 300, {
      stepType: 'message', stepId: 'welcome',
      message: '📚 Hallo! Ich bin dein **Lernassistent**.\n\nIch helfe dir, passendes Lernmaterial auf WirLernenOnline zu finden – abgestimmt auf deine Schulstufe.',
      dockedPersona: { personaMode: 'set', personaId: 'learner' } satisfies DockedPersona,
    }),
    makeNode(nEdu, 'choiceNode', 460, 300, {
      stepType: 'choice', stepId: 'educationLevel', field: 'educationLevels',
      message: 'Welche Schulstufe besuchst du?',
      options: [
        { id: 'opt-0', label: '📗 Grundschule (Kl. 1–4)',      value: 'grundschule',     uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/grundschule' },
        { id: 'opt-1', label: '📘 Sekundarstufe I (Kl. 5–10)', value: 'sekundarstufe_1', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1' },
        { id: 'opt-2', label: '📙 Sekundarstufe II (Kl. 11–13)',value: 'sekundarstufe_2', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_2' },
        { id: 'opt-3', label: '🎓 Hochschule / Sonstiges',     value: 'hochschule',      uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/hochschule' },
        { id: 'opt-4', label: '🔁 Von vorne starten',          value: 'restart',         next: '__restart' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 840, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      message: 'Für welches **Thema** suchst du Lernmaterialien?',
      placeholder: 'z.B. Bruchrechnung, Klimawandel …',
      suggestions: ['Bruchrechnung', 'Klimawandel', 'Demokratie', 'Englisch Vokabeln', 'Physik Mechanik'],
    }),
    makeNode(nGateway, 'gatewayNode', 1220, 300, {
      stepType: 'gateway', stepId: 'stufen_weiche',
      splitBy: 'condition',
      branches: [
        { id: 'branch-0', label: 'Grundschule',     field: 'educationLevels', operator: 'equals', value: 'grundschule' },
        { id: 'branch-1', label: 'Sekundarstufe I', field: 'educationLevels', operator: 'equals', value: 'sekundarstufe_1' },
        { id: 'branch-2', label: 'Sekundarstufe II',field: 'educationLevels', operator: 'equals', value: 'sekundarstufe_2' },
      ],
    }),

    // ── Chat + gedocktes Tool je Zweig ────────────────────────────────────────
    makeNode(nChatGs,      'chatNode', 1600, 60,  { stepType: 'chat', stepId: 'chat_gs',      message: 'Hier sind Materialien für die Grundschule! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_grundschule', stepType: 'tool_mcp', message: 'Suche Grundschulmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'grundschule', maxResults: '5' } } satisfies DockedTool] }),
    makeNode(nChatSek1,    'chatNode', 1600, 250, { stepType: 'chat', stepId: 'chat_sek1',    message: 'Hier sind Materialien für die Sekundarstufe I! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_sek1', stepType: 'tool_mcp', message: 'Suche Materialien für Sek I …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'sekundarstufe_1', maxResults: '7' } } satisfies DockedTool] }),
    makeNode(nChatSek2,    'chatNode', 1600, 440, { stepType: 'chat', stepId: 'chat_sek2',    message: 'Hier sind Materialien für die Sekundarstufe II! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_sek2', stepType: 'tool_mcp', message: 'Suche Materialien für Sek II …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'sekundarstufe_2', maxResults: '7' } } satisfies DockedTool] }),
    makeNode(nChatGeneral, 'chatNode', 1600, 630, { stepType: 'chat', stepId: 'chat_general', message: 'Hier sind passende Lernmaterialien! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_general', stepType: 'tool_mcp', message: 'Suche allgemeine Lernmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', maxResults: '10' } } satisfies DockedTool] }),

  ];

  const edges: Edge[] = [
    makeEdge(nWelcome,  nEdu),
    makeEdge(nEdu,      nInterest),
    makeEdge(nInterest, nGateway),
    makeEdge(nGateway, nChatGs,      { sourceHandle: 'branch-0', label: 'Grundschule' }),
    makeEdge(nGateway, nChatSek1,    { sourceHandle: 'branch-1', label: 'Sek I' }),
    makeEdge(nGateway, nChatSek2,    { sourceHandle: 'branch-2', label: 'Sek II' }),
    makeEdge(nGateway, nChatGeneral, { sourceHandle: 'default',  label: 'Hochschule / Sonstiges' }),
  ];

  return {
    id: 'stufen-assistent',
    name: '📚 Lernassistent mit Stufenweiche',
    description: 'Persona-Badge gedockt · Bedingungsweiche → Chat-Knoten mit je eigenem gedockten MCP-Tool',
    nodes, edges,
    personas: DEFAULT_PERSONAS.filter(p => p.id === 'learner' || p.id === 'other'),
    botConfig: { ...DEFAULT_BOT_CONFIG, name: 'Lernbot', avatar: '📚', tagline: 'Dein persönlicher Lernassistent', defaultPersona: 'learner' },
  };
}

// ── Template 4: Bestellstatus-Bot ─────────────────────────────────────────────
//
//  Start → Begrüßung → Eingabe (Bestellnr) → API-Aufruf (GET /orders/{{id}})
//       → Erfolg: Variable setzen → Status-Nachricht → Ende
//       → Fehler: Fehler-Nachricht → Übergabe (Support-Queue)
//
//  Zeigt: api_call mit Erfolg/Fehler-Zweigen · set_var · handoff

export function buildOrderStatusTemplate(): FlowTemplate {
  idSeq = 400;
  const nGreet = id(), nInput = id();
  const nApi = id(), nSetVar = id(), nStatusMsg = id();
  const nErrMsg = id(), nHandoff = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nGreet,     'messageNode', 80,   300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! 📦 Ich helfe dir, deinen Bestellstatus abzufragen.\n\nBitte halte deine **Bestellnummer** bereit.',
    }),
    makeNode(nInput,     'inputNode',   460,  300, {
      stepType: 'input', stepId: 'orderInput', field: 'orderId',
      message: 'Wie lautet deine Bestellnummer?',
      placeholder: 'z.B. ORD-2024-001234',
    }),
    makeNode(nApi,       'apiCallNode', 840,  300, {
      stepType: 'api_call', stepId: 'fetchOrder',
      apiMethod: 'GET',
      apiUrl: 'https://api.example.com/orders/{{ profile.orderId }}',
      apiResultVar: 'orderData',
      notes: 'URL im Panel auf eigenen Endpunkt anpassen.',
    }),
    makeNode(nSetVar,    'setVarNode',  1220, 120, {
      stepType: 'set_var', stepId: 'extractStatus',
      variables: [
        { key: 'orderStatus', value: '{{ orderData.status }}' },
        { key: 'orderItem',   value: '{{ orderData.itemName }}' },
        { key: 'orderEta',    value: '{{ orderData.estimatedDelivery }}' },
      ],
    }),
    makeNode(nStatusMsg, 'choiceNode', 1600, 120, {
      stepType: 'choice', stepId: 'statusReply',
      message: '✅ Deine Bestellung **{{ orderItem }}** hat den Status: **{{ orderStatus }}**.\n\n📅 Voraussichtliche Lieferung: {{ orderEta }}',
      options: [
        { id: 'opt-0', label: 'Alles klar, danke!', value: 'ok', primary: true },
        { id: 'opt-1', label: '🔁 Von vorne starten', value: 'restart', next: '__restart' },
      ],
    }),
    makeNode(nErrMsg,    'messageNode', 1220, 480, {
      stepType: 'message', stepId: 'errorReply',
      message: '❌ Die Bestellung **{{ profile.orderId }}** wurde nicht gefunden.\n\nBitte überprüfe die Nummer oder wende dich an unseren Support.',
    }),
    makeNode(nHandoff,   'messageNode', 1600, 480, {
      stepType: 'message', stepId: 'supportHandoff',
      message: '**Wir helfen dir gerne weiter!** 📞\n\nBitte kontaktiere unseren Support:\n- ✉️ support@example.com\n- 📞 0800 123 456 (Mo–Fr 9–18 Uhr)\n\nBitte halte deine Bestellnummer **{{ profile.orderId }}** bereit.',
    }),
  ];

  const edges: Edge[] = [
    makeEdge(nGreet,     nInput),
    makeEdge(nInput,     nApi),
    makeEdge(nApi,       nSetVar,    { sourceHandle: 'success', label: '✓ Erfolg' }),
    makeEdge(nApi,       nErrMsg,    { sourceHandle: 'error',   label: '✗ Fehler' }),
    makeEdge(nSetVar,    nStatusMsg),
    makeEdge(nErrMsg,    nHandoff),
  ];

  return {
    id: 'order-status-bot',
    name: '📦 Bestellstatus-Bot',
    description: 'API-Aufruf · Variable setzen · Erfolg/Fehler-Zweige · Übergabe an Support',
    nodes, edges,
    personas: [],
    botConfig: {
      name: 'ShopBot', avatar: '📦',
      tagline: 'Dein persönlicher Shop-Assistent',
      apiModel: 'gpt-4.1-mini', mcpServerUrl: '', defaultPersona: '',
    },
  };
}

// ── Template 5: Support-Eskalation ────────────────────────────────────────────
//
//  Start → Begrüßung → Variable setzen (Kanal/Priorität)
//       → Themenauswahl (choice)
//       → Technik: FAQ-Nachricht → Eingabe → Weiche (Intent: gelöst / eskaliert)
//                  gelöst  → Ende
//                  eskaliert / Standard → Übergabe Technik-L2
//       → Rechnung: Übergabe Rechnungs-Team
//       → Sonstiges: Übergabe Allgemein
//
//  Zeigt: set_var · choice · message (FAQ) · input · gateway (intent) · handoff

export function buildSupportEscalationTemplate(): FlowTemplate {
  idSeq = 500;
  const nGreet = id(), nChoice = id();
  const nTechFaq = id(), nTechInput = id(), nGateway = id();
  const nTechResolved = id(), nTechHandoff = id();
  const nRechHandoff = id(), nSonstHandoff = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nGreet,        'messageNode', 80,   440, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! 👋 Willkommen beim **Support-Center**.\n\nWie kann ich dir heute helfen?',
    }),
    makeNode(nChoice,       'choiceNode',  460,  440, {
      stepType: 'choice', stepId: 'topicSelect',
      message: 'Was ist dein Anliegen?',
      options: [
        { id: 'opt-0', label: '💻 Technisches Problem', value: 'tech',    primary: true },
        { id: 'opt-1', label: '💳 Frage zur Rechnung',  value: 'billing' },
        { id: 'opt-2', label: '📋 Sonstiges Anliegen',  value: 'other' },
        { id: 'opt-3', label: '🔁 Nochmal von vorne',   value: 'restart', next: '__restart' },
      ],
    }),
    // ── Technik-Pfad ────────────────────────────────────────────────────────
    makeNode(nTechFaq,      'messageNode', 840,  160, {
      stepType: 'message', stepId: 'techFaq',
      message: '💡 **Häufige Lösungen:**\n- Gerät neu starten\n- Cache leeren\n- App neu installieren\n\nHat eine davon geholfen?',
    }),
    makeNode(nTechInput,    'inputNode',   1220, 160, {
      stepType: 'input', stepId: 'techFeedback', field: 'techFeedback',
      message: 'Beschreibe kurz, ob das Problem gelöst wurde oder was noch nicht klappt.',
      placeholder: '„Neustart hat geholfen“ oder „Fehler XY bleibt“',
    }),
    makeNode(nGateway,      'gatewayNode', 1600, 160, {
      stepType: 'gateway', stepId: 'resolvedCheck', splitBy: 'ai_intent',
      branches: [
        { id: 'branch-0', label: 'Gelöst',       intentDescription: 'Nutzer bestätigt, dass das Problem behoben ist. Z.B. „Ja“, „hat geklappt“, „Danke“, „funktioniert jetzt“.' },
        { id: 'branch-1', label: 'Nicht gelöst', intentDescription: 'Problem besteht weiterhin. Z.B. „nein“, „immer noch“, „geht nicht“, „Fehler bleibt“.' },
      ],
    }),
    makeNode(nTechResolved, 'messageNode', 1980, 60, {
      stepType: 'message', stepId: 'techResolved',
      message: '🎉 **Super, das freut mich!**\n\nWenn du weitere Fragen hast, bin ich gerne wieder da.',
    }),
    makeNode(nTechHandoff,  'messageNode', 1980, 260, {
      stepType: 'message', stepId: 'techHandoff',
      message: '**Technischer Support** 🛠️\n\nUnser Technik-Team hilft dir weiter:\n- ✉️ tech@example.com\n- 💬 Live-Chat auf example.com/support (Mo–Fr 9–18 Uhr)',
    }),
    // ── Rechnungs-Pfad ──────────────────────────────────────────────────────
    makeNode(nRechHandoff,  'messageNode', 840,  440, {
      stepType: 'message', stepId: 'billingHandoff',
      message: '**Fragen zur Rechnung** 💳\n\nUnser Rechnungs-Team hilft gerne weiter:\n- ✉️ billing@example.com\n- 📞 0800 123 456 (Mo–Fr 9–17 Uhr)',
    }),
    // ── Sonstiges-Pfad ──────────────────────────────────────────────────────
    makeNode(nSonstHandoff, 'messageNode', 840,  720, {
      stepType: 'message', stepId: 'generalHandoff',
      message: '**Weiteres Anliegen** 📋\n\nFür alle anderen Fragen:\n- ✉️ info@example.com\n- 📞 0800 123 456\n- 🌐 example.com/kontakt',
    }),
  ];

  const edges: Edge[] = [
    makeEdge(nGreet,        nChoice),
    makeEdge(nChoice,       nTechFaq,    { sourceHandle: 'opt-0', label: '💻 Technik' }),
    makeEdge(nChoice,       nRechHandoff,{ sourceHandle: 'opt-1', label: '💳 Rechnung' }),
    makeEdge(nChoice,       nSonstHandoff,{ sourceHandle: 'opt-2', label: '📋 Sonstiges' }),
    makeEdge(nTechFaq,      nTechInput),
    makeEdge(nTechInput,    nGateway),
    makeEdge(nGateway,      nTechResolved, { sourceHandle: 'branch-0', label: '✅ Gelöst' }),
    makeEdge(nGateway,      nTechHandoff,  { sourceHandle: 'branch-1', label: '🛠️ Weiterleitung' }),
    makeEdge(nGateway,      nTechHandoff,  { sourceHandle: 'default',  label: 'Standard' }),
  ];

  return {
    id: 'support-escalation',
    name: '🎧 Support-Eskalation',
    description: 'FAQ mit KI-Intent-Weiche · Kontaktinfo je Thema · Neustart-Option',
    nodes, edges,
    personas: [],
    botConfig: {
      name: 'SupportBot', avatar: '🎧',
      tagline: 'Dein persönlicher Support-Assistent',
      apiModel: 'gpt-4.1-mini', mcpServerUrl: '', defaultPersona: '',
    },
  };
}

// ── Template 6: W-00 WLO Website Bot ─────────────────────────────────────────
// Anonymer Bot, 5 Zielgruppen, KI-Intent-Weiche, Soft-Probing
export function buildWloWebsiteBotTemplate(): FlowTemplate {
  idSeq = 600;
  const nGreet = id(), nOpenQ = id(), nGateway = id();
  const nChatLk = id(), nChatSl = id(), nChatPol = id(), nChatPress = id();
  const nHandoffRed = id(), nChatDef = id();

  const W00_PERSONAS = [
    { id: 'wlo_lk',    label: 'Lehrkraft',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',    systemPrompt: '# WLO Bot – Lehrkraft\n\nFühre das Gespräch wie ein kollegiales Beratungsgespräch. Sieze die Person.\n\n## Soft Probing\nFrage nach Fach und Klasse (max. 1 Frage pro Turn). Starte Suche sobald du genug weißt. Sage laut: "Ich suche jetzt nach [Thema] für Klasse [X]..."\n\n## Gesprächsphasen\n1. Soft Probing – Fach + Klasse klären\n2. Hauptaktion – search_wlo_collections / search_wlo_content\n3. Ergebnissicherung – "Hast du gefunden, was du gesucht hast?"\n4. Abschluss – kurz und freundlich\n\n## Kein-Treffer-Feedback (INT-W-04)\nWenn keine Ergebnisse: "Schade, dazu gibt es auf WLO noch nicht so viel. Magst du mir kurz beschreiben, was genau du gesucht hast? Das hilft uns, die Plattform zu verbessern."\n\nKein Login, keine Inhalte erfinden.' },
    { id: 'wlo_sl',    label: 'Schüler:in',   uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    systemPrompt: '# WLO Bot – Schüler:in\n\nEinfache Sprache, ermutigend, duze die Person. Max. 1 Frage pro Turn.\n\n## Gesprächsphasen\n1. Soft Probing – Thema klären\n2. Hauptaktion – search_wlo_content / search_wlo_collections\n3. Ergebnissicherung – "Hast du was Passendes gefunden?"\n4. Abschluss – ermutigend\n\n## Kein-Treffer-Feedback (INT-W-04)\nWenn keine Ergebnisse: "Schade, dazu gibt es noch nicht so viel. Was hast du gesucht? Das hilft uns, WLO besser zu machen."\n\nKein Login, keine Hausaufgaben lösen.' },
    { id: 'wlo_pol',   label: 'Politikerin',  uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',     systemPrompt: '# WLO Bot – Politikerin\n\nSeriös, kompetent, auf Augenhöhe. Sieze die Person.\n\n## Gesprächsphasen\n1. Anliegen ermitteln (Überblick, Zahlen, Kooperationen?)\n2. Informieren – get_wirlernenonline_info, strukturiert und faktisch\n3. Ergebnissicherung – "Haben Sie die gesuchten Informationen gefunden?"\n4. Abschluss – professionell, ggf. Pressekontakt nennen\n\nKEINE Materialsuche. Keine politischen Positionen.' },
    { id: 'wlo_press', label: 'Presse',       uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',     systemPrompt: '# WLO Bot – Presse\n\nSachlich, zitierfähig, präzise. Sieze die Person.\n\n## Gesprächsphasen\n1. Anliegen ermitteln (Artikel, Fakten, Zahlen?)\n2. Informieren – get_wirlernenonline_info, nur belegbare Fakten\n3. Ergebnissicherung – "Haben Sie die benötigten Informationen erhalten?"\n4. Abschluss – professionell, Pressekontakt: info@edu-sharing.net\n\nKEINE Materialsuche. Keine Zahlen erfinden.' },
    { id: 'wlo_red',   label: 'Redakteur:in', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/author',    systemPrompt: '# WLO Bot – Redakteur:in\n\nEinladend, motivierend. Leite zum Redaktionsprozess weiter (get_wirlernenonline_info). Keine Versprechen über Aufnahme oder Qualitätsentscheidungen.' },
  ];

  const lkTools: DockedTool[] = [
    { stepId: 'w00_lk_col', stepType: 'tool_mcp', message: 'Suche Themenseiten …',        mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest ?? profile.intent_text }}', maxResults: '4' } },
    { stepId: 'w00_lk_cnt', stepType: 'tool_mcp', message: 'Suche Unterrichtsmaterial …', mcpTools: ['search_wlo_content'],     toolParams: { query: '{{ profile.interest ?? profile.intent_text }}', maxResults: '5' } },
  ];
  const slTools: DockedTool[] = [
    { stepId: 'w00_sl_cnt', stepType: 'tool_mcp', message: 'Suche Lernmaterialien …',  mcpTools: ['search_wlo_content'],     toolParams: { query: '{{ profile.interest ?? profile.intent_text }}', maxResults: '5' } },
    { stepId: 'w00_sl_col', stepType: 'tool_mcp', message: 'Suche Themenseiten …',     mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest ?? profile.intent_text }}', maxResults: '3' } },
  ];
  const infoTool: DockedTool[] = [
    { stepId: 'w00_info', stepType: 'tool_mcp', message: 'Lade WLO-Informationen …', mcpTools: ['get_wirlernenonline_info'], toolParams: { path: '' } },
  ];
  const defTools: DockedTool[] = [
    { stepId: 'w00_def', stepType: 'tool_mcp', message: 'Suche auf WLO …', mcpTools: ['search_wlo_collections', 'search_wlo_content'], toolParams: { query: '{{ profile.intent_text ?? profile.interest }}', maxResults: '5' } },
  ];

  const nodes = [
    makeNode(nGreet,      'messageNode', 80,   560, { stepType: 'message', stepId: 'w00_welcome', message: 'Hallo! 👋 Ich bin dein Assistent auf **WirLernenOnline.de**.\n\nHier findest du tausende freie Bildungsmaterialien (OER) – ich helfe dir, genau das Richtige zu finden.' }),
    makeNode(nOpenQ,      'inputNode',   620,  560, { stepType: 'input',   stepId: 'w00_open_q',   field: 'intent_text', message: 'Was bringt dich heute her? Bist du z.B. Lehrkraft, Schüler:in – oder hast du einen anderen Hintergrund?', placeholder: 'z.B. „Ich unterrichte Mathe Klasse 7" oder „Ich suche was über Klimawandel"', suggestions: ['Ich bin Lehrkraft', 'Ich lerne gerade', 'Ich möchte mehr über WLO erfahren', 'Ich schreibe über WLO'] }),
    makeNode(nGateway,    'gatewayNode', 1020, 560, { stepType: 'gateway', stepId: 'w00_weiche', splitBy: 'ai_intent', branches: [
      { id: 'branch-0', label: 'Lehrkraft',    personaId: 'wlo_lk',    intentDescription: 'Lehrkraft, Lehrerin, Lehrer, unterrichtet, Unterrichtsmaterial, Klasse, Fach, Schule, Unterricht.' },
      { id: 'branch-1', label: 'Schüler:in',   personaId: 'wlo_sl',    intentDescription: 'Schüler:in, Student:in, lernt selbst, Lernmaterial, Hausaufgaben, Prüfung.' },
      { id: 'branch-2', label: 'Politikerin',  personaId: 'wlo_pol',   intentDescription: 'Bildungspolitik, Ministerium, Verwaltung, Behörde, Bürgermeisterin, was ist WLO, Plattform erklären, Überblick.' },
      { id: 'branch-3', label: 'Presse',       personaId: 'wlo_press', intentDescription: 'Journalist:in, Artikel, Bericht, Fakten, Zahlen, Pressekontakt, recherchiert über WLO.' },
      { id: 'branch-4', label: 'Redakteur:in', personaId: 'wlo_red',   intentDescription: 'Redakteur:in, Fachgesellschaft, Organisation, Inhalte einstellen, Zugang beantragen, Mitmachen.' },
    ] }),
    makeNode(nChatLk,     'chatNode',    1420, 80,   { stepType: 'chat',    stepId: 'w00_lk',    message: 'Super, schön dass du hier bist! 👩‍🏫\n\nFür welches Fach oder Thema suchst du Materialien – und für welche Klasse ungefähr?', suggestions: ['Themenseiten zeigen', 'Konkrete Materialien suchen', 'Anderes Thema'], dockedTools: lkTools,   dockedPersona: { personaMode: 'set', personaId: 'wlo_lk' } as DockedPersona }),
    makeNode(nChatSl,     'chatNode',    1420, 290,  { stepType: 'chat',    stepId: 'w00_sl',    message: 'Cool, da helfe ich dir! 🎒\n\nWelches Thema oder Fach interessiert dich?', suggestions: ['Lernmaterialien zeigen', 'Videos suchen', 'Anderes Thema'], dockedTools: slTools,   dockedPersona: { personaMode: 'set', personaId: 'wlo_sl' } as DockedPersona }),
    makeNode(nChatPol,    'chatNode',    1420, 500,  { stepType: 'chat',    stepId: 'w00_pol',   message: 'Willkommen! 🏛️\n\n**WirLernenOnline.de (WLO)** ist Deutschlands zentrale OER-Plattform – kostenlos, qualitätsgesichert, für alle Bildungsbereiche.\n\nWie kann ich Ihnen weiterhelfen?', suggestions: ['Was leistet WLO?', 'Wer steht hinter WLO?', 'Wie viele Materialien?'], dockedTools: infoTool, dockedPersona: { personaMode: 'set', personaId: 'wlo_pol' } as DockedPersona }),
    makeNode(nChatPress,  'chatNode',    1420, 710,  { stepType: 'chat',    stepId: 'w00_press', message: 'Guten Tag! 📰\n\n**WirLernenOnline.de** ist die zentrale OER-Plattform im deutschen Bildungswesen. Ich helfe Ihnen mit Fakten und Hintergrundinformationen.', suggestions: ['Fakten zur Plattform', 'Nutzungszahlen', 'Pressekontakt'], dockedTools: infoTool, dockedPersona: { personaMode: 'set', personaId: 'wlo_press' } as DockedPersona }),
    makeNode(nHandoffRed, 'messageNode', 1420, 920,  { stepType: 'message', stepId: 'w00_red',   message: 'Super, dass du Inhalte auf WLO einbringen möchtest! 🎉\n\n**So geht es weiter:**\n- 📧 Schreib an: redaktion@wirlernenonline.de\n- 🌐 Mehr Infos: wirlernenonline.de/mitmachen\n\nWir freuen uns auf deine Inhalte!' }),
    makeNode(nChatDef,    'chatNode',    1420, 1130, { stepType: 'chat',    stepId: 'w00_def',   message: 'Willkommen auf **WirLernenOnline.de**! 👋 Ich helfe dir weiter – stell mir gerne Fragen zu Materialien oder zur Plattform.', suggestions: ['Bildungsmaterialien suchen', 'Was ist WirLernenOnline?', 'Wie kann ich mitmachen?'], dockedTools: defTools }),
  ];

  const edges = [
    makeEdge(nGreet, nOpenQ), makeEdge(nOpenQ, nGateway),
    makeEdge(nGateway, nChatLk,    { sourceHandle: 'branch-0', label: '👩‍🏫 Lehrkraft' }),
    makeEdge(nGateway, nChatSl,    { sourceHandle: 'branch-1', label: '🎒 Schüler:in' }),
    makeEdge(nGateway, nChatPol,   { sourceHandle: 'branch-2', label: '🏛️ Politikerin' }),
    makeEdge(nGateway, nChatPress, { sourceHandle: 'branch-3', label: '📰 Presse' }),
    makeEdge(nGateway, nHandoffRed,{ sourceHandle: 'branch-4', label: '✏️ Redakteur:in' }),
    makeEdge(nGateway, nChatDef,   { sourceHandle: 'default',  label: 'Alle anderen' }),
  ];

  return {
    id: 'wlo-website-bot',
    name: '🌐 WLO Website Bot (W-00)',
    description: 'Anonymer Bot · 5 Zielgruppen · KI-Intent-Weiche · Soft-Probing · Probabilistischer Flow',
    nodes, edges,
    personas: W00_PERSONAS,
    botConfig: { name: 'WLO-Assistent', avatar: '🌐', tagline: 'Dein Assistent auf WirLernenOnline.de', apiModel: 'gpt-4.1-mini', mcpServerUrl: 'https://wlo-mcp-server.vercel.app/mcp', defaultPersona: '' },
  };
}

// ── Template 7: WLO Agent (1-Knoten) ────────────────────────────────────────────
// Gesamte Gesprächsführung durch System-Prompt · alle MCP-Tools aktiv
// 2 Knoten: feste Begrüßung + freier Chat-Knoten

export function buildWloAgentTemplate(): FlowTemplate {
  idSeq = 700;
  const nGreet = id(), nChat = id();

  const SYSTEM_PROMPT = `Du bist ein freundlicher Beratungs-Assistent auf der WirLernenOnline-Webseite (WLO). WLO ist eine offene Bildungsplattform des BMBF, die freie Bildungsmaterialien (OER) für alle Fächer und Klassenstufen bündelt.

═══════════════════════════════════════
DEINE ROLLE
═══════════════════════════════════════

Du führst ein Beratungsgespräch. Finde zuerst heraus, wer der Nutzer ist und was er braucht, bevor du aktiv wirst.
Du arbeitest probabilistisch: Du definierst Preconditions (was muss bekannt sein?) und erfragst fehlende Infos soft im natürlichen Gesprächsverlauf — nie als Formular.
Du bist kein FAQ-Bot — du bist ein aufmerksamer Gesprächspartner.

═══════════════════════════════════════
WAS DU TUST
═══════════════════════════════════════

- Begrüßen und Zielgruppe erkennen (INT-W-00)
- Über WLO informieren für Politiker und Presse (INT-W-01, INT-W-06)
- Interessen und Themen erfragen bei Lehrkräften und Schülern (INT-W-02)
- Themenseiten vorschlagen (INT-W-03a)
- Unterrichtsmaterial oder Lerninhalte suchen (INT-W-03b, INT-W-03c)
- Feedback erfassen wenn nichts passt (INT-W-04)
- An den Redakteurs-Flow weiterleiten wenn Persona = Redakteur:in (INT-W-05)

═══════════════════════════════════════
WAS DU NICHT TUST
═══════════════════════════════════════

- Keine Inhalte erfinden die nicht in WLO stehen
- Kein Schreiben, Anlegen oder Löschen (anonyme Nutzer)
- Keinen Login-Prozess auslösen
- Keine Inhalte von außerhalb WLO empfehlen
- Keine langen Monologe — kurze, hilfreiche Antworten
- Politikern und Presse KEINE Materialsuche anbieten

═══════════════════════════════════════
5 ZIELGRUPPEN (PERSONAS)
═══════════════════════════════════════

P-W-POL — POLITIKERIN / BILDUNGSPOLITISCH INTERESSIERTE
  Kontext: Will verstehen was WLO ist und leistet.
  Erkennungsmerkmale: "Was macht ihr?", "Was ist WLO?", "Bürgermeisterin", "Ministerium", "Bildungspolitik"
  Bot-Verhalten: Informieren, KEINE Suche. Kurze Beschreibung + Mehrwert für Bildungspolitik.
  Tonalität: Seriös, auf Augenhöhe, kein Edtech-Jargon. Sie-Form verwenden.

P-W-LK — LEHRKRAFT
  Kontext: Sucht Material für den Unterricht.
  Erkennungsmerkmale: "Ich bin Lehrerin", "für meinen Unterricht", Fach/Klasse werden genannt
  Bot-Verhalten: Interessen abfragen → Themenseite vorschlagen → Suche moderieren
  Tonalität: Freundlich, kollegial, praktisch, lösungsorientiert. Du-Form.

P-W-SL — SCHÜLER:IN
  Kontext: Sucht Material zum Lernen.
  Erkennungsmerkmale: "Ich bin Schüler", "Ich suche was über...", Alter/Klasse
  Bot-Verhalten: Gleicher Flow wie Lehrkraft, aber einfachere Formulierungen.
  Tonalität: Einfache Sprache, ermutigend, niedrigschwellig. Du-Form.

P-W-RED — REDAKTEUR:IN
  Kontext: Evaluiert ob WLO für ihre Organisation passt, hat noch keinen Account.
  Erkennungsmerkmale: "Wir sind eine Fachgesellschaft", "können wir Inhalte einstellen?", "wie bekomme ich Zugang?"
  Bot-Verhalten: Erkenne die Persona → leite zum Redaktions-Onboarding weiter.
  Sage: "Super, dass du dich für eine Mitarbeit bei WLO interessierst! Für Redakteur:innen haben wir einen eigenen Bereich — lass mich dich dorthin weiterleiten."
  Tonalität: Einladend, motivierend, kein Jargon.

P-W-PRESSE — PRESSE / JOURNALIST:IN
  Kontext: Recherchiert über WLO für einen Artikel oder Bericht.
  Erkennungsmerkmale: "Ich schreibe einen Artikel", "Was ist WLO genau?", "Wie viele Nutzer?", "Ansprechpartner?"
  Bot-Verhalten: Informieren, KEINE Suche. Fakten und Zahlen, ggf. Ansprechpartner nennen.
  Tonalität: Sachlich, präzise, auf Augenhöhe. Sie-Form verwenden.

═══════════════════════════════════════
PERSONA-ERKENNUNG
═══════════════════════════════════════

Startzustand: Zielgruppe unklar (ST-W-OFFEN).
Erkenne die Persona aus dem Kontext der Nachrichten. Wenn unklar, frage beiläufig:
"Was bringt dich her — bist du Lehrkraft, Schüler:in, oder informierst du dich aus einem anderen Grund über die Plattform?"

Leite die Persona NICHT aus Vermutungen ab. Wenn jemand "Was ist WLO?" fragt, könnte es eine Politikerin ODER eine Journalistin sein — frage nach wenn nötig.

Sobald die Persona erkannt ist, wechsle in den passenden Modus und frage NICHT nochmal.

═══════════════════════════════════════
GESPRÄCHSPHASEN
═══════════════════════════════════════

Phase 1 — ERÖFFNUNG (INT-W-00)
Begrüße den Nutzer warm und kurz:
"Hallo! Ich bin dein Assistent hier auf WirLernenOnline. Was bringt dich her?"
Erkenne die Persona aus der Antwort oder frage beiläufig nach.

Phase 2 — SOFT PROBING (INT-W-02)
Kläre Persona und Grundbedarf. REGELN:
- Maximal 1 offene Frage pro Antwort
- Nie: "Welches Fach? Und welche Klasse? Und welches Thema?" auf einmal
- Wenn der Nutzer direkt loslegt ("Zeig mir was zu Photosynthese"), sofort handeln
- Klärung als Angebot: "Übrigens, wenn du mir noch sagst für welche Klasse, kann ich das besser eingrenzen."
- Wenn der Nutzer Klärung ablehnt → akzeptieren und mit dem arbeiten was du hast

Phase 3 — HAUPTAKTION
Je nach Persona und Intent:

→ POLITIKERIN (INT-W-01):
  Erkläre kurz was WLO ist und leistet. Nutze get_wirlernenonline_info für aktuelle Infos.
  Betone den Mehrwert für Bildungspolitik: kostenlos, offen, qualitätsgesichert, BMBF-gefördert.
  Verlinke auf relevante Seiten. KEINE Materialsuche anbieten.

→ PRESSE (INT-W-06):
  Liefere Fakten und Zahlen zur Plattform. Nutze get_wirlernenonline_info.
  Nenne Ansprechpartner wenn vorhanden. Biete zitierfähige Infos.
  KEINE Materialsuche anbieten.

→ LEHRKRAFT (INT-W-03a, INT-W-03b):
  Preconditions für Suche: Fach + Klassenstufe
  1. Frage nach Fach/Thema
  2. Suche ZUERST nach Themenseiten (search_wlo_collections)
  3. Dann nach Einzelinhalten (search_wlo_content) wenn Themenseite nicht reicht
  4. Zeige max. 3-5 Treffer mit Titel und Link
  Degradation: Wenn Fach oder Klassenstufe fehlt → trotzdem suchen mit dem was bekannt ist

→ SCHÜLER:IN (INT-W-03c):
  Precondition für Suche: Thema
  Gleicher Such-Flow wie Lehrkraft, aber:
  - Einfachere Formulierungen
  - Ermutigender Ton ("Super Thema! Lass mich schauen was ich finde...")
  - Keine Fach-Systematik voraussetzen

→ REDAKTEUR:IN (INT-W-05):
  Erkenne die Persona → Leite zum Redaktions-Onboarding weiter.
  Sage: "Toll, dass du dich für eine Mitarbeit bei WLO interessierst! Für Redakteur:innen haben wir einen eigenen Bereich mit allen Infos zum Einstieg."
  Biete KEINE Materialsuche an.

Phase 4 — ERGEBNISSICHERUNG (INT-W-04)
Nach der Hauptaktion kurz nachfragen:
"Hat dir das weitergeholfen? Soll ich noch in eine andere Richtung suchen?"

Phase 5 — KEIN TREFFER → FEEDBACK (INT-W-04)
Wenn nichts passt:
"Schade, dazu gibt es noch nicht viel bei uns. Magst du mir kurz beschreiben was du gesucht hast? Das hilft uns, die Plattform zu verbessern."

═══════════════════════════════════════
PRECONDITIONS (was muss bekannt sein?)
═══════════════════════════════════════

Themenseite vorschlagen (INT-W-03a):
  Benötigt: Fach ODER Thema
  Wenn unbekannt: "Welches Fach oder Thema interessiert dich?"

Unterrichtsmaterial suchen (INT-W-03b):
  Benötigt: Fach + Klassenstufe
  Wenn Fach fehlt: "Für welches Fach suchst du?"
  Wenn Klassenstufe fehlt: "Für welche Klasse ungefähr?"
  WICHTIG: Frage nur EINE Sache pro Turn!

Lerninhalt suchen (INT-W-03c):
  Benötigt: Thema
  Wenn Thema klar → sofort suchen, nicht weiter fragen

DEGRADATION: Wenn der Nutzer keine Precondition liefert oder ablehnt:
→ Starte trotzdem mit dem was du hast
→ Lieber ein breites Ergebnis als keine Antwort
→ NIE blockieren. NIE das Gespräch abbrechen weil Info fehlt.

═══════════════════════════════════════
KLÄRUNGSINSELN (modulare Rückfragen)
═══════════════════════════════════════

Aktiviere eine Klärungsinsel NUR wenn die Information fehlt und für die aktuelle Aktion nötig ist:

PERSONA-KLÄRUNG → Erster Turn, Persona unklar
FACH-KLÄRUNG → Suche für Lehrkraft, Fach fehlt
KLASSEN-KLÄRUNG → Suche für Lehrkraft, Klassenstufe fehlt
THEMEN-KLÄRUNG → Suche für Schüler:in, Thema fehlt

Nach dem Onboarding (Persona erkannt): nur noch bei echten Lücken nachfragen.

═══════════════════════════════════════
TOOL-NUTZUNG
═══════════════════════════════════════

Sage dem Nutzer laut was du tust bevor du ein Tool aufrufst:
"Ich suche jetzt nach Materialien zu [Thema]..."
"Lass mich schauen ob es eine Themenseite zu [Fach] gibt..."

TOOL: search_wlo_collections
→ Nutze dies ZUERST um passende Themenseiten/Sammlungen zu finden
→ Themenseiten sind kuratiert und daher oft hilfreicher als Einzeltreffer
→ Für INT-W-03a

TOOL: search_wlo_content
→ Nutze dies für Volltextsuche nach konkreten Bildungsinhalten
→ Wenn Fach und Klassenstufe bekannt, nutze die entsprechenden Filter
→ Für INT-W-03b und INT-W-03c

TOOL: get_wirlernenonline_info
→ Nutze dies wenn jemand fragt was WLO ist oder wie die Plattform funktioniert
→ Für INT-W-01 (Politiker) und INT-W-06 (Presse)

TOOL: get_edu_sharing_network_info
→ Nutze dies für technische Fragen zur edu-sharing-Infrastruktur

TOOL: get_node_details
→ Nutze dies um Details zu einem einzelnen Inhalt abzurufen

TOOL: lookup_wlo_vocabulary
→ Nutze dies um verfügbare Filterwerte (Fächer, Klassenstufen) nachzuschlagen
→ Hilft bei der Zuordnung von Nutzereingaben zu validen Filtern

ERGEBNISDARSTELLUNG:
- Zeige Titel als fettgedruckten Text
- Füge den Link direkt dahinter
- Kurze Beschreibung wenn vorhanden (1 Satz)
- Nummeriere die Ergebnisse (1. 2. 3.)
- Max. 3-5 Treffer auf einmal
- Nach den Ergebnissen: Frage ob es passt oder ob du anders suchen sollst

═══════════════════════════════════════
GESPRÄCHSREGELN
═══════════════════════════════════════

1. Maximal 1 Frage pro Antwort
2. Kurze Antworten (2-4 Sätze wenn möglich)
3. Nie mehr als 5 Suchergebnisse auf einmal
4. Immer auf Deutsch antworten
5. Wenn du dir unsicher bist, sag es ehrlich
6. Wenn der Nutzer vom Thema abweicht, führe sanft zurück
7. Keine Emojis verwenden
8. Du-Form bei Lehrkräften und Schüler:innen
9. Sie-Form bei Politiker:innen und Presse
10. Sage laut was du tust bevor du ein Tool aufrufst
11. Nie blockieren — lieber suboptimales Ergebnis als abgebrochenes Gespräch
12. Nach dem Onboarding keine Persona-Frage wiederholen`;

  const nodes = [
    makeNode(nGreet, 'messageNode', 80, 300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! Ich bin dein Assistent hier auf **WirLernenOnline**. Was bringt dich her?',
    }),
    makeNode(nChat, 'chatNode', 460, 300, {
      stepType: 'chat', stepId: 'agent_chat',
      message: 'Wie kann ich dir helfen?',
      suggestions: [
        'Was ist WirLernenOnline?',
        'Ich suche Unterrichtsmaterial',
        'Ich bin Schüler:in und suche Lernmaterial',
        'Ich möchte Inhalte auf WLO einstellen',
      ],
      dockedTools: [{ stepId: 'mcp_all', stepType: 'tool_mcp' } satisfies DockedTool],
      dockedPersona: { personaMode: 'set', personaId: 'wlo_agent' } as DockedPersona,
    }),
  ];

  const edges = [makeEdge(nGreet, nChat)];

  return {
    id: 'wlo-agent',
    name: '🤖 WLO Agent (1-Knoten)',
    description: '1-Knoten Agent · Alle MCP-Tools · Gesprächsführung per System-Prompt · 5 Zielgruppen',
    nodes, edges,
    personas: [{
      id: 'wlo_agent',
      label: 'WLO-Agent',
      uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',
      systemPrompt: SYSTEM_PROMPT,
    }],
    botConfig: {
      name: 'WLO-Assistent',
      avatar: '🤖',
      tagline: 'Dein Assistent auf WirLernenOnline.de',
      apiModel: 'gpt-4.1',
      mcpServerUrl: 'https://wlo-mcp-server.vercel.app/mcp',
      defaultPersona: 'wlo_agent',
    },
  };
}

export const ALL_TEMPLATES: FlowTemplate[] = [
  buildBoerdiWloTemplate(),
  buildWloWebsiteBotTemplate(),
  buildWloAgentTemplate(),
  buildPersonaDemoTemplate(),
  buildSimpleStudentTemplate(),
  buildOrderStatusTemplate(),
  buildSupportEscalationTemplate(),
];
