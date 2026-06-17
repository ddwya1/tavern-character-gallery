import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const dataDir = path.resolve(process.cwd(), "data");
const cacheFile = path.join(dataDir, "cache.json");

export async function readCache() {
  try {
    const raw = await fs.readFile(cacheFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return {
      selectedTavernPath: "",
      candidates: [],
      favorites: []
    };
  }
}

export async function writeCache(cache) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2), "utf8");
}

export function homeDir() {
  return os.homedir();
}

export function projectRoot() {
  return process.cwd();
}
