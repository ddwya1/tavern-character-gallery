import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanTaverns, selectTavern } from "./scanner.js";
import { deleteCharacter, importCharacter, importCharacterBlob, listCharacters, parseCharacterFile, resolveCharacterCover, saveCharacterAs } from "./cards.js";

const app = express();
const port = Number(process.env.PORT || 3829);
const host = process.env.HOST || "127.0.0.1";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "酒馆角色馆" });
});

app.get("/api/taverns/scan", async (req, res, next) => {
  try {
    res.json(await scanTaverns({ force: req.query.force === "1" }));
  } catch (error) {
    next(error);
  }
});

app.post("/api/taverns/select", async (req, res, next) => {
  try {
    res.json(await selectTavern(req.body.path));
  } catch (error) {
    next(error);
  }
});

app.get("/api/characters", async (req, res, next) => {
  try {
    res.json(await listCharacters(req.query.tavernPath));
  } catch (error) {
    next(error);
  }
});

app.get("/api/characters/cover/:encoded", async (req, res, next) => {
  try {
    res.sendFile(await resolveCharacterCover(req.params.encoded));
  } catch (error) {
    next(error);
  }
});

app.post("/api/characters/preview", async (req, res, next) => {
  try {
    res.json(await parseCharacterFile(req.body.path));
  } catch (error) {
    next(error);
  }
});

app.post("/api/characters/import", async (req, res, next) => {
  try {
    res.json(await importCharacter(req.body.sourcePath, req.body.tavernPath));
  } catch (error) {
    next(error);
  }
});

app.post("/api/characters/import-blob", async (req, res, next) => {
  try {
    res.json(await importCharacterBlob(req.body.fileName, req.body.contentBase64, req.body.tavernPath));
  } catch (error) {
    next(error);
  }
});

app.post("/api/characters/save-as", async (req, res, next) => {
  try {
    res.json(await saveCharacterAs(req.body.sourcePath, req.body.fileName, req.body.tavernPath));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/characters", async (req, res, next) => {
  try {
    res.json(await deleteCharacter(req.body.filePath, req.body.tavernPath));
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.resolve(__dirname, "../dist")));

app.use((error, _req, res, _next) => {
  res.status(400).json({ error: error.message || "请求失败" });
});

app.listen(port, host, () => {
  console.log(`酒馆角色馆 API: http://${host}:${port}`);
});
