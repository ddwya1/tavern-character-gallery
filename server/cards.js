import fs from "node:fs/promises";
import path from "node:path";
import extractChunks from "png-chunks-extract";
import textChunk from "png-chunk-text";
import { readCache } from "./config.js";

const knownFields = new Set([
  "name",
  "avatar",
  "description",
  "personality",
  "scenario",
  "first_mes",
  "mes_example",
  "creator_notes",
  "tags",
  "alternate_greetings",
  "character_book",
  "extensions",
  "system_prompt",
  "post_history_instructions",
  "creator",
  "character_version",
  "talkativeness",
  "depth_prompt",
  "regex_scripts",
  "regex_rules",
  "versions",
  "version_history",
  "data"
]);

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function normalizeCard(raw, filePath = "") {
  const data = raw?.data || raw;
  const extensions = data?.extensions || raw?.extensions || {};
  const normalized = {
    id: Buffer.from(filePath || data?.name || crypto.randomUUID?.() || String(Date.now())).toString("base64url"),
    filePath,
    fileName: filePath ? path.basename(filePath) : "",
    name: data?.name || raw?.name || path.basename(filePath, path.extname(filePath)) || "未命名角色",
    avatar: data?.avatar || raw?.avatar || "",
    description: data?.description || "",
    personality: data?.personality || "",
    scenario: data?.scenario || "",
    first_mes: data?.first_mes || raw?.first_mes || "",
    mes_example: data?.mes_example || "",
    creator_notes: data?.creator_notes || raw?.creator_notes || "",
    tags: data?.tags || raw?.tags || extensions?.tags || [],
    alternate_greetings: data?.alternate_greetings || [],
    character_book: data?.character_book || raw?.character_book || null,
    extensions,
    system_prompt: data?.system_prompt || raw?.system_prompt || "",
    post_history_instructions: data?.post_history_instructions || "",
    creator: data?.creator || "",
    character_version: data?.character_version || "",
    talkativeness: data?.talkativeness || "",
    depth_prompt: data?.depth_prompt || "",
    regex_scripts: data?.regex_scripts || raw?.regex_scripts || extensions?.regex_scripts || [],
    regex_rules: data?.regex_rules || raw?.regex_rules || extensions?.regex_rules || [],
    versions: data?.versions || raw?.versions || extensions?.versions || [],
    version_history: data?.version_history || raw?.version_history || extensions?.version_history || [],
    data
  };

  normalized.extra = Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => !knownFields.has(key))
  );
  return normalized;
}

function encodedPath(filePath) {
  return Buffer.from(filePath, "utf8").toString("base64url");
}

function fileCover(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (![".png", ".webp"].includes(ext)) return "";
  return `/api/characters/cover/${encodedPath(filePath)}`;
}

function buildLightCard(filePath, stat = null) {
  const parsed = path.parse(filePath);
  return {
    ...normalizeCard({ name: parsed.name }, filePath),
    cover: fileCover(filePath),
    imported: true,
    needsDetail: true,
    fileSize: stat?.size ?? null,
    updatedAt: stat?.mtimeMs ?? null
  };
}

function pickLightFields(card, filePath, stat = null) {
  return {
    id: Buffer.from(filePath, "utf8").toString("base64url"),
    filePath,
    fileName: path.basename(filePath),
    name: card.name || path.basename(filePath, path.extname(filePath)),
    avatar: card.avatar || "",
    tags: Array.isArray(card.tags) ? card.tags.slice(0, 8) : [],
    creator: card.creator || "",
    character_version: card.character_version || "",
    cover: fileCover(filePath),
    imported: true,
    needsDetail: true,
    fileSize: stat?.size ?? null,
    updatedAt: stat?.mtimeMs ?? null
  };
}

function lightFromPayload(payload, filePath, stat) {
  const parsed = tryParseCardPayload(payload);
  if (!parsed) return null;
  return pickLightFields(normalizeCard(parsed, filePath), filePath, stat);
}

