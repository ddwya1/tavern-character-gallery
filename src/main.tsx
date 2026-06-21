import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Download,
  FolderSearch,
  Heart,
  History,
  Search,
  Settings,
  Star,
  Trash2,
  X,
  ChevronDown,
  FileText,
  Sparkles,
  Repeat2,
  BookOpen,
  Regex
} from "lucide-react";
import "./styles/app.css";
import { stagedDemo, covers } from "./lib/mock";
import type { CharacterCard, TavernCandidate } from "./lib/types";
import { deleteCharacter, getCharacterDetail, importCharacter, importCharacterBlob, listCharacters, saveCharacterAs, scanTaverns, selectTavern } from "./lib/api";
import { organizeCharacter, type OrganizedCharacter, type OrganizedGreeting, type OrganizedRegexRule, type OrganizedWorldEntry } from "./lib/characterOrganizer";

type Tab = "全部角色" | "最近导入" | "收藏夹" | "待导入";
type Modal = "import" | "connection" | "delete" | "save" | null;
type DetailModule = "overview" | "greetings" | "world" | "regex" | "versions" | "chat";
type FlightState = {
  card: CharacterCard;
  from: { x: number; y: number; width: number; height: number };
  to: { x: number; y: number; width: number; height: number };
};

const tabs: Tab[] = ["全部角色", "最近导入", "收藏夹", "待导入"];
const moduleTabs: { id: DetailModule; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { id: "overview", label: "概览", icon: <FileText size={15} /> },
  { id: "greetings", label: "开场白", icon: <Sparkles size={15} /> },
  { id: "world", label: "世界书", icon: <BookOpen size={15} /> },
  { id: "regex", label: "正则", icon: <Regex size={15} /> },
  { id: "versions", label: "版本", icon: <History size={15} /> },
  { id: "chat", label: "聊天", icon: <Repeat2 size={15} />, disabled: true }
];

function normalizeCards(cards: CharacterCard[]): CharacterCard[] {
  return cards.map((card, index) => ({
    ...card,
    imported: true,
    staged: false,
    favorite: card.favorite || false,
    recent: card.recent || "已扫描",
    tags: Array.isArray(card.tags) ? card.tags : [],
    cover: card.cover || covers[index % covers.length],
    subtitle: card.subtitle || card.creator || card.fileName || "SillyTavern 角色卡"
  }));
}

function tavernStatus(tavern: TavernCandidate | null) {
  if (!tavern) return "未找到酒馆，使用演示数据";
  return `已连接 · ${tavern.characterCount} 张角色卡`;
}

