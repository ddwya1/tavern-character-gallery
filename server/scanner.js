import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { homeDir, projectRoot, readCache, writeCache } from "./config.js";

const skipNames = new Set([
  "node_modules",
  ".git",
  ".cache",
  "tmp",
  "logs",
  "dist",
  "build",
  "venv",
  "__pycache__",
  "pycache",
  "$RECYCLE.BIN",
  "System Volume Information",
  "WindowsApps",
  "WpSystem"
]);

function driveRoots() {
  if (process.platform !== "win32") return ["/root", "/home", "/opt", "/srv", "/var/www", "/www", "/app", "/docker"];
  return ["D:\\", "E:\\", "C:\\"];
}

function commonRoots() {
  const home = homeDir();
  const roots = [
    projectRoot(),
    path.resolve(projectRoot(), ".."),
    home,
    path.join(home, "Desktop"),
    path.join(home, "Downloads"),
    path.join(home, "Documents"),
    ...driveRoots(),
    "/data/data/com.termux/files/home",
    "/data/data/com.termux/files/home/SillyTavern",
    "/storage/emulated/0",
    "/sdcard"
  ];
  return [...new Set(roots)];
}

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listDirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function scoreCandidate(dir) {
  const entries = await listDirSafe(dir);
  const names = new Set(entries.map(entry => entry.name));
  let score = 0;
  const reasons = [];

  for (const item of [
    ["characters", 38],
    ["public", 12],
    ["package.json", 15],
    ["server.js", 12],
    ["start.sh", 8],
    ["start.bat", 8],
    ["config", 8],
    ["worlds", 10],
    ["world", 8]
  ]) {
    if (names.has(item[0])) {
      score += item[1];
      reasons.push(item[0]);
    }
  }

  const characterCount = names.has("characters")
    ? (await listDirSafe(path.join(dir, "characters"))).filter(entry => entry.isFile()).length
    : 0;

  if (/silly|tavern|酒馆|st/i.test(path.basename(dir))) score += 8;
  return { path: dir, score, reasons, characterCount, isBackupLike: /backup|备份|bak/i.test(dir) };
}

async function scanFrom(root, maxDepth, deadline, found, seen) {
  if (Date.now() > deadline || seen.has(root)) return;
  seen.add(root);

  const base = path.basename(root);
  if (skipNames.has(base)) return;

  const scored = await scoreCandidate(root);
  if (scored.score >= 45) found.set(root, scored);

  if (maxDepth <= 0) return;
  const entries = await listDirSafe(root);
  const dirs = entries
    .filter(entry => entry.isDirectory() && !skipNames.has(entry.name))
    .slice(0, 80);

  await Promise.all(dirs.map(entry => scanFrom(path.join(root, entry.name), maxDepth - 1, deadline, found, seen)));
}

export async function scanTaverns({ force = false } = {}) {
  const cache = await readCache();
  if (!force && cache.selectedTavernPath && await exists(cache.selectedTavernPath)) {
    const selected = await scoreCandidate(cache.selectedTavernPath);
    return { selected, candidates: cache.candidates || [selected], cached: true };
  }

  const found = new Map();
  const seen = new Set();
  const deadline = Date.now() + 8000;
  for (const root of commonRoots()) {
    if (await exists(root)) {
      await scanFrom(root, 3, deadline, found, seen);
    }
  }

  const candidates = [...found.values()].sort((a, b) => b.score - a.score).slice(0, 12);
  const selected = candidates[0] || null;
  await writeCache({ ...cache, selectedTavernPath: selected?.path || "", candidates });
  return { selected, candidates, cached: false };
}

export async function selectTavern(tavernPath) {
  const scored = await scoreCandidate(tavernPath);
  const cache = await readCache();
  await writeCache({ ...cache, selectedTavernPath: tavernPath });
  return scored;
}