async function parsePngLightCard(filePath, stat) {
  const handle = await fs.open(filePath, "r");
  try {
    const header = Buffer.alloc(8);
    await handle.read(header, 0, 8, 0);
    if (header.toString("hex") !== "89504e470d0a1a0a") return null;
    let position = 8;
    let inspected = 0;
    while (position + 8 < stat.size && inspected < 6 * 1024 * 1024) {
      const chunkHeader = Buffer.alloc(8);
      await handle.read(chunkHeader, 0, 8, position);
      const length = chunkHeader.readUInt32BE(0);
      const type = chunkHeader.toString("ascii", 4, 8);
      position += 8;
      if (length < 0 || length > 8 * 1024 * 1024) break;
      if (type === "IDAT") break;
      if (["tEXt", "iTXt", "zTXt"].includes(type)) {
        const chunk = Buffer.alloc(length);
        await handle.read(chunk, 0, length, position);
        inspected += length;
        if (type === "tEXt") {
          const decoded = textChunk.decode(chunk);
          if (["chara", "ccv3", "data"].includes(decoded.keyword)) {
            const card = lightFromPayload(decoded.text.trim(), filePath, stat);
            if (card) return card;
          }
        } else {
          const text = chunk.toString("utf8");
          const marker = ["chara", "ccv3", "data"].find(item => text.includes(item));
          if (marker) {
            const payload = text.slice(text.indexOf(marker) + marker.length).replace(/^[\0\s]+/, "");
            const card = lightFromPayload(payload, filePath, stat);
            if (card) return card;
          }
        }
      }
      position += length + 4;
    }
    return null;
  } finally {
    await handle.close();
  }
}

async function parseLightCard(filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === ".json") {
      const parsed = JSON.parse(await fs.readFile(filePath, "utf8"));
      return pickLightFields(normalizeCard(parsed, filePath), filePath, stat);
    }
    if (ext === ".png") return await parsePngLightCard(filePath, stat) || buildLightCard(filePath, stat);
    return buildLightCard(filePath, stat);
  } catch {
    return buildLightCard(filePath, stat);
  }
}

function parsePngCard(buffer, filePath) {
  const chunks = extractChunks(buffer);
  let legacyCandidate = null;
  for (const chunk of chunks) {
    if (chunk.name !== "tEXt") continue;
    const decoded = textChunk.decode(chunk.data);
    if (!["chara", "ccv3", "data"].includes(decoded.keyword)) continue;
    const payload = decoded.text.trim();
    const attempts = [
      () => Buffer.from(payload, "base64").toString("utf8"),
      () => payload
    ];
    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt());
        if (decoded.keyword === "ccv3") {
          return { ...normalizeCard(parsed, filePath), cover: fileCover(filePath) };
        }
        if (!legacyCandidate) legacyCandidate = parsed;
        break;
      } catch {
        continue;
      }
    }
  }
  if (legacyCandidate) return { ...normalizeCard(legacyCandidate, filePath), cover: fileCover(filePath) };
  return { ...normalizeCard({ name: path.basename(filePath, path.extname(filePath)) }, filePath), cover: fileCover(filePath) };
}

function tryParseCardPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(Buffer.from(trimmed, "base64").toString("utf8"));
    } catch {
      return null;
    }
  }
}

function parseWebpCard(buffer, filePath) {
  const latin = buffer.toString("latin1");
  const utf8 = buffer.toString("utf8");
  const jsonMatches = utf8.match(/\{[\s\S]{20,}?\}/g) || [];
  for (const candidate of jsonMatches) {
    const parsed = tryParseCardPayload(candidate);
    const data = parsed?.data || parsed;
    if (data?.name || data?.first_mes || data?.description) {
      return { ...normalizeCard(parsed, filePath), cover: fileCover(filePath) };
    }
  }

  for (const marker of ["chara", "ccv3", "data"]) {
    const index = latin.indexOf(marker);
    if (index === -1) continue;
    const slice = latin.slice(index + marker.length, index + marker.length + 300000);
    const base64Match = slice.match(/[A-Za-z0-9+/=]{80,}/);
    if (!base64Match) continue;
    const parsed = tryParseCardPayload(base64Match[0]);
    const data = parsed?.data || parsed;
    if (data?.name || data?.first_mes || data?.description) {
      return { ...normalizeCard(parsed, filePath), cover: fileCover(filePath) };
    }
  }

  return { ...normalizeCard({ name: path.basename(filePath, path.extname(filePath)) }, filePath), cover: fileCover(filePath) };
}

function isInside(parent, child) {
  const resolvedParent = path.resolve(parent);
  const resolvedChild = path.resolve(child);
  const normalizedParent = process.platform === "win32" ? resolvedParent.toLowerCase() : resolvedParent;
  const normalizedChild = process.platform === "win32" ? resolvedChild.toLowerCase() : resolvedChild;
  return normalizedChild === normalizedParent || normalizedChild.startsWith(normalizedParent + path.sep);
}