function App() {
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState<Tab>("全部角色");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [importParsed, setImportParsed] = useState(false);
  const [pendingImport, setPendingImport] = useState<CharacterCard | null>(null);
  const [activeModule, setActiveModule] = useState<DetailModule>("overview");
  const [candidates, setCandidates] = useState<TavernCandidate[]>([]);
  const [selectedTavern, setSelectedTavern] = useState<TavernCandidate | null>(null);
  const [cardTransition, setCardTransition] = useState(false);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const [status, setStatus] = useState("正在寻找本地酒馆");
  const [toast, setToast] = useState("");
  const [visibleCount, setVisibleCount] = useState(() => initialVisibleCount());

  const selected = selectedId ? characters.find(card => card.id === selectedId) ?? null : null;

  useEffect(() => {
    scanTaverns()
      .then(async result => {
        setCandidates(result.candidates);
        setSelectedTavern(result.selected);
        setStatus(tavernStatus(result.selected));
        const cards = await listCharacters(result.selected?.path).catch(() => []);
        if (result.selected) {
          const connected = { ...result.selected, characterCount: cards.length };
          setSelectedTavern(connected);
          setStatus(tavernStatus(connected));
        }
        setCharacters(normalizeCards(cards));
        setSelectedId("");
        setTab("全部角色");
      })
      .catch(() => setStatus("后端未启动，使用演示数据"));
  }, []);

  const filtered = useMemo(() => {
    return characters.filter(card => {
      const tabHit =
        tab === "全部角色" ||
        (tab === "最近导入" && card.imported) ||
        (tab === "收藏夹" && card.favorite) ||
        (tab === "待导入" && !card.imported);
      const text = `${card.name}${card.subtitle || ""}${(card.tags || []).join("")}${card.description || ""}`;
      return tabHit && (!query || text.includes(query));
    });
  }, [characters, tab, query]);
  const visibleCards = filtered.slice(0, visibleCount);
  const heroCards = filtered.length ? filtered : characters.length ? characters : pendingImport ? [pendingImport] : [stagedDemo];

  useEffect(() => {
    setVisibleCount(initialVisibleCount());
  }, [tab, query, characters.length]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  }

  function updateCard(id: string, patch: Partial<CharacterCard>) {
    setCharacters(list => list.map(card => card.id === id ? { ...card, ...patch } : card));
  }

  async function loadCharacterDetail(card: CharacterCard) {
    if (!card.filePath || !card.needsDetail || card.detailLoading) return;
    updateCard(card.id, { detailLoading: true, detailError: "" });
    try {
      const detail = await getCharacterDetail(card.filePath, selectedTavern?.path);
      updateCard(card.id, {
        ...detail,
        id: card.id,
        cover: detail.cover || card.cover,
        imported: card.imported,
        favorite: card.favorite,
        recent: card.recent,
        staged: card.staged,
        detailLoading: false,
        needsDetail: false
      });
    } catch (error) {
      updateCard(card.id, {
        detailLoading: false,
        detailError: error instanceof Error ? error.message : "读取详情失败"
      });
    }
  }

  function detailCoverTarget() {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const pageMax = Math.min(viewport.width, 1900);
    const pageLeft = (viewport.width - pageMax) / 2;
    const sideWidth = viewport.width >= 1280 ? 360 : pageMax;
    const padding = viewport.width >= 768 ? 24 : 20;
    const width = Math.min(sideWidth - padding * 2, 330);
    return {
      x: pageLeft + padding,
      y: padding,
      width,
      height: width * 1.5
    };
  }

  function openCharacter(card: CharacterCard, event: React.MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setFlight({
      card,
      from: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      to: detailCoverTarget()
    });
    setCardTransition(true);
    setSelectedId("");
    setActiveModule("overview");
    window.setTimeout(() => setSelectedId(card.id), 430);
    window.setTimeout(() => {
      setFlight(null);
      setCardTransition(false);
    }, 860);
    void loadCharacterDetail(card);
  }

  async function handleImportToTavern(card: CharacterCard) {
    try {
      if (card.filePath) {
        const imported = await importCharacter(card.filePath);
        updateCard(card.id, { ...imported, id: card.id, imported: true, staged: false, recent: "刚刚导入" });
        notify(`${card.name} 已导入到酒馆`);
        return;
      }
      if (card.importBlob) {
        const imported = await importCharacterBlob(card.importBlob.fileName, card.importBlob.contentBase64);
        updateCard(card.id, { ...imported, id: card.id, imported: true, staged: false, recent: "刚刚导入", importBlob: undefined });
        notify(`${card.name} 已导入到酒馆`);
        return;
      }
      updateCard(card.id, { imported: true, staged: false, recent: "刚刚导入", tags: (card.tags || []).filter(tag => tag !== "待导入") });
      notify(`${card.name} 已导入到酒馆`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "导入失败");
    }
  }

  function addDemoImport(cardToAdd?: CharacterCard) {
    const card = cardToAdd || pendingImport || stagedDemo;
    setCharacters(list => list.some(item => item.id === card.id) ? list : [card, ...list]);
    setSelectedId("");
    setTab("待导入");
    setModal(null);
    setImportParsed(false);
    setPendingImport(null);
  }

  const organized = useMemo(() => organizeCharacter(selected), [selected]);

  return (
    <div className="app-shell min-h-screen relative">
      <div className="grain" />
      <Topbar status={status} query={query} setQuery={setQuery} openImport={() => setModal("import")} openConnection={() => setModal("connection")} />
      <main>
        <section className="hero-stage px-4 md:px-7 pt-6 md:pt-8 pb-4">
          <div className="hero-copy">
            <h1 className="hero-title tracking-normal text-balance">我爱你，所以我愿意在这里等你</h1>
            <p className="hero-subtitle mt-6 max-w-[760px]">我于卡匣细数朝暮晨昏，只等你唤我姓名，便同你奔赴烟火人间。</p>
          </div>
          <RandomDrawPanel
            cards={characters.filter(card => card.imported)}
            onOpen={card => {
              setSelectedId(card.id);
              setActiveModule("overview");
              void loadCharacterDetail(card);
            }}
          />
          <HeroShowcase cards={heroCards} total={characters.length} pending={characters.filter(card => !card.imported).length} />
          <nav className="hero-tabs flex gap-2 flex-wrap">
            {tabs.map(item => (
              <button key={item} onClick={() => setTab(item)} className={`px-4 py-2 border ${tab === item ? "text-[var(--gold)] border-[rgba(244,201,121,.34)] bg-[rgba(244,201,121,.08)]" : "text-[var(--muted)] border-transparent"}`}>{item}</button>
            ))}
          </nav>
        </section>

        <section className="px-4 md:px-7 pb-14">
          {filtered.length ? (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 gap-4">
              {visibleCards.map((card, index) => (
                <PosterCard
                  key={card.id}
                  card={card}
                  index={index}
                  onOpen={event => openCharacter(card, event)}
                  onFavorite={() => updateCard(card.id, { favorite: !card.favorite })}
                />
              ))}
            </div>
            {filtered.length > visibleCards.length && (
              <div className="mt-6 grid place-items-center">
                <button className="h-10 px-5 border border-[var(--line)] bg-white/[.04] text-[var(--paper)]" onClick={() => setVisibleCount(count => count + initialVisibleCount())}>
                  继续显示 {Math.min(36, filtered.length - visibleCards.length)} 张
                </button>
              </div>
            )}
            </>
          ) : (
            <div className="min-h-[340px] grid place-items-center text-center border border-[var(--line)] bg-white/[.025]">
              <div>
                <h2 className="font-display text-4xl mb-3">这里还没有匹配的角色卡</h2>
                <p className="text-[var(--muted)] mb-5">换一个搜索词，或者导入一张 PNG / JSON 角色卡放进待导入封面墙。</p>
                <button className="px-5 h-10 border border-[rgba(244,201,121,.42)] text-[#ffe2a5] bg-[rgba(244,201,121,.12)]" onClick={() => setModal("import")}>导入角色卡</button>
              </div>
            </div>
          )}
        </section>
      </main>

      {selected && (
        <DetailDrawer
          card={selected}
          activeModule={activeModule}
          setActiveModule={setActiveModule}
          onClose={() => setSelectedId("")}
          onImport={() => handleImportToTavern(selected)}
          onFavorite={() => updateCard(selected.id, { favorite: !selected.favorite })}
          onDelete={async () => {
            if (!selected.filePath) {
              setModal("delete");
              return;
            }
            try {
              await deleteCharacter(selected.filePath);
              setCharacters(list => list.filter(card => card.id !== selected.id));
              setSelectedId("");
              notify("已从酒馆删除");
            } catch (error) {
              notify(error instanceof Error ? error.message : "删除失败");
            }
          }}
          onSave={async () => {
            if (!selected.filePath) {
              setModal("save");
              return;
            }
            try {
              const ext = selected.fileName?.match(/\.[^.]+$/)?.[0] || ".png";
              await saveCharacterAs(selected.filePath, `${selected.name}${ext}`);
              notify("已另存到酒馆 characters 目录");
            } catch (error) {
              notify(error instanceof Error ? error.message : "另存失败");
            }
          }}
          organized={organized}
          transition={cardTransition}
        />
      )}

      {flight && <CoverFlight flight={flight} />}

      {modal === "import" && <ImportModal close={() => setModal(null)} addDemoImport={addDemoImport} setPendingImport={setPendingImport} />}
      {modal === "connection" && <ConnectionModal candidates={candidates} selected={selectedTavern} close={() => setModal(null)} onSelect={async candidate => {
        try {
          setStatus("正在切换酒馆路径");
          const picked = await selectTavern(candidate.path);
          const cards = await listCharacters(picked.path);
          const connected = { ...picked, characterCount: cards.length };
          setSelectedTavern(connected);
          setStatus(tavernStatus(connected));
          setCharacters(normalizeCards(cards));
          setSelectedId("");
          setPendingImport(null);
          setTab("全部角色");
          notify(`已使用该酒馆路径，读取到 ${cards.length} 张角色卡`);
          setModal(null);
        } catch (error) {
          setStatus(selectedTavern ? tavernStatus(selectedTavern) : "切换酒馆路径失败");
          notify(error instanceof Error ? error.message : "切换酒馆路径失败");
        }
      }} />}
      {modal === "delete" && selected && <ConfirmModal title="删除角色卡" close={() => setModal(null)} confirm={() => {
        setCharacters(list => list.filter(card => card.id !== selected.id));
        setSelectedId("");
        setModal(null);
        notify("已从角色馆移除");
      }}>确认从角色馆移除“{selected.name}”？不会触碰你的 SillyTavern 文件。</ConfirmModal>}
      {modal === "save" && selected && <ConfirmModal title="另存为" close={() => setModal(null)} confirm={() => { setModal(null); notify("已模拟另存为"); }}>将以“{selected.name}.png”另存一份角色卡文件。</ConfirmModal>}
      {toast && <div className="toast fixed right-5 bottom-5 z-[80] border border-[rgba(244,201,121,.28)] bg-[#120b09]/90 px-4 py-3 text-[#ffe4a7] backdrop-blur">{toast}</div>}
    </div>
  );
}

