export type Role = "user" | "bot";

export interface CharacterCard {
  id: string;
  filePath?: string;
  fileName?: string;
  importBlob?: {
    fileName: string;
    contentBase64: string;
  };
  name: string;
  subtitle?: string;
  avatar?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  tags?: string[];
  alternate_greetings?: string[];
  character_book?: unknown;
  extensions?: unknown;
  system_prompt?: string;
  post_history_instructions?: string;
  creator?: string;
  character_version?: string;
  talkativeness?: string;
  depth_prompt?: string;
  extra?: Record<string, unknown>;
  [key: string]: unknown;
  cover?: string;
  favorite?: boolean;
  imported?: boolean;
  staged?: boolean;
  recent?: string;
}

export interface TavernCandidate {
  path: string;
  score: number;
  reasons: string[];
  characterCount: number;
  isBackupLike: boolean;
}
