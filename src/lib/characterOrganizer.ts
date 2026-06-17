import type { CharacterCard } from "./types";

export type OrganizedGreeting = {
  id: string;
  label: string;
  kind: "main" | "alternate";
  text: string;
};

export type OrganizedWorldEntry = {
  id: string;
  enabled: boolean;
  title: string;
  triggerMode: "always" | "keyword" | "vector" | "regex";
  keys: string[];
  secondaryKeys: string[];
  logic: string;
  content: string;
  position: string;
  insertionOrder: number | null;
  probability: number | null;
  depth: number | null;
  scanDepth: number | null;
};

export type OrganizedRegexRule = {
  id: string;
  enabled: boolean;
  name: string;
  pattern: string;
  replacement: string;
  scope: string[];
  minDepth: number | null;
  maxDepth: number | null;
  options: string[];
};

export type OrganizedVersion = {
  id: string;
  version: string;
  note: string;
  createdAt?: string;
  current: boolean;
};

export type OrganizedField = {
  label: string;
  value: string;
  long?: boolean;
};

export type OrganizedCharacter = {
  identity: OrganizedField[];
  behavior: OrganizedField[];
  prompts: OrganizedField[];
  greetings: OrganizedGreeting[];
  worldEntries: OrganizedWorldEntry[];
  regexRules: OrganizedRegexRule[];
  versions: OrganizedVersion[];
  rawExtensions: Record<string, unknown>;
  rawExtra: Record<string, unknown>;
};

export function organizeCharacter(card: CharacterCard | null): OrganizedCharacter {
  if (!card) {
    return {
      identity: [],
      behavior: [],
      prompts: [],
      greetings: [],
      worldEntries: [],
      regexRules: [],
      versions: [],
      rawExtensions: {},
      rawExtra: {}
    };
  }

  const extensions = asRecord(card.extensions);
  const extra = asRecord(card.extra);

  return {
    identity: compactFields([
      field("角色名", card.name),
      field("作者", card.creator),
      field("角色版本", card.character_version),
      field("标签", listText(card.tags)),
      field("简介", card.description, true),
      field("性格", card.personality, true),
      field("场景", card.scenario, true)
    ]),
    behavior: compactFields([
      field("示例对话", card.mes_example, true),
      field("说话活跃度", card.talkativeness),
      field("深度提示", stringify((card as any).depth_prompt), true)
    ]),
    prompts: compactFields([
      field("系统提示", card.system_prompt, true),
      field("历史后指令", card.post_history_instructions, true),
      field("作者备注", card.creator_notes, true)
    ]),
    greetings: organizeGreetings(card),
    worldEntries: organizeWorldEntries(card.character_book),
    regexRules: organizeRegexRules(card, extensions),
    versions: organizeVersions(card, extensions),
    rawExtensions: extensions,
    rawExtra: extra
  };
}

function organizeGreetings(card: CharacterCard): OrganizedGreeting[] {
  const greetings: OrganizedGreeting[] = [];
  if (hasText(card.first_mes)) {
    greetings.push({
      id: "main",
      label: "主开场白",
      kind: "main",
      text: String(card.first_mes)
    });
  }

  toArray(card.alternate_greetings).forEach((text, index) => {
    if (!hasText(text)) return;
    greetings.push({
      id: `alternate-${index + 1}`,
      label: `备用开场白 ${index + 1}`,
      kind: "alternate",
      text: String(text)
    });
  });

  return greetings;
}

function organizeWorldEntries(book: unknown): OrganizedWorldEntry[] {
  return readWorldEntries(book).map((entry, index) => {
    const ext = asRecord(entry.extensions);
    const id = stringify(entry.id ?? entry.uid ?? index + 1);
    return {
      id,
      enabled: entry.enabled !== false && entry.disable !== true,
      title: stringify(entry.comment ?? entry.title ?? `条目 ${index + 1}`),
      triggerMode: worldTriggerMode(entry, ext),
      keys: toTextArray(entry.keys ?? entry.key),
      secondaryKeys: toTextArray(entry.secondary_keys ?? entry.keysecondary),
      logic: logicLabel(entry.selectiveLogic ?? ext.selectiveLogic),
      content: stringify(entry.content),
      position: positionLabel(entry.position ?? ext.position),
      insertionOrder: numberOrNull(entry.insertion_order ?? entry.order),
      probability: numberOrNull(ext.probability ?? entry.probability),
      depth: numberOrNull(ext.depth ?? entry.depth),
      scanDepth: numberOrNull(ext.scan_depth ?? entry.scanDepth ?? entry.scan_depth)
    };
  });
}