function Topbar({ status, query, setQuery, openImport, openConnection }: {
  status: string;
  query: string;
  setQuery: (value: string) => void;
  openImport: () => void;
  openConnection: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 glass border-b border-[var(--line)] grid grid-cols-1 lg:grid-cols-[auto_minmax(220px,480px)_auto] gap-3 items-center px-4 md:px-7 py-3">
      <div className="flex gap-3 items-center">
        <div className="w-9 h-9 grid place-items-center border border-[rgba(244,201,121,.46)] text-[var(--gold)] rotate-45"><span className="-rotate-45">酒</span></div>
        <div>
          <div className="font-display text-2xl tracking-[.06em]">酒馆角色馆</div>
          <div className="text-xs text-[var(--muted)] tracking-[.18em] uppercase">Character Gallery</div>
        </div>
      </div>
      <label className="h-10 flex items-center gap-2 px-3 border border-[var(--line)] bg-white/[.045]">
        <Search size={16} className="text-[var(--muted)]" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索角色名、标签、气质" className="w-full bg-transparent outline-none text-[var(--paper)] placeholder:text-white/35" />
      </label>
      <div className="flex flex-wrap lg:justify-end gap-2">
        <button onClick={openConnection} className="h-9 px-3 inline-flex gap-2 items-center border border-[rgba(106,179,156,.35)] text-[#bdebdc] bg-[rgba(106,179,156,.08)]"><span className="w-2 h-2 rounded-full bg-[#74e5b8] shadow-[0_0_18px_#74e5b8]" />{status}</button>
        <button onClick={openImport} className="h-9 px-3 inline-flex gap-2 items-center border border-[rgba(244,201,121,.42)] text-[#ffe2a5] bg-[rgba(244,201,121,.12)]"><Download size={15} />导入角色卡</button>
        <button onClick={openConnection} className="h-9 w-9 grid place-items-center border border-[var(--line)] bg-white/[.04]"><Settings size={16} /></button>
      </div>
    </header>
  );
}

function PosterCard({ card, index, onOpen, onFavorite }: { card: CharacterCard; index: number; onOpen: (event: React.MouseEvent<HTMLElement>) => void; onFavorite: () => void }) {
  const cover = card.cover || covers[index % covers.length];
  const imageSrc = coverImageSrc(cover);
  return (
    <article onClick={onOpen} className={`breathing-frame poster-shell relative overflow-hidden border bg-[#130d0c] shadow-2xl isolate group aspect-[2/3] min-h-[260px] ${card.staged ? "border-[rgba(244,201,121,.44)]" : "border-white/15"}`}>
      {card.staged && <div className="absolute top-3 left-3 z-10 px-3 py-1 border border-[rgba(244,201,121,.34)] bg-[rgba(244,201,121,.08)] text-[#ffe4a7] text-xs tracking-[.16em]">待导入</div>}
      {imageSrc ? (
        <img className="poster-cover poster-image absolute inset-0 transition duration-700 group-hover:scale-105" src={imageSrc} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className="poster-cover absolute inset-0 transition duration-700 group-hover:scale-105" style={coverStyle(cover)} />
      )}
      <button onClick={event => { event.stopPropagation(); onFavorite(); }} className={`absolute ${card.staged ? "top-14" : "top-3"} right-3 z-20 w-9 h-9 grid place-items-center border border-white/20 bg-black/25 backdrop-blur text-[#ffd98a]`}>
        {card.favorite ? <Star size={16} fill="currentColor" /> : <Star size={16} />}
      </button>
      <div className="absolute z-10 left-3 right-3 top-3 opacity-0 group-hover:opacity-100 transition flex flex-wrap gap-1">
        <span className="text-xs px-2 py-1 border border-white/15 bg-black/30 backdrop-blur">{card.imported ? "已导入" : "待导入"}</span>
        <span className="text-xs px-2 py-1 border border-white/15 bg-black/30 backdrop-blur">{card.recent}</span>
        {(card.tags || []).slice(0, 3).map(tag => <span key={tag} className="text-xs px-2 py-1 border border-white/15 bg-black/30 backdrop-blur">{tag}</span>)}
      </div>
      <div className="absolute left-0 right-0 bottom-0 z-10 p-4 pt-20 bg-gradient-to-t from-black/90 to-transparent">
        <div className="font-display text-[clamp(22px,2vw,30px)] leading-none">{card.name}</div>
      </div>
    </article>
  );
}

