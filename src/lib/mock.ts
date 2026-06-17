import type { CharacterCard } from "./types";

export const covers = [
  "radial-gradient(circle at 50% 18%, #ffe5a4 0 4%, transparent 9%), linear-gradient(150deg, #2b1016, #7b2634 42%, #1b0a0c 43% 100%)",
  "radial-gradient(circle at 62% 14%, #ffd4e8 0 4%, transparent 11%), linear-gradient(145deg, #16070d, #612237 48%, #c38266 100%)"
];

export const stagedDemo: CharacterCard = {
  id: "empty-gallery-placeholder",
  name: "等待导入",
  subtitle: "SillyTavern 角色卡",
  favorite: false,
  imported: false,
  staged: true,
  recent: "待导入",
  tags: ["待导入"],
  cover: covers[1],
  description: "导入 PNG / WEBP / JSON 角色卡后，会先进入封面墙。"
};
