/**
 * おえかき画面（DESINGN.md 19章、ux-by-age.md 2.6、architecture.md 7章）。
 * 上の帯: おうち・さくひん・いまの道具の大きな表示 ／ 保存状態・がぞう。
 * 道具欄（利き手の設定で左右）: 道具の札 ＋ 道具ごとの設定（色・太さ・はんこの見本 等）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../app/AppState';
import { navigate } from '../app/router';
import { audio } from '../core/audio/index';
import * as db from '../core/storage/index';
import { Illust } from '../illust/Illust';
import { hasVoice } from '../voice/catalog/index';
import { AutoSaver, type SaveState } from './autosave';
import { CanvasView, type Gesture, type ViewRect } from './CanvasView';
import { DrawingEngine } from './engine';
import { itemBounds, shapePathD, type Pt } from './geometry';
import { DrawIcon, ShapeIcon, type DrawIconId } from './icons';
import { placeCards } from './layout';
import { DOC_H, DOC_W, clampCenter, emptyDoc, newId, type ObjItem } from './model';
import {
  SHAPE_NAMES,
  ShapePanel,
  StampAdjust,
  StampPanel,
  StampPreview,
  type ShapeChoice,
  type StampChoice,
} from './panels';
import {
  SaveBook,
  findUnfinished,
  markSaved,
  openArtwork,
  prepareSave,
  quickSave,
  renderPreview,
  type ArtMeta,
} from './persist';
import { SelectionOverlay } from './SelectionOverlay';
import { assetKey, getStamp, svgUrl } from './stamps';
import {
  ERASER_SCALE,
  NUDGE,
  STAMP_SIZES,
  SHAPE_STROKES,
  defaultShapeSize,
  palette,
  scaled,
  widths,
  type ToolMode,
} from './tools';
import { colorVoiceKey } from './voice';
import './drawing.css';

type Tool = 'pen' | 'eraser' | 'fill' | 'stamp' | 'shape' | 'select';

const TOOL_INFO: Record<Tool, { label: string; state: string; icon: DrawIconId | 'eraser' }> = {
  pen: { label: 'ペン', state: 'かく', icon: 'pen' },
  eraser: { label: 'けしゴム', state: 'けす', icon: 'eraser' },
  fill: { label: 'ぬる', state: 'ぬる', icon: 'bucket' },
  stamp: { label: 'はんこ', state: 'おす', icon: 'stamp' },
  shape: { label: 'ずけい', state: 'おく', icon: 'shapes' },
  select: { label: 'うごかす', state: 'うごかす', icon: 'move' },
};

type Hand = 'right' | 'left';
const handKey = (pid: string) => `mnw:draw:hand:${pid}`;
function readHand(pid: string): Hand {
  try {
    return localStorage.getItem(handKey(pid)) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
}

interface Session {
  engine: DrawingEngine;
  meta: ArtMeta;
  saver: AutoSaver;
  book: SaveBook;
}

interface Anim {
  key: string;
  item: ObjItem;
}

function testEnabled(): boolean {
  try {
    return localStorage.getItem('mnw:test') === '1';
  } catch {
    return false;
  }
}

declare global {
  interface Window {
    __mnwDraw?: { engine: DrawingEngine; saver: AutoSaver; meta: ArtMeta };
  }
}

export function DrawingScreen({ artId }: { artId?: string }) {
  const app = useApp();
  const profile = app.profile;
  const settings = app.settings;
  const [session, setSession] = useState<Session | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [missing, setMissing] = useState(false);

  // ---- 作品を開く／新しく作る
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    let made: Session | null = null;
    void (async () => {
      let engine: DrawingEngine;
      let meta: ArtMeta;
      let known: number | null = null;
      let dirty = false;
      const book = new SaveBook();
      // 'new' = 「あたらしく」（つくりかけを探さない）
      const wantNew = artId === 'new';
      if (!artId) {
        const unfinished = app.storageUnavailable ? null : await findUnfinished(profile.id);
        if (!alive) return;
        if (unfinished) {
          navigate({ name: 'draw', artId: unfinished }, { replace: true, force: true });
          return;
        }
      }
      const opened = artId && !wantNew ? await openArtwork(artId) : null;
      if (!alive) return;
      if (opened && opened.meta.profileId === profile.id) {
        engine = opened.engine;
        meta = opened.meta;
        known = opened.updatedAt;
        dirty = opened.dirty;
        book.markAllPersisted(engine);
      } else {
        if (artId && !wantNew) setMissing(true);
        engine = new DrawingEngine(emptyDoc());
        meta = {
          id: crypto.randomUUID(),
          profileId: profile.id,
          title: 'おえかき',
          createdAt: Date.now(),
        };
      }
      const saver = new AutoSaver(
        {
          now: () => Date.now(),
          setTimer: (fn, ms) => window.setTimeout(fn, ms),
          clearTimer: (h) => window.clearTimeout(h as number),
          rev: () => engine.rev,
          prepare: () => prepareSave(engine, meta, book),
          preview: () => renderPreview(engine),
          quick: (p) => quickSave(engine, meta, book, p),
          write: (rec, blobs, opts) =>
            app.storageUnavailable
              ? Promise.resolve('error' as const)
              : db.saveArtworkChecked(rec, blobs, opts),
          onSaved: (p) => {
            if (p) markSaved(book, p);
          },
          onFirstSave: () => void db.requestPersist(),
          onState: (s) => {
            if (alive) setSaveState(s);
          },
        },
        { knownUpdatedAt: known, savedRev: engine.rev },
      );
      made = { engine, meta, saver, book };
      setSession(made);
      if (dirty) {
        // 「つくりかけ」で開いた: 画像をそろえて保存し直す（ダーティ印を消す）
        engine.rev++;
        saver.touch();
      }
      if (testEnabled()) window.__mnwDraw = { engine, saver, meta };
    })();
    return () => {
      alive = false;
      if (made) {
        void made.saver.flush();
        made.saver.dispose();
      }
    };
    // 開く作品が変わったときだけ作り直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artId, profile?.id]);

  // ---- ページを閉じる・隠れるとき（JSON とダーティ印だけ）
  useEffect(() => {
    if (!session) return;
    const hide = () => session.saver.pageHide();
    const vis = () => {
      if (document.visibilityState === 'hidden') hide();
    };
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [session]);

  if (!profile || !settings) return null;
  if (!session) return <div className="screen draw-loading" data-testid="draw-loading" />;
  return (
    <DrawingBoard
      key={session.meta.id}
      session={session}
      saveState={saveState}
      missing={missing}
      mode={settings.support.drawingTools}
      toddler={profile.audience === 'toddler'}
      profileId={profile.id}
      sfx={settings.sfx}
      reduceMotion={app.reduceMotion}
    />
  );
}

function DrawingBoard({
  session,
  saveState,
  missing,
  mode,
  toddler,
  profileId,
  sfx,
  reduceMotion,
}: {
  session: Session;
  saveState: SaveState;
  missing: boolean;
  mode: ToolMode;
  toddler: boolean;
  profileId: string;
  sfx: boolean;
  reduceMotion: boolean;
}) {
  const { engine, saver } = session;
  const detailed = mode === 'detailed';
  const rootRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const [view, setView] = useState<ViewRect>({ left: 0, top: 0, width: 1, height: 1 });
  const [uPx, setUPx] = useState(10);
  const [rootSize, setRootSize] = useState({ w: 1000, h: 562 });
  const colors = useMemo(() => palette(mode, toddler), [mode, toddler]);
  const ws = useMemo(() => widths(mode, toddler), [mode, toddler]);
  const [tool, setTool] = useState<Tool>('pen');
  const [colorId, setColorId] = useState(colors[0]!.id);
  const [widthIdx, setWidthIdx] = useState(Math.min(1, ws.length - 1));
  const [eraserIdx, setEraserIdx] = useState(Math.min(1, ws.length - 1));
  const [stamp, setStamp] = useState<StampChoice>({
    id: 'rabbit',
    sizeIdx: 1,
    rotation: 0,
    flipX: false,
  });
  const [category, setCategory] = useState('animal');
  const [shape, setShape] = useState<ShapeChoice>({
    kind: 'circle',
    filled: false,
    strokeIdx: 1,
    colorId: colors[0]!.id,
  });
  const [panel, setPanel] = useState<'stamp' | 'shape' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hand, setHand] = useState<Hand>(() => readHand(profileId));
  const [anims, setAnims] = useState<Anim[]>([]);
  const cycle = useRef<{ id: string; at: Pt } | null>(null);

  const color = colors.find((c) => c.id === colorId) ?? colors[0]!;
  const selected = engine.getObject(selectedId);

  // 基盤の変化で描き直す
  useEffect(() => engine.subscribe(() => setTick((t) => t + 1)), [engine]);
  // 選んでいた物が消えた（undo・消しゴム）
  const selectedGone = selectedId !== null && !selected;
  useEffect(() => {
    if (selectedGone) setSelectedId(null);
  }, [selectedGone]);

  // 1u の大きさ（舞台の幅の 1/100）と画面の大きさ
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      const r = root.getBoundingClientRect();
      setUPx(r.width / 100);
      setRootSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // 消しゴム: かんたん は触れた物を消す（短い音と縮む演出）、くわしく は選んで けす札（review-1 #3）
  useEffect(() => {
    engine.eraserObjects = detailed ? 'select' : 'delete';
    engine.onErased = (it) => {
      audio.sfx('remove');
      if (!reduceMotion) {
        const key = `${it.id}-${performance.now()}`;
        setAnims((a) => [...a, { key, item: it }]);
        window.setTimeout(() => setAnims((a) => a.filter((x) => x.key !== key)), 360);
      }
    };
    engine.onEraserTouch = (it) => setSelectedId(it.id);
    return () => {
      engine.onErased = null;
      engine.onEraserTouch = null;
    };
  }, [engine, detailed, reduceMotion]);

  const touchSave = useCallback(() => saver.touch(), [saver]);
  const uLogical = (uPx * DOC_W) / Math.max(1, view.width);

  const chooseTool = (t: Tool) => {
    audio.sfx('tap');
    if (t !== 'select') setSelectedId(null);
    setTool(t);
    if (t === 'stamp') setPanel('stamp');
    else if (t === 'shape') setPanel('shape');
    else setPanel(null);
  };

  const sayColor = (id: string) => {
    const key = colorVoiceKey(id);
    // 効果音の設定に従う（review-1 #27）。音声が未登録の色は鳴らさない
    if (sfx && hasVoice(key)) void audio.play(key);
    else audio.sfx('tap');
  };

  const placeStamp = (p: Pt) => {
    const def = getStamp(stamp.id);
    if (!def) return;
    const c = clampCenter(p.x, p.y);
    const key = assetKey(def);
    engine.addObject(
      {
        id: newId('S'),
        kind: 'stamp',
        asset: key,
        x: c.x,
        y: c.y,
        size: STAMP_SIZES[stamp.sizeIdx]!,
        rotation: stamp.rotation,
        flipX: stamp.flipX,
      },
      { key, svg: def.svg },
    );
    audio.sfx('place');
    touchSave();
  };

  const placeShape = (p: Pt) => {
    const c = clampCenter(p.x, p.y);
    const { w, h } = defaultShapeSize(shape.kind);
    const sc = colors.find((x) => x.id === shape.colorId) ?? colors[0]!;
    const sw = SHAPE_STROKES[shape.strokeIdx]!;
    engine.addObject({
      id: newId('H'),
      kind: 'shape',
      shape: shape.kind,
      x: c.x,
      y: c.y,
      w,
      h: shape.kind === 'line' ? sw * 2 : h,
      rotation: 0,
      stroke: sc.hex,
      strokeWidth: sw,
      fill: shape.filled && shape.kind !== 'line' ? sc.hex : null,
    });
    audio.sfx('place');
    touchSave();
  };

  const onPointerDown = (p: Pt): Gesture | null => {
    if (panel) setPanel(null);
    switch (tool) {
      case 'pen':
      case 'eraser': {
        const width = tool === 'pen' ? ws[widthIdx]! : ws[eraserIdx]! * ERASER_SCALE;
        engine.beginStroke(tool, p, { color: color.hex, width });
        return {
          move: (pts) => engine.extendStroke(pts),
          end: () => {
            engine.endStroke();
            touchSave();
          },
        };
      }
      case 'fill':
        if (engine.fill(p, color.hex)) {
          audio.sfx('place');
          touchSave();
        }
        return null;
      case 'stamp':
        placeStamp(p);
        return null;
      case 'shape':
        placeShape(p);
        return null;
      case 'select': {
        const hit = engine.pick(p, uLogical, detailed ? cycle.current : null);
        if (!hit) {
          // 選択中に空いた所をタップ → そこへ移動（review-1 #11）
          const sel = engine.getObject(selectedId);
          if (sel) {
            const c = clampCenter(p.x, p.y);
            engine.updateObject('move', { ...sel, x: c.x, y: c.y });
            audio.sfx('place');
            touchSave();
          }
          return null;
        }
        cycle.current = { id: hit.id, at: p };
        setSelectedId(hit.id);
        audio.sfx('tap');
        const prevItems = engine.items;
        const orig = hit;
        let moved = false;
        engine.beginFocus(hit.id);
        return {
          move: (pts) => {
            const q = pts[pts.length - 1]!;
            if (!moved && Math.hypot(q.x - p.x, q.y - p.y) < uLogical) return;
            moved = true;
            const c = clampCenter(orig.x + q.x - p.x, orig.y + q.y - p.y);
            engine.preview({ ...orig, x: c.x, y: c.y });
          },
          end: () => {
            engine.endFocus();
            if (moved) {
              engine.commitItems('move', prevItems, engine.items);
              touchSave();
            }
          },
        };
      }
    }
  };

  // ---- 選択中の操作
  const act = (a: string) => {
    const it = engine.getObject(selectedId);
    if (!it) return;
    audio.sfx('tap');
    switch (a) {
      case 'bigger':
      case 'smaller': {
        const up = a === 'bigger';
        engine.updateObject(
          'resize',
          it.kind === 'stamp'
            ? { ...it, size: scaled(it.size, up) }
            : { ...it, w: scaled(it.w, up), h: it.shape === 'line' ? it.h : scaled(it.h, up) },
        );
        break;
      }
      case 'rotate':
        engine.updateObject('rotate', { ...it, rotation: (it.rotation + 45) % 360 });
        break;
      case 'flip':
        if (it.kind === 'stamp') engine.updateObject('flip', { ...it, flipX: !it.flipX });
        break;
      case 'front':
        engine.zMove(it.id, 'forward');
        break;
      case 'back':
        engine.zMove(it.id, 'backward');
        break;
      case 'delete':
        engine.removeObject(it.id);
        audio.sfx('remove');
        setSelectedId(null);
        break;
      case 'done':
        setSelectedId(null);
        return;
      case 'up':
      case 'down':
      case 'left':
      case 'right': {
        const dx = a === 'left' ? -NUDGE : a === 'right' ? NUDGE : 0;
        const dy = a === 'up' ? -NUDGE : a === 'down' ? NUDGE : 0;
        const c = clampCenter(it.x + dx, it.y + dy);
        engine.updateObject('move', { ...it, x: c.x, y: c.y });
        break;
      }
    }
    touchSave();
  };

  const leave = async (to: () => void) => {
    if (engine.drawing) engine.endStroke();
    if (!engine.isEmpty || engine.history.canUndo) await saver.flush();
    to();
  };

  const startNew = () => {
    audio.sfx('tap');
    void leave(() => {
      if (engine.isEmpty) return;
      navigate({ name: 'draw', artId: 'new' }, { force: true });
    });
  };

  const exportPng = async () => {
    audio.sfx('tap');
    const blob = await engine.exportPng();
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const a = document.createElement('a');
    a.href = url;
    a.download = `oekaki-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const swapHand = () => {
    const next: Hand = hand === 'right' ? 'left' : 'right';
    setHand(next);
    try {
      localStorage.setItem(handKey(profileId), next);
    } catch {
      /* 保存できなくても今回は切り替わる */
    }
  };

  // ---- 選択中の操作札の置き場所（枠の下 → 上 → 道具欄）
  const actions: { id: string; label: string; icon: React.ReactNode }[] = [];
  if (selected) {
    const ic = (id: DrawIconId) => <DrawIcon id={id} className="tap__icon" />;
    actions.push({ id: 'bigger', label: 'おおきく', icon: ic('bigger') });
    actions.push({ id: 'smaller', label: 'ちいさく', icon: ic('smaller') });
    actions.push({
      id: 'rotate',
      label: 'まわす',
      icon: <Illust id="rotate" className="tap__icon" decorative />,
    });
    if (selected.kind === 'stamp')
      actions.push({ id: 'flip', label: 'はんてん', icon: ic('flip') });
    if (detailed) {
      actions.push({ id: 'front', label: 'てまえへ', icon: ic('front') });
      actions.push({ id: 'back', label: 'おくへ', icon: ic('back') });
    }
    actions.push({ id: 'delete', label: 'けす', icon: ic('trash') });
    actions.push({
      id: 'done',
      label: 'おわり',
      icon: <Illust id="done" className="tap__icon" decorative />,
    });
  }
  const cardPx = (detailed ? 5.5 : 6) * uPx;
  const gapPx = 1.6 * uPx;
  let placement: ReturnType<typeof placeCards> | null = null;
  if (selected) {
    const b = itemBounds(selected);
    const s = view.width / DOC_W;
    const rowW = actions.length * cardPx + (actions.length - 1) * gapPx + 2 * uPx;
    placement = placeCards({
      // 枠の外側の余白（1.5u）とハンドル（半径 2.75u、回転のハンドルは上に 5u）を避ける
      box: {
        x0: view.left + b.x0 * s - 4.25 * uPx,
        y0: view.top + b.y0 * s - 9.25 * uPx,
        x1: view.left + b.x1 * s + 4.25 * uPx,
        y1: view.top + b.y1 * s + 4.25 * uPx,
      },
      rowW,
      rowH: cardPx + 1.6 * uPx,
      gap: 1.2 * uPx,
      area: { x0: 2 * uPx, y0: 8 * uPx, x1: rootSize.w - 2 * uPx, y1: rootSize.h - 2 * uPx },
    });
  }
  const actionCards = (
    <>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          className={`tap tap--white draw-act ${detailed ? 'tap--aux' : ''}`}
          aria-label={a.label}
          data-testid={`act-${a.id}`}
          onClick={() => act(a.id)}
        >
          {a.icon}
        </button>
      ))}
    </>
  );

  const info = TOOL_INFO[tool];
  const toolIcon = (t: Tool) =>
    TOOL_INFO[t].icon === 'eraser' ? (
      <Illust id="eraser" className="tap__icon" decorative />
    ) : (
      <DrawIcon id={TOOL_INFO[t].icon as DrawIconId} className="tap__icon" />
    );

  const sidePanel = (
    <div className={`draw-side ${detailed ? 'draw-side--detailed' : ''}`} data-testid="draw-side">
      <div className="draw-tools" role="toolbar" aria-label="どうぐ">
        {(['pen', 'eraser', 'fill', 'stamp', 'shape', 'select'] as Tool[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`tap tap--wood draw-tool ${tool === t ? 'is-selected' : ''}`}
            aria-label={TOOL_INFO[t].label}
            aria-pressed={tool === t}
            data-testid={`tool-${t}`}
            onClick={() => chooseTool(t)}
          >
            {toolIcon(t)}
          </button>
        ))}
        <button
          type="button"
          className="tap tap--wood draw-tool"
          aria-label="もどす"
          data-testid="tool-undo"
          disabled={!engine.history.canUndo}
          onClick={() => {
            audio.sfx('tap');
            if (engine.undo()) touchSave();
          }}
        >
          <Illust id="undo" className="tap__icon" decorative />
        </button>
        <button
          type="button"
          className="tap tap--wood draw-tool"
          aria-label="すすむ"
          data-testid="tool-redo"
          disabled={!engine.history.canRedo}
          onClick={() => {
            audio.sfx('tap');
            if (engine.redo()) touchSave();
          }}
        >
          <DrawIcon id="redo" className="tap__icon" />
        </button>
        <button
          type="button"
          className="tap tap--wood draw-tool"
          aria-label="あたらしく"
          data-testid="tool-new"
          onClick={startNew}
        >
          <DrawIcon id="new" className="tap__icon" />
        </button>
      </div>
      <div className="draw-props" data-testid="draw-props">
        {tool === 'pen' || tool === 'fill' ? (
          <div className="draw-colors" role="radiogroup" aria-label="いろ">
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === colorId}
                className={`draw-color ${c.id === colorId ? 'is-selected' : ''}`}
                style={{ background: c.hex }}
                aria-label={c.name}
                data-testid={`color-${c.id}`}
                onClick={() => {
                  setColorId(c.id);
                  sayColor(c.id);
                }}
              />
            ))}
          </div>
        ) : null}
        {tool === 'pen' || tool === 'eraser' ? (
          <div className="draw-widths" role="radiogroup" aria-label="ふとさ">
            {ws.map((w, i) => {
              const sel = tool === 'pen' ? widthIdx : eraserIdx;
              const px = Math.min(1, ((tool === 'pen' ? w : w * ERASER_SCALE) * 1.4) / 100);
              return (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={sel === i}
                  className={`tap tap--white draw-width ${sel === i ? 'is-selected' : ''} ${detailed ? 'tap--aux' : ''}`}
                  aria-label={`ふとさ ${i + 1}`}
                  data-testid={`width-${i}`}
                  onClick={() => {
                    audio.sfx('tap');
                    if (tool === 'pen') setWidthIdx(i);
                    else setEraserIdx(i);
                  }}
                >
                  <span
                    className="draw-width__dot"
                    style={{
                      width: `${Math.max(12, px * 100)}%`,
                      height: `${Math.max(12, px * 100)}%`,
                      background: tool === 'pen' ? color.hex : undefined,
                    }}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
        {tool === 'stamp' ? (
          <div className="draw-prop-col">
            <button
              type="button"
              className="draw-preview-btn"
              aria-label="はんこを えらぶ"
              data-testid="open-stamp-panel"
              onClick={() => setPanel('stamp')}
            >
              <StampPreview choice={stamp} box={uPx * 12} />
            </button>
            <StampAdjust choice={stamp} onChange={setStamp} compact testPrefix="side-stamp" />
          </div>
        ) : null}
        {tool === 'shape' ? (
          <div className="draw-prop-col">
            <button
              type="button"
              className="draw-preview-btn"
              aria-label={`ずけいを えらぶ（${SHAPE_NAMES[shape.kind]}）`}
              data-testid="open-shape-panel"
              onClick={() => setPanel('shape')}
            >
              <ShapeIcon
                shape={shape.kind}
                filled={shape.filled}
                color={(colors.find((c) => c.id === shape.colorId) ?? colors[0]!).hex}
                className="draw-preview-shape"
              />
            </button>
          </div>
        ) : null}
        {tool === 'select' ? (
          <div className="draw-prop-col">
            {placement?.where === 'dock' ? (
              <div className="draw-dock" data-testid="draw-dock">
                {actionCards}
              </div>
            ) : null}
            {detailed && selected ? (
              <div className="draw-arrows" aria-label="やじるし">
                {(
                  [
                    ['up', 0],
                    ['left', -90],
                    ['right', 90],
                    ['down', 180],
                  ] as const
                ).map(([d, r]) => (
                  <button
                    key={d}
                    type="button"
                    className={`tap tap--white tap--aux draw-arrow draw-arrow--${d}`}
                    aria-label={
                      { up: 'うえへ', down: 'したへ', left: 'ひだりへ', right: 'みぎへ' }[d]
                    }
                    data-testid={`act-${d}`}
                    onClick={() => act(d)}
                  >
                    <DrawIcon id="arrow" rotate={r} className="tap__icon" />
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="tap tap--wood"
              aria-label="みつける"
              data-testid="act-find"
              onClick={() => {
                audio.sfx('tap');
                engine.bringInside();
                touchSave();
              }}
            >
              <Illust id="look" className="tap__icon" decorative />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  const s = view.width / DOC_W;
  return (
    <div
      ref={rootRef}
      className={`screen draw-screen draw-screen--${hand} draw-screen--${mode}`}
      data-testid="draw-screen"
      data-draw-root
      data-mode={mode}
      data-tool={tool}
      data-save-state={saveState}
      data-items={engine.items.length}
    >
      <header className="draw-top">
        <div className="draw-top__group">
          <button
            type="button"
            className="tap tap--wood tap--aux"
            aria-label="おうち"
            data-testid="home-button"
            onClick={() => void leave(() => navigate({ name: 'home' }))}
          >
            <Illust id="home" className="tap__icon" decorative />
          </button>
          <button
            type="button"
            className="tap tap--wood tap--aux"
            aria-label="さくひん"
            data-testid="gallery-button"
            onClick={() => void leave(() => navigate({ name: 'gallery' }))}
          >
            <Illust id="picture" className="tap__icon" decorative />
          </button>
          <div className="draw-state" data-testid="draw-state" aria-live="polite">
            {toolIcon(tool)}
            <span>{info.state}</span>
          </div>
        </div>
        <div className="draw-top__group">
          {saveState === 'conflict' ? (
            <p className="draw-conflict" data-testid="draw-conflict">
              べつの がめんで かいています
            </p>
          ) : null}
          <span className="draw-save" data-testid="save-indicator" data-state={saveState}>
            {saveState === 'pending' || saveState === 'saving' ? (
              <DrawIcon id="cloud" className="draw-save__icon" />
            ) : saveState === 'saved' ? (
              <DrawIcon id="check" className="draw-save__icon" />
            ) : saveState === 'error' || saveState === 'conflict' ? (
              <DrawIcon id="alert" className="draw-save__icon" />
            ) : null}
            <span className="visually-hidden">
              {
                {
                  clean: '',
                  pending: 'ほぞん まち',
                  saving: 'ほぞん ちゅう',
                  saved: 'ほぞん した',
                  error: 'ほぞん できない',
                  conflict: 'ほぞん できない',
                }[saveState]
              }
            </span>
          </span>
          <button
            type="button"
            className="tap tap--wood tap--aux"
            aria-label="どうぐを はんたいがわに"
            data-testid="swap-hand"
            onClick={swapHand}
          >
            <DrawIcon id="swap" className="tap__icon" />
          </button>
          <button
            type="button"
            className="tap tap--wood tap--aux"
            aria-label="がぞうに する"
            data-testid="export-png"
            onClick={() => void exportPng()}
          >
            <DrawIcon id="export" className="tap__icon" />
          </button>
        </div>
      </header>
      <div className="draw-body">
        {sidePanel}
        <CanvasView
          engine={engine}
          onPointerDown={onPointerDown}
          onLayout={setView}
          rootRef={rootRef}
          label="おえかきの かみ"
        />
      </div>
      {missing ? <span className="visually-hidden" data-testid="draw-missing" /> : null}
      {selected ? (
        <SelectionOverlay
          engine={engine}
          item={selected}
          view={view}
          uPx={uPx}
          onChanged={touchSave}
        />
      ) : null}
      {selected && placement && placement.where !== 'dock' ? (
        <div
          className="draw-cards"
          data-testid="draw-cards"
          data-where={placement.where}
          style={{ left: placement.x, top: placement.y }}
        >
          {actionCards}
        </div>
      ) : null}
      {anims.map((a) => (
        <ShrinkAnim key={a.key} item={a.item} doc={engine.doc} view={view} s={s} />
      ))}
      {panel === 'stamp' ? (
        <StampPanel
          choice={stamp}
          category={category}
          onCategory={(c) => {
            audio.sfx('tap');
            setCategory(c);
          }}
          onChange={(c) => {
            audio.sfx('tap');
            setStamp(c);
          }}
          onClose={() => {
            audio.sfx('tap');
            setPanel(null);
            setTool('stamp');
          }}
          boxPx={uPx * 12}
        />
      ) : null}
      {panel === 'shape' ? (
        <ShapePanel
          choice={shape}
          colors={colors}
          onChange={(c) => {
            if (c.colorId !== shape.colorId) sayColor(c.colorId);
            else audio.sfx('tap');
            setShape(c);
          }}
          onClose={() => {
            audio.sfx('tap');
            setPanel(null);
            setTool('shape');
          }}
        />
      ) : null}
    </div>
  );
}

/** 消しゴムで消えた物が縮んで消える演出（0.3秒） */
function ShrinkAnim({
  item,
  doc,
  view,
  s,
}: {
  item: ObjItem;
  doc: DrawingEngine['doc'];
  view: ViewRect;
  s: number;
}) {
  const w = (item.kind === 'stamp' ? item.size : item.w) * s;
  const h = (item.kind === 'stamp' ? item.size : item.h) * s;
  const style = {
    left: view.left + item.x * s - w / 2,
    top: view.top + item.y * s - h / 2,
    width: w,
    height: h,
    '--rot': `${item.rotation}deg`,
  } as React.CSSProperties;
  if (item.kind === 'stamp') {
    const svg = doc.assets[item.asset];
    return svg ? (
      <img
        className="draw-shrink"
        style={{ ...style, ['--flip' as string]: item.flipX ? -1 : 1 }}
        src={svgUrl(svg)}
        alt=""
        aria-hidden
      />
    ) : null;
  }
  const pad = item.strokeWidth;
  return (
    <svg
      className="draw-shrink"
      style={style}
      viewBox={`${-item.w / 2 - pad} ${-item.h / 2 - pad} ${item.w + pad * 2} ${item.h + pad * 2}`}
      aria-hidden
    >
      <path
        d={shapePathD(item.shape, item.w, item.h)}
        fill={item.fill ?? 'none'}
        stroke={item.stroke}
        strokeWidth={item.strokeWidth}
      />
    </svg>
  );
}

export { DOC_H, DOC_W };