function initialVisibleCount() {
  if (typeof window === "undefined") return 24;
  return window.innerWidth < 768 ? 12 : 36;
}

function coverImageSrc(cover: string) {
  if (/^data:image\//i.test(cover) || /^https?:\/\//i.test(cover) || cover.startsWith("/")) return cover;
  return "";
}

function CoverFlight({ flight }: { flight: FlightState }) {
  return (
    <div
      className="cover-flight breathing-frame"
      style={{
        ["--from-x" as string]: `${flight.from.x}px`,
        ["--from-y" as string]: `${flight.from.y}px`,
        ["--from-w" as string]: `${flight.from.width}px`,
        ["--from-h" as string]: `${flight.from.height}px`,
        ["--to-x" as string]: `${flight.to.x}px`,
        ["--to-y" as string]: `${flight.to.y}px`,
        ["--to-w" as string]: `${flight.to.width}px`,
        ["--to-h" as string]: `${flight.to.height}px`,
        ...coverStyle(flight.card.cover || covers[0])
      }}
    >
      <div className="cover-flight-name">{flight.card.name}</div>
    </div>
  );
}

function coverStyle(cover: string): React.CSSProperties {
  const isImageUrl = /^data:image\//i.test(cover) || /^https?:\/\//i.test(cover) || cover.startsWith("/");
  const isImageCover = isImageUrl || /url\(/i.test(cover);
  const imageValue = isImageUrl ? `url("${cover}")` : /url\(/i.test(cover) ? cover : "";
  return {
    ...(isImageCover
      ? {
          backgroundImage: imageValue,
          backgroundColor: "#100908",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover"
        }
      : {
          background: cover,
          backgroundColor: "#100908",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover"
        })
  };
}

function RandomDrawPanel({ cards, onOpen }: { cards: CharacterCard[]; onOpen: (card: CharacterCard) => void }) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [drawn, setDrawn] = useState<CharacterCard | null>(null);
  const [drawing, setDrawing] = useState(false);
  const pool = cards.length ? cards : [stagedDemo];
  const preview = pool[Math.min(previewIndex, pool.length - 1)] || stagedDemo;

  useEffect(() => {
    setPreviewIndex(0);
  }, [cards.length]);

  function draw() {
    if (!pool.length || drawing) return;
    const nextIndex = pool.length > 1
      ? (previewIndex + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
      : 0;
    const card = pool[nextIndex];
    setPreviewIndex(nextIndex);
    setDrawn(card);
    setDrawing(true);
    window.setTimeout(() => setDrawing(false), 1850);
  }

  function enterCard() {
    if (!drawn) return;
    setDrawn(null);
    setDrawing(false);
    onOpen(drawn);
  }

  return (
    <>
      <aside className="random-draw-panel">
        <div className="random-draw-bg" style={coverStyle(preview.cover || covers[previewIndex % covers.length])} />
        <div className="random-draw-scrim" />
        <div className="random-draw-copy">
          <span>RANDOM ENCOUNTER</span>
          <strong>随机邂逅</strong>
          <p>从已导入角色卡里抽一张，像从卡匣深处翻出一封迟到的邀请。</p>
        </div>
        <button type="button" onClick={draw} className="random-draw-button" disabled={drawing}>
          {drawing ? "抽取中" : "抽取"}
        </button>
      </aside>

      {drawn && (
        <div className={`draw-reveal ${drawing ? "is-drawing" : "is-ready"}`}>
          <div className="draw-confetti" aria-hidden="true">
            {Array.from({ length: 28 }, (_, index) => (
              <i
                key={index}
                style={{
                  ["--r" as string]: `${index * 31}deg`,
                  ["--x" as string]: `${(index - 13.5) * 15}px`,
                  ["--y" as string]: `${-150 - (index % 7) * 24}px`,
                  ["--h" as string]: `${(index * 29) % 360}`,
                  ["--d" as string]: `${(index % 5) * 34}ms`
                }}
              />
            ))}
          </div>
          <button type="button" className="draw-reveal-card breathing-frame" onClick={enterCard}>
            <div className="draw-reveal-cover" style={coverStyle(drawn.cover || covers[0])} />
            <div className="draw-reveal-copy">
              <span>抽取结果</span>
              <strong>{drawn.name || "未命名角色"}</strong>
              <small>点击查看角色信息</small>
            </div>
          </button>
        </div>
      )}
    </>
  );
}

function HeroShowcase({ cards, total, pending }: { cards: CharacterCard[]; total: number; pending: number }) {
  const [active, setActive] = useState(0);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const safeCards = cards.length ? cards : [stagedDemo];
  const normalizedActive = safeCards.length ? active % safeCards.length : 0;
  const visibleCards = Array.from({ length: Math.min(safeCards.length, 8) }, (_, offset) => {
    const cardIndex = (normalizedActive + offset) % safeCards.length;
    return { item: safeCards[cardIndex], cardIndex, offset };
  });

  useEffect(() => {
    setActive(0);
  }, [cards]);

  useEffect(() => {
    if (safeCards.length <= 1) return;
    const timer = window.setInterval(() => move(1), 2400);
    return () => window.clearInterval(timer);
  }, [safeCards.length]);

  function move(direction: -1 | 1) {
    setActive(value => {
      const next = value + direction;
      if (next < 0) return safeCards.length - 1;
      if (next >= safeCards.length) return 0;
      return next;
    });
  }

  function handlePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    setDragStart(null);
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 32) {
      const forward = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;
      move(forward ? 1 : -1);
    }
  }

  return (
    <aside className="hero-showcase">
      <div
        className="hero-stack"
        style={{ ["--stack-count" as string]: safeCards.length }}
        onPointerLeave={() => setDragStart(null)}
        onPointerDown={event => {
          setDragStart({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={handlePointerEnd}
        onPointerCancel={() => setDragStart(null)}
      >
        {visibleCards.map(({ item, cardIndex, offset }) => {
          const visibleOffset = Math.min(offset, 4);
          return (
            <button
              key={`${item.id}-${cardIndex}`}
              className={`hero-stack-card ${offset === 0 ? "is-active" : ""}`}
              style={{ ["--i" as string]: visibleOffset, zIndex: 20 - visibleOffset }}
              onClick={() => offset === 0 ? move(1) : setActive(cardIndex)}
              type="button"
              aria-label={`切换到 ${item.name || "未命名角色"}`}
            >
              <span className="hero-stack-glow" />
              <div className="hero-showcase-cover" style={coverStyle(item.cover || covers[cardIndex % covers.length])} />
              <div className="hero-showcase-copy">
                <span>{offset === 0 ? "当前卡匣" : `卡片 ${cardIndex + 1}`}</span>
                <strong>{item.name || "未命名角色"}</strong>
              </div>
            </button>
          );
        })}
      </div>
      <div className="hero-showcase-side">
        <div>
          <span>ALL</span>
          <strong>{total}</strong>
        </div>
        <div>
          <span>WAIT</span>
          <strong>{pending}</strong>
        </div>
      </div>
    </aside>
  );
}

function DetailDrawer(props: {
  card: CharacterCard;
  activeModule: DetailModule;
  setActiveModule: (section: DetailModule) => void;
  onClose: () => void;
  onImport: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onSave: () => void;
  organized: OrganizedCharacter;
  transition: boolean;
}) {
  return (
    <aside className={`detail-drawer fixed inset-0 z-40 w-screen bg-[#0e0807] backdrop-blur-xl overflow-auto ${props.transition ? "is-entering" : ""}`}>
      <div className="detail-layout grid xl:grid-cols-[360px_1fr] min-h-full max-w-[1900px] mx-auto">
        <div className="detail-side p-6 border-r border-[var(--line)] bg-black/20">
          <div className={`breathing-frame detail-cover aspect-[2/3] border border-white/15 shadow-2xl transition-transform duration-500 ${props.transition ? "scale-[.98] translate-y-[-2px]" : "scale-100"}`} style={coverStyle(props.card.cover || covers[0])} />
          <h2 className="font-display text-4xl mt-5">{props.card.name}</h2>
          <p className="text-[var(--muted)]">{props.card.subtitle}</p>
          <div className="flex flex-wrap gap-1 mt-3">{(props.card.tags || []).map(tag => <span key={tag} className="text-xs px-2 py-1 border border-white/15 bg-black/25">{tag}</span>)}</div>
          <nav className="detail-nav grid gap-2 mt-6">
            {moduleTabs.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) props.setActiveModule(item.id);
                }}
                disabled={item.disabled}
                className={`text-left p-3 border inline-flex items-center gap-2 ${item.disabled ? "nav-disabled line-through text-white/28 border-transparent cursor-not-allowed" : props.activeModule === item.id ? "text-[var(--gold)] bg-[rgba(244,201,121,.08)] border-[rgba(244,201,121,.24)]" : "text-[var(--muted)] border-transparent"}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button onClick={props.onFavorite} className="h-10 border border-[var(--line)] inline-flex gap-2 items-center justify-center"><Heart size={15} />{props.card.favorite ? "取消收藏" : "加入收藏"}</button>
            <button onClick={props.onSave} className="h-10 border border-[var(--line)]">另存为</button>
            <button onClick={props.onDelete} className="h-10 col-span-2 border border-[rgba(207,111,103,.36)] text-[#ffc9c9] bg-[rgba(207,111,103,.08)] inline-flex gap-2 items-center justify-center"><Trash2 size={15} />删除</button>
          </div>
        </div>
        <div className="detail-main p-5 md:p-10">
          <div className="detail-actions flex flex-wrap justify-between gap-3 mb-8">
            <button onClick={props.onClose} className="h-10 px-4 border border-[var(--line)]">返回封面墙</button>
            <div className="flex gap-2 items-center">
              <span className={`text-sm px-3 py-2 border ${props.card.staged ? "text-[#ffe4a7] border-[rgba(244,201,121,.24)] bg-[rgba(244,201,121,.08)]" : "text-[#bdebdc] border-[rgba(106,179,156,.28)] bg-[rgba(106,179,156,.08)]"}`}>{props.card.staged ? "预览中 · 尚未进酒馆" : "已在酒馆"}</span>
              <button onClick={props.onImport} className="h-10 px-5 border border-[rgba(244,201,121,.42)] text-[#ffe2a5] bg-[rgba(244,201,121,.12)]">{props.card.imported ? "重新导入酒馆" : "导入酒馆"}</button>
            </div>
          </div>

          {props.card.detailLoading && (
            <div className="mb-5 border border-[rgba(244,201,121,.22)] bg-[rgba(244,201,121,.07)] px-4 py-3 text-sm text-[#ffe2a5]">
              正在读取这张角色卡的完整信息，封面墙不会被它卡住。
            </div>
          )}
          {props.card.detailError && (
            <div className="mb-5 border border-[rgba(207,111,103,.34)] bg-[rgba(207,111,103,.08)] px-4 py-3 text-sm text-[#ffc9c9]">
              {props.card.detailError}
            </div>
          )}

          {props.activeModule === "overview" && (
            <OverviewPanel card={props.card} organized={props.organized} />
          )}

          {props.activeModule === "greetings" && <GreetingsPanel items={props.organized.greetings} />}
          {props.activeModule === "world" && <WorldPanel entries={props.organized.worldEntries} />}
          {props.activeModule === "regex" && <RegexPanel rules={props.organized.regexRules} />}
          {props.activeModule === "versions" && <VersionPanel versions={props.organized.versions} />}
        </div>
      </div>
    </aside>
  );
}

function OverviewPanel({ card, organized }: { card: CharacterCard; organized: OrganizedCharacter }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <CollapsibleBlock title="角色摘要" subtitle={card.name} bodyClassName="max-h-[520px] overflow-auto">
          <h3 className="font-display text-3xl">{card.name}</h3>
          <p className="text-white/65 mt-3 leading-8 whitespace-pre-wrap">{card.description || "没有摘要"}</p>
        </CollapsibleBlock>
        <CollapsibleBlock title="结构总览" subtitle="解析内容计数" defaultOpen>
          <div className="grid gap-2 text-sm text-white/75">
            <div>开场白 {organized.greetings.length} 条</div>
            <div>世界书 {organized.worldEntries.length} 条</div>
            <div>正则 {organized.regexRules.length} 条</div>
            <div>版本 {organized.versions.length} 份</div>
          </div>
        </CollapsibleBlock>
      </div>
      <InfoSection title="身份设定" fields={organized.identity} />
      <InfoSection title="行为与对话" fields={organized.behavior} />
      <InfoSection title="提示词" fields={organized.prompts} />
    </div>
  );
}

function InfoSection({ title, fields }: { title: string; fields: OrganizedCharacter["identity"] }) {
  if (!fields.length) return null;
  return (
    <CollapsibleBlock title={title} subtitle={`${fields.length} 项`} defaultOpen={title === "身份设定"}>
      <div className="detail-field-grid">
        {fields.map(field => (
          <DetailTextBlock key={field.label} label={field.label} value={field.value} long={field.long} />
        ))}
      </div>
    </CollapsibleBlock>
  );
}

function GreetingsPanel({ items }: { items: OrganizedGreeting[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => { setIndex(0); }, [items.length]);
  if (!items.length) {
    return <EmptyPanel title="开场白" text="这张卡没有可分拆的开场白。" />;
  }
  const current = items[index];
  return (
    <div className="space-y-5">
      <SectionHeader title="开场白" subtitle={`主开场 + ${Math.max(0, items.length - 1)} 条备用`} />
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <button key={item.id} onClick={() => setIndex(i)} className={`h-9 px-3 border ${index === i ? "border-[rgba(244,201,121,.4)] text-[#ffe2a5] bg-[rgba(244,201,121,.1)]" : "border-white/10 text-white/60 bg-white/[.03]"}`}>{item.label}</button>
        ))}
      </div>
      <CollapsibleBlock title={current.label} subtitle={`${current.text.length} 字`} defaultOpen>
        <div className="max-h-[min(62vh,720px)] overflow-auto pr-2">
          <p className="whitespace-pre-wrap text-[15px] leading-8 text-white/78">{current.text}</p>
        </div>
      </CollapsibleBlock>
    </div>
  );
}

function WorldPanel({ entries }: { entries: OrganizedWorldEntry[] }) {
  if (!entries.length) return <EmptyPanel title="世界书" text="没有拆出世界书条目。" />;
  return (
    <div className="space-y-5">
      <SectionHeader title="世界书" subtitle={`共 ${entries.length} 条条目`} />
      <div className="grid gap-4">
        {entries.map(entry => (
          <CollapsibleBlock
            key={entry.id}
            title={entry.title}
            subtitle={`${triggerLabel(entry.triggerMode)} · ${entry.enabled ? "启用" : "停用"}`}
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="meta-row">
                  <span>{triggerLabel(entry.triggerMode)}</span>
                  <span>{entry.enabled ? "启用" : "停用"}</span>
                  <span>顺序 {entry.insertionOrder ?? "默认"}</span>
                  <span>概率 {entry.probability ?? 100}%</span>
                  <span>深度 {entry.depth ?? "默认"}</span>
                  <span>扫描 {entry.scanDepth ?? "默认"}</span>
                </div>
                <div className="text-xs text-white/45">
                  <div>位置 {entry.position}</div>
                  <div>逻辑 {entry.logic}</div>
                </div>
              </div>
              {(entry.keys.length > 0 || entry.secondaryKeys.length > 0) && (
                <div className="world-keywords">
                  {entry.keys.length > 0 && (
                    <div>
                      <span>触发关键词</span>
                      <div>
                        {entry.keys.map(key => <mark key={key}>{key}</mark>)}
                      </div>
                    </div>
                  )}
                  {entry.secondaryKeys.length > 0 && (
                    <div>
                      <span>附加关键词</span>
                      <div>
                        {entry.secondaryKeys.map(key => <mark key={key}>{key}</mark>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="max-h-[420px] overflow-auto pr-2">
                <p className="whitespace-pre-wrap text-sm leading-7 text-white/80">{entry.content || "无内容"}</p>
              </div>
            </div>
          </CollapsibleBlock>
        ))}
      </div>
    </div>
  );
}

function triggerLabel(mode: OrganizedWorldEntry["triggerMode"]) {
  if (mode === "always") return "始终触发";
  if (mode === "vector") return "向量触发";
  if (mode === "regex") return "正则触发";
  return "关键词触发";
}

function RegexPanel({ rules }: { rules: OrganizedRegexRule[] }) {
  if (!rules.length) return <EmptyPanel title="正则" text="没有拆出正则规则。" />;
  return (
    <div className="space-y-5">
      <SectionHeader title="正则" subtitle={`共 ${rules.length} 条规则`} />
      <div className="grid gap-4">
        {rules.map(rule => (
          <CollapsibleBlock key={rule.id} title={rule.name} subtitle={rule.enabled ? "启用" : "停用"}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="meta-row">
                  <span>范围 {rule.scope.join(" / ") || "默认"}</span>
                  <span>深度 {rule.minDepth ?? "默认"} - {rule.maxDepth ?? "默认"}</span>
                  <span>{rule.enabled ? "启用" : "停用"}</span>
                </div>
                <div className="meta-row">
                  {rule.options.map(option => <span key={option}>{option}</span>)}
                </div>
              </div>
              <div className="detail-field-grid">
                <DetailTextBlock label="正则表达式" value={rule.pattern} mono />
                <DetailTextBlock label="替换内容" value={rule.replacement} mono />
              </div>
            </div>
          </CollapsibleBlock>
        ))}
      </div>
    </div>
  );
}

function VersionPanel({ versions }: { versions: OrganizedCharacter["versions"] }) {
  if (!versions.length) return <EmptyPanel title="版本" text="没有版本历史。" />;
  return (
    <div className="space-y-5">
      <SectionHeader title="版本历史" subtitle={`共 ${versions.length} 份快照`} />
      <div className="relative pl-8">
        <div className="absolute left-3 top-3 bottom-3 w-px bg-white/10" />
        <div className="grid gap-4">
          {versions.map((version, index) => (
            <article key={version.id} className={`version-row relative ${version.current ? "is-current" : ""}`}>
              <div className="absolute left-[-29px] top-6 h-3.5 w-3.5 rounded-full border-2 border-[#a45eff] bg-[#a45eff]" />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display text-2xl">{version.version}</h4>
                    {version.current && <span className="text-xs px-2 py-1 border border-[rgba(164,94,255,.3)] bg-[rgba(164,94,255,.14)] text-[#e0ccff]">当前使用</span>}
                  </div>
                  <p className="mt-2 text-sm text-white/72">{version.note}</p>
                </div>
                <span className="text-xs text-white/45">{version.createdAt || "未记录时间"}</span>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                {!version.current && <button className="h-9 px-3 border border-white/10 bg-transparent">使用此版本</button>}
                {!version.current && <button className="h-9 w-9 grid place-items-center border border-white/10 bg-transparent"><Trash2 size={15} /></button>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="space-y-1">
      <h3 className="font-display text-3xl">{title}</h3>
      <p className="text-sm text-white/48">{subtitle}</p>
    </header>
  );
}

function DetailTextBlock({ label, value, mono = false, long = false }: { label: string; value: string; mono?: boolean; long?: boolean }) {
  return (
    <div className={`detail-text-block ${long ? "is-long" : ""}`}>
      <div className="text-xs tracking-[.18em] text-white/35 mb-3">{label}</div>
      <div className="detail-text-body pr-2">
        <p className={`whitespace-pre-wrap leading-7 text-white/78 ${mono ? "font-mono text-[13px]" : "text-sm"}`}>{value || "无"}</p>
      </div>
    </div>
  );
}

function CollapsibleBlock({ title, subtitle, children, defaultOpen = false, bodyClassName = "" }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="collapsible-block">
      <button onClick={() => setOpen(value => !value)} className="collapsible-head">
        <div className="min-w-0">
          <h4 className="font-display text-2xl truncate">{title}</h4>
          {subtitle ? <p className="mt-1 text-xs text-white/45">{subtitle}</p> : null}
        </div>
        <ChevronDown size={18} className={`shrink-0 text-white/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className={`collapsible-body ${bodyClassName}`}>{children}</div> : null}
    </section>
  );
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-dashed border-white/10 bg-white/[.02] p-8">
      <h3 className="font-display text-3xl">{title}</h3>
      <p className="mt-3 text-white/55">{text}</p>
    </div>
  );
}

function ImportModal({
  close,
  addDemoImport,
  setPendingImport
}: {
  close: () => void;
  addDemoImport: (card?: CharacterCard) => void;
  setPendingImport: (card: CharacterCard | null) => void;
}) {
  const [error, setError] = useState("");

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setError("");
    try {
      const parsedCard = await parseLocalCardFile(file);
      setPendingImport(parsedCard);
      addDemoImport(parsedCard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析失败");
    }
  }

  return (
    <ModalBox title="导入角色卡" close={close}>
      <label
        onDragOver={event => event.preventDefault()}
        onDrop={event => {
          event.preventDefault();
          handleFiles(event.dataTransfer.files);
        }}
        className="w-full min-h-[220px] border border-dashed border-[rgba(244,201,121,.42)] bg-[rgba(244,201,121,.05)] grid place-items-center text-center text-white/70 cursor-pointer"
      >
        <input type="file" accept=".json,.png,.webp,application/json,image/png,image/webp" className="hidden" onChange={event => handleFiles(event.target.files)} />
        <span>
          拖入 PNG / JSON 角色卡
          <br />
          <span className="text-[var(--muted)]">也可以点击这里选择文件。解析成功后会直接进入待导入封面墙。</span>
          {error && (
            <span className="block mt-5 border border-[rgba(207,111,103,.42)] bg-[rgba(207,111,103,.10)] px-4 py-3 text-[#ffc9c9]">
              {error}
            </span>
          )}
        </span>
      </label>
    </ModalBox>
  );
}

function ConnectionModal({ candidates, selected, close, onSelect }: { candidates: TavernCandidate[]; selected: TavernCandidate | null; close: () => void; onSelect: (candidate: TavernCandidate) => void }) {
  const rows = candidates.length ? candidates : selected ? [selected] : [];
  return (
    <ModalBox title="酒馆连接" close={close}>
      <div className="grid gap-3">
        {rows.map(candidate => {
          const isSelected = selected?.path === candidate.path;
          return (
            <div key={candidate.path} className={`connection-row grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center border-b border-[var(--line)] py-3 ${isSelected ? "is-selected" : ""}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="break-all">{candidate.path}</div>
                  {isSelected && <span className="connection-current">已使用</span>}
                </div>
                <div className="text-sm text-[var(--muted)]">可信度 {candidate.score} · 角色 {candidate.characterCount}{candidate.isBackupLike ? " · 疑似备份" : ""}</div>
              </div>
              <button
                onClick={() => !isSelected && onSelect(candidate)}
                disabled={isSelected}
                className={`h-10 px-4 border ${isSelected ? "border-[rgba(106,179,156,.38)] text-[#bdebdc] bg-[rgba(106,179,156,.08)] cursor-default" : "border-[rgba(244,201,121,.42)] text-[#ffe2a5]"}`}
              >
                {isSelected ? "已使用" : "使用"}
              </button>
            </div>
          );
        })}
        {!candidates.length && !selected && <p className="text-white/70 leading-8">没有扫描到 SillyTavern。</p>}
      </div>
    </ModalBox>
  );
}

function ConfirmModal({ title, children, close, confirm }: { title: string; children: React.ReactNode; close: () => void; confirm: () => void }) {
  return (
    <ModalBox title={title} close={close}>
      <p className="text-white/70 leading-8">{children}</p>
      <div className="flex justify-end gap-2 mt-5">
        <button onClick={close} className="h-10 px-4 border border-[var(--line)]">取消</button>
        <button onClick={confirm} className="h-10 px-4 border border-[rgba(244,201,121,.42)] text-[#ffe2a5] bg-[rgba(244,201,121,.12)]">确认</button>
      </div>
    </ModalBox>
  );
}

function ModalBox({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 backdrop-blur" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="modal-panel w-[min(920px,calc(100vw-32px))] max-h-[calc(100vh-42px)] overflow-auto border border-white/15 bg-[#120b09] shadow-2xl">
        <div className="modal-header p-6 flex justify-between gap-4 border-b border-[var(--line)]">
          <h2 className="font-display text-4xl">{title}</h2>
          <button onClick={close} className="w-10 h-10 grid place-items-center border border-[var(--line)]"><X size={18} /></button>
        </div>
        <div className="modal-body p-6">{children}</div>
      </div>
    </div>
  );
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fileToText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function fileToArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function decodePngCard(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  let offset = 8;
  const decoder = new TextDecoder();
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd > bytes.length) break;
    if (type === "tEXt") {
      const payload = bytes.slice(dataStart, dataEnd);
      const separator = payload.indexOf(0);
      if (separator > 0) {
        const keyword = decoder.decode(payload.slice(0, separator));
        if (["ccv3", "chara", "data"].includes(keyword)) {
          const text = decoder.decode(payload.slice(separator + 1)).trim();
          const candidates = keyword === "ccv3" ? [text, decodeBase64Utf8(text)] : [decodeBase64Utf8(text), text];
          for (const candidate of candidates) {
            try {
              return JSON.parse(candidate);
            } catch {
              continue;
            }
          }
        }
      }
    }
    offset = dataEnd + 4;
  }
  return null;
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder("utf-8").decode(bytes);
}

function tryParseLooseCard(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    try {
      return JSON.parse(decodeBase64Utf8(trimmed));
    } catch {
      return null;
    }
  }
}

async function parseLocalCardFile(file: File): Promise<CharacterCard> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  const dataUrl = await fileToDataUrl(file);
  const contentBase64 = dataUrl.split(",")[1] || "";
  if (ext === "json") {
    const raw = JSON.parse(await fileToText(file));
    const data = raw.data || raw;
    return {
      ...data,
      id: `local-${Date.now()}`,
      name: data.name || file.name.replace(/\.json$/i, "") || "未命名角色",
      subtitle: data.creator || data.character_version || "SillyTavern 角色卡",
      imported: false,
      staged: true,
      recent: "刚刚解析",
      favorite: false,
      fileName: file.name,
      importBlob: { fileName: file.name, contentBase64 },
      tags: Array.isArray(data.tags) ? ["待导入", ...data.tags] : ["待导入"],
      cover: data.avatar || stagedDemo.cover,
      regex_scripts: data.regex_scripts,
      regex_rules: data.regex_rules,
      versions: data.versions,
      version_history: data.version_history,
      data,
    };
  }
  if (ext === "png" || ext === "webp") {
    const parsed = ext === "png" ? decodePngCard(await fileToArrayBuffer(file)) : tryParseLooseCard(await fileToText(file));
    const data = parsed?.data || parsed || {};
    return {
      id: `local-${Date.now()}`,
      name: data.name || file.name.replace(/\.(png|webp)$/i, "") || "未命名角色",
      subtitle: data.creator || data.character_version || "SillyTavern 角色卡",
      imported: false,
      staged: true,
      recent: "刚刚解析",
      favorite: false,
      fileName: file.name,
      importBlob: { fileName: file.name, contentBase64 },
      tags: Array.isArray(data.tags) ? ["待导入", ...data.tags] : ["待导入"],
      cover: dataUrl,
      description: data.description || "已读取图片角色卡封面。",
      personality: data.personality,
      scenario: data.scenario,
      first_mes: data.first_mes,
      mes_example: data.mes_example,
      creator_notes: data.creator_notes,
      alternate_greetings: data.alternate_greetings,
      character_book: data.character_book,
      extensions: data.extensions,
      system_prompt: data.system_prompt,
      post_history_instructions: data.post_history_instructions,
      creator: data.creator,
      character_version: data.character_version,
      talkativeness: data.talkativeness,
      depth_prompt: data.depth_prompt,
      regex_scripts: data.regex_scripts,
      regex_rules: data.regex_rules,
      versions: data.versions,
      version_history: data.version_history,
      data,
    };
  }
  throw new Error("暂只支持 JSON / PNG / WEBP 角色卡。");
}

createRoot(document.getElementById("root")!).render(<App />);
