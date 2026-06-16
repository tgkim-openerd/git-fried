// Sprint c40 god comp 분리 — CommitGraph.vue (737 LOC) 의 canvas 렌더링
// (drawGraph + palette + laneColor + WIP pseudo-row) 외부화.
//
// 책임:
//   - 8 stable color palette + laneColor(lane)
//   - drawGraph: virtualizer 의 visible row 만 canvas 에 그리기
//     (lane crossings / parent edges / node circle / WIP dashed circle + connector)
//   - DPI 스케일 + setTransform + clearRect
//
// 사용:
//   const { drawGraph, laneColor } = useGraphCanvasRenderer({
//     canvasRef, containerRef, virtualItems, rows, laneW, graphWidth, wipActive,
//     rowHeight: ROW_H,
//   })
//
// LOC 절감: CommitGraph 138-273 (~135 LOC) → ~10 LOC destructure.
import { onScopeDispose } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { VirtualItem } from '@tanstack/vue-virtual'
import type { GraphRow } from '@/api/git'

// A-20 — colorblind 대응 lane 팔레트.
// 기존 8색은 green/emerald · amber/yellow · sky/cyan 3쌍이 같은 색조라
// deuteranopia/protanopia 에서 인접 lane 구분 불가. 색조가 겹치지 않는 8색으로 교체
// (blue / amber / green / magenta / cyan / red / purple / slate — 모두 별개 hue,
//  light·dark 양쪽에서 mid-luminance 가독).
const PALETTE = [
  '#2563eb', // blue
  '#f59e0b', // amber
  '#16a34a', // green
  '#db2777', // magenta
  '#06b6d4', // cyan
  '#dc2626', // red
  '#9333ea', // purple
  '#64748b', // slate
]

export interface UseGraphCanvasRendererOptions {
  canvasRef: Ref<HTMLCanvasElement | null>
  containerRef: Ref<HTMLDivElement | null>
  virtualItems: ComputedRef<VirtualItem[]>
  rows: Ref<GraphRow[]> | ComputedRef<GraphRow[]>
  laneW: Ref<number> | ComputedRef<number>
  graphWidth: Ref<number> | ComputedRef<number>
  wipActive: Ref<boolean> | ComputedRef<boolean>
  rowHeight: number
}

