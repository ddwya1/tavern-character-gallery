import type { CharacterCard, TavernCandidate } from "./types";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "请求失败");
  }
  return response.json() as Promise<T>;
}

export function scanTaverns(force = false) {
  return request<{ selected: TavernCandidate | null; candidates: TavernCandidate[]; cached: boolean }>(`/api/taverns/scan${force ? "?force=1" : ""}`);
}

export function selectTavern(path: string) {
  return request<TavernCandidate>("/api/taverns/select", {
    method: "POST",
    body: JSON.stringify({ path })
  });
}

export function listCharacters() {
  return request<CharacterCard[]>("/api/characters");
}

export function previewCharacter(path: string) {
  return request<CharacterCard>("/api/characters/preview", {
    method: "POST",
    body: JSON.stringify({ path })
  });
}

export function importCharacter(sourcePath: string) {
  return request<CharacterCard>("/api/characters/import", {
    method: "POST",
    body: JSON.stringify({ sourcePath })
  });
}

export function importCharacterBlob(fileName: string, contentBase64: string) {
  return request<CharacterCard>("/api/characters/import-blob", {
    method: "POST",
    body: JSON.stringify({ fileName, contentBase64 })
  });
}

export function saveCharacterAs(sourcePath: string, fileName: string) {
  return request<CharacterCard>("/api/characters/save-as", {
    method: "POST",
    body: JSON.stringify({ sourcePath, fileName })
  });
}

export function deleteCharacter(filePath: string) {
  return request<{ ok: boolean }>("/api/characters", {
    method: "DELETE",
    body: JSON.stringify({ filePath })
  });
}