function organizeRegexRules(card: CharacterCard, extensions: Record<string, unknown>): OrganizedRegexRule[] {
  const candidates = [
    ...toObjectArray(extensions.regex_scripts),
    ...toObjectArray(extensions.regex),
    ...toObjectArray(extensions.regex_rules),
    ...toObjectArray((card as any).regex_scripts),
    ...toObjectArray((card as any).regex_rules)
  ];

  const seen = new Set<string>();
  return candidates
    .map((rule, index) => ({
      id: stringify(rule.id ?? rule.scriptName ?? rule.name ?? index + 1),
      enabled: rule.disabled !== true && rule.enabled !== false,
      name: stringify(rule.scriptName ?? rule.name ?? rule.comment ?? `正则 ${index + 1}`),
      pattern: stringify(rule.findRegex ?? rule.regex ?? rule.pattern),
      replacement: stringify(rule.replaceString ?? rule.replace ?? rule.substitute ?? rule.replacement),
      scope: regexScope(rule),
      minDepth: numberOrNull(rule.minDepth ?? rule.min_depth),
      maxDepth: numberOrNull(rule.maxDepth ?? rule.max_depth),
      options: regexOptions(rule)
    }))
    .filter(rule => {
      const fingerprint = [
        rule.name,
        rule.pattern,
        rule.replacement,
        rule.scope.join("|"),
        rule.minDepth ?? "",
        rule.maxDepth ?? ""
      ].join("\u0001");
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    })
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `regex-${index + 1}`
    }));
}

function organizeVersions(card: CharacterCard, extensions: Record<string, unknown>): OrganizedVersion[] {
  const history = [
    ...toObjectArray(extensions.version_history),
    ...toObjectArray(extensions.versions),
    ...toObjectArray((card as any).versions)
  ];

  const versions = history.map((item, index) => ({
    id: stringify(item.id ?? item.version_number ?? item.version ?? index + 1),
    version: stringify(item.version_number ?? item.version ?? item.name ?? `V${index + 1}`),
    note: stringify(item.note ?? item.description ?? item.message),
    createdAt: stringify(item.created_at ?? item.createdAt ?? item.date) || undefined,
    current: Boolean(item.current)
  }));

  if (!versions.length && hasText(card.character_version)) {
    versions.push({
      id: "current",
      version: String(card.character_version),
      note: "角色卡当前声明版本",
      createdAt: undefined,
      current: true
    });
  }

  if (versions.length && !versions.some(item => item.current)) {
    versions[0] = { ...versions[0], current: true };
  }

  return versions;
}

function readWorldEntries(book: unknown): Record<string, unknown>[] {
  const data = asRecord(book);
  if (Array.isArray(book)) return toObjectArray(book);
  if (Array.isArray(data.entries)) return toObjectArray(data.entries);
  if (data.entries && typeof data.entries === "object") return toObjectArray(Object.values(data.entries as Record<string, unknown>));
  const nested = asRecord(data.character_book);
  if (Array.isArray(nested.entries)) return toObjectArray(nested.entries);
  if (nested.entries && typeof nested.entries === "object") return toObjectArray(Object.values(nested.entries as Record<string, unknown>));
  return [];
}

function worldTriggerMode(entry: Record<string, unknown>, ext: Record<string, unknown>): OrganizedWorldEntry["triggerMode"] {
  if (entry.constant === true) return "always";
  if (entry.vectorized === true || ext.vectorized === true) return "vector";
  if (entry.use_regex === true) return "regex";
  return "keyword";
}

function logicLabel(value: unknown) {
  const normalized = String(value ?? "0");
  if (normalized === "1") return "全部关键词";
  if (normalized === "2") return "非全部关键词";
  if (normalized === "3") return "非任意关键词";
  return "任意关键词";
}

function positionLabel(value: unknown) {
  const normalized = String(value ?? "0");
  const labels: Record<string, string> = {
    "0": "角色定义之前",
    "1": "角色定义之后",
    "2": "作者备注之前",
    "3": "作者备注之后",
    "4": "指定深度",
    "5": "示例消息之前",
    "6": "示例消息之后"
  };
  return labels[normalized] || `位置 ${normalized}`;
}

function regexScope(rule: Record<string, unknown>) {
  const placement = toTextArray(rule.placement);
  const scope = toTextArray(rule.scope ?? rule.targets);
  const resolved = [...scope];
  if (placement.includes("1")) resolved.push("用户输入");
  if (placement.includes("2")) resolved.push("AI 输出");
  if (rule.markdownOnly) resolved.push("仅 Markdown");
  if (rule.promptOnly) resolved.push("仅提示词");
  return [...new Set(resolved.length ? resolved : ["默认范围"])];
}

function regexOptions(rule: Record<string, unknown>) {
  return [
    rule.disabled === true || rule.enabled === false ? "停用" : "启用",
    rule.trimStrings ? "裁剪空白" : "",
    rule.substituteRegex ? "替换中继续正则" : "",
    rule.runOnEdit ? "编辑时运行" : ""
  ].filter(Boolean);
}

function compactFields(fields: OrganizedField[]) {
  return fields.filter(item => hasText(item.value));
}

function field(label: string, value: unknown, long = false): OrganizedField {
  return { label, value: stringify(value), long };
}

function listText(value: unknown) {
  return toTextArray(value).join(" / ");
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function toObjectArray(value: unknown): Record<string, unknown>[] {
  return toArray(value).filter(item => item && typeof item === "object").map(item => item as Record<string, unknown>);
}

function toTextArray(value: unknown): string[] {
  return toArray(value).map(item => stringify(item)).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasText(value: unknown) {
  return stringify(value).trim().length > 0;
}

function stringify(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