export function useGraphCanvasRenderer(opts: UseGraphCanvasRendererOptions) {
  function laneColor(lane: number): string {
    return PALETTE[lane % PALETTE.length]
  }

  function isWipIdx(idx: number): boolean {
    return opts.wipActive.value && idx === 0
  }

  function drawGraph() {
    const c = opts.canvasRef.value
    const container = opts.containerRef.value
    if (!c || !container) return

    const dpi = window.devicePixelRatio || 1
    const w = opts.graphWidth.value
    const h = container.clientHeight
    // plan #45 M3 — backing-store(c.width/height) 할당은 캔버스 전체를 reset 하는 비싼 realloc.
    // 매 scroll 프레임마다 재할당하던 것을 크기 변동 시에만 수행 (clearRect 는 아래서 항상).
    const pw = Math.round(w * dpi)
    const ph = Math.round(h * dpi)
    if (c.width !== pw) c.width = pw
    if (c.height !== ph) c.height = ph
    c.style.width = `${w}px`
    c.style.height = `${h}px`
    // headless 환경 (jsdom 등) 에서 getContext('2d') 가 null 반환 가능 — silent return.
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const scrollTop = container.scrollTop
    const ROW_H = opts.rowHeight

    for (const v of opts.virtualItems.value) {
      const idx = v.index
      const y = v.start - scrollTop + ROW_H / 2
      const lw = opts.laneW.value

      // WIP pseudo-row (idx=0 + wipActive). lane 0 (HEAD) dashed circle.
      if (isWipIdx(idx)) {
        const cxWip = lw / 2
        ctx.strokeStyle = laneColor(0)
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 2])
        ctx.beginPath()
        ctx.arc(cxWip, y, 3.5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        const firstCommit = opts.rows.value[0]
        if (firstCommit) {
          const nextY = v.start - scrollTop + ROW_H + ROW_H / 2
          const toX = firstCommit.lane * lw + lw / 2
          ctx.strokeStyle = laneColor(firstCommit.lane)
          ctx.lineWidth = 1.5
          ctx.setLineDash([3, 2])
          ctx.beginPath()
          if (firstCommit.lane === 0) {
            ctx.moveTo(cxWip, y)
            ctx.lineTo(toX, nextY)
          } else {
            ctx.moveTo(cxWip, y)
            ctx.bezierCurveTo(cxWip, y + ROW_H / 2, toX, nextY - ROW_H / 2, toX, nextY)
          }
          ctx.stroke()
          ctx.setLineDash([])
        }
        continue
      }

      // 일반 commit row — wipActive 시 idx-1 이 rows index.
      const rowIdx = opts.wipActive.value ? idx - 1 : idx
      const row = opts.rows.value[rowIdx]
      if (!row) continue

      // 1. crossing lanes — vertical line
      for (const lane of row.crossingLanes) {
        const x = lane * lw + lw / 2
        ctx.strokeStyle = laneColor(lane)
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(x, v.start - scrollTop)
        ctx.lineTo(x, v.start - scrollTop + ROW_H)
        ctx.stroke()
      }

      // 2. parent edges (curve to next row's parent_lane)
      const nextRow = opts.rows.value[rowIdx + 1]
      if (nextRow) {
        const nextY = v.start - scrollTop + ROW_H + ROW_H / 2
        const fromX = row.lane * lw + lw / 2
        for (const pl of row.parentLanes) {
          const toX = pl * lw + lw / 2
          ctx.strokeStyle = laneColor(pl)
          ctx.lineWidth = 1.5
          ctx.beginPath()
          if (pl === row.lane) {
            ctx.moveTo(fromX, y)
            ctx.lineTo(toX, nextY)
          } else {
            ctx.moveTo(fromX, y)
            ctx.bezierCurveTo(fromX, y + ROW_H / 2, toX, nextY - ROW_H / 2, toX, nextY)
          }
          ctx.stroke()
        }
      }

      // 3. node circle (이 commit 의 lane) — Sprint c51 type-별 시각 구분 (GitKraken parity).
      //   - 일반 commit: filled 3.5px
      //   - merge: filled 4.5px + 어두운 outer stroke + 흰 inner dot 1.5px (donut)
      //   - tag (refs/tags/ 또는 tag: prefix): violet outer ring radius 6
      //   - signed (GPG): green outer ring (tag 와 동시면 한 단계 더 바깥)
      const cx = row.lane * lw + lw / 2
      const isTag = row.commit.refs.some((r) => r.startsWith('refs/tags/') || r.startsWith('tag: '))
      const isSigned = row.commit.signed

      // base filled circle
      ctx.fillStyle = laneColor(row.lane)
      ctx.beginPath()
      ctx.arc(cx, y, row.isMerge ? 4.5 : 3.5, 0, Math.PI * 2)
      ctx.fill()

      // merge: dark outer stroke + 흰 inner dot (donut)
      if (row.isMerge) {
        ctx.strokeStyle = '#0a0a0a'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, y, 4.5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(cx, y, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // tag: violet outer ring
      if (isTag) {
        ctx.strokeStyle = '#a78bfa'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(cx, y, 6, 0, Math.PI * 2)
        ctx.stroke()
      }

      // signed: green outer ring (tag 와 동시 시 한 단계 더 바깥)
      if (isSigned) {
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(cx, y, isTag ? 7.5 : 5.5, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  // plan #45 M3 — scroll/reactive 트리거의 draw 를 requestAnimationFrame 으로 coalesce
  // (프레임당 1회). 매 scroll 이벤트마다 동기 draw 하던 것을 합쳐 perf 개선. drawGraph 는
  // 동기 즉시 draw 로 유지 (강제 초기 draw / 테스트용).
  let rafId: number | null = null
  function scheduleDraw() {
    if (rafId != null) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      drawGraph()
    })
  }
  onScopeDispose(() => {
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  return {
    drawGraph,
    scheduleDraw,
    laneColor,
    isWipIdx,
  }
}