export async function resolveCharacterCover(encoded) {
  const filePath = Buffer.from(String(encoded || ""), "base64url").toString("utf8");
  const ext = path.extname(filePath).toLowerCase();
  if (![".png", ".webp"].includes(ext)) throw new Error("不支持的封面格式。");
  const cache = await readCache();
  const root = cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  const characterDir = path.resolve(root, "characters");
  const target = path.resolve(filePath);
  if (!isInside(characterDir, target)) throw new Error("只能读取当前酒馆 characters 目录内的封面。");
  if (!await fileExists(target)) throw new Error("封面文件不存在。");
  return target;
}

export async function parseCharacterFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  if (ext === ".json") return normalizeCard(JSON.parse(buffer.toString("utf8")), filePath);
  if (ext === ".png") return parsePngCard(buffer, filePath);
  if (ext === ".webp") return parseWebpCard(buffer, filePath);
  throw new Error("暂不支持该角色卡格式。");
}

export async function parseCharacterDetail(filePath, tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  const characterDir = path.resolve(root, "characters");
  const target = path.resolve(filePath || "");
  if (!isInside(characterDir, target)) throw new Error("只能读取当前酒馆 characters 目录内的角色卡。");
  if (!await fileExists(target)) throw new Error("角色卡文件不存在。");
  return { ...await parseCharacterFile(target), needsDetail: false };
}

export async function listCharacters(tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) return [];
  const charactersDir = path.join(root, "characters");
  if (!await fileExists(charactersDir)) return [];
  const entries = await fs.readdir(charactersDir, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && /\.(png|json|webp)$/i.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }));
  const cards = await Promise.all(files.map(async file => {
    const target = path.join(charactersDir, file);
    try {
      const stat = await fs.stat(target);
      return parseLightCard(target, stat);
    } catch (error) {
      return {
        ...buildLightCard(target),
        parseError: error.message
      };
    }
  }));
  return cards;
}

export async function importCharacter(sourcePath, tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  const targetDir = path.join(root, "characters");
  await fs.mkdir(targetDir, { recursive: true });

  const sourceName = path.basename(sourcePath);
  const parsed = path.parse(sourceName);
  let target = path.join(targetDir, sourceName);
  let index = 1;
  while (await fileExists(target)) {
    target = path.join(targetDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  await fs.copyFile(sourcePath, target);
  return parseCharacterFile(target);
}

export async function importCharacterBlob(fileName, contentBase64, tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  const targetDir = path.join(root, "characters");
  await fs.mkdir(targetDir, { recursive: true });

  const parsed = path.parse(fileName);
  let target = path.join(targetDir, fileName);
  let index = 1;
  while (await fileExists(target)) {
    target = path.join(targetDir, `${parsed.name}-${index}${parsed.ext}`);
    index += 1;
  }
  await fs.writeFile(target, Buffer.from(contentBase64, "base64"));
  return parseCharacterFile(target);
}

export async function saveCharacterAs(sourcePath, fileName, tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  if (!sourcePath) throw new Error("缺少源文件路径。");
  const resolvedSource = path.resolve(sourcePath);
  if (!(await fileExists(resolvedSource))) throw new Error("源文件不存在。");
  const targetDir = path.join(root, "characters");
  await fs.mkdir(targetDir, { recursive: true });
  const parsed = path.parse(fileName || path.basename(resolvedSource));
  let target = path.join(targetDir, `${parsed.name || "character-copy"}${parsed.ext || path.extname(resolvedSource)}`);
  let index = 1;
  while (await fileExists(target)) {
    target = path.join(targetDir, `${parsed.name || "character-copy"}-${index}${parsed.ext || path.extname(resolvedSource)}`);
    index += 1;
  }
  await fs.copyFile(resolvedSource, target);
  return parseCharacterFile(target);
}

export async function deleteCharacter(filePath, tavernPath) {
  const cache = await readCache();
  const root = tavernPath || cache.selectedTavernPath;
  if (!root) throw new Error("尚未连接 SillyTavern。");
  const characterDir = path.resolve(root, "characters");
  const target = path.resolve(filePath || "");
  if (!target.startsWith(characterDir)) throw new Error("只能删除 characters 目录内的角色卡。");
  await fs.unlink(target);
  return { ok: true };
}
