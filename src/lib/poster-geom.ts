export const POSTER_W = 1080
export const POSTER_H = 1440

export type Rect = { x: number; y: number; w: number; h: number }
export type PhotoSlot = "hero" | "left" | "right"

export type Focus = {
  zoom: number
  focusX: number
  focusY: number
}

export const LAYOUT = {
  card: { x: 39, y: 590, w: 778, h: 312, r: 26 },
  specsY: 924,
  specsH: 100,
  photoY: 1024,
  photoH: 296,
  photoMargin: 3,
  photoGap: 7,
  photoR: 16,
  footerY: 1322,
}

export function slotRect(slot: PhotoSlot): Rect {
  if (slot === "hero") return { x: 0, y: 0, w: POSTER_W, h: LAYOUT.photoY }
  const w = (POSTER_W - LAYOUT.photoMargin * 2 - LAYOUT.photoGap) / 2
  if (slot === "left") {
    return { x: LAYOUT.photoMargin, y: LAYOUT.photoY, w, h: LAYOUT.photoH }
  }
  return {
    x: LAYOUT.photoMargin + w + LAYOUT.photoGap,
    y: LAYOUT.photoY,
    w,
    h: LAYOUT.photoH,
  }
}

function contains(rect: Rect, x: number, y: number) {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h
}

export function hitSlot(x: number, y: number): PhotoSlot | null {
  if (contains(slotRect("left"), x, y)) return "left"
  if (contains(slotRect("right"), x, y)) return "right"
  if (contains(LAYOUT.card, x, y)) return null
  if (y >= LAYOUT.specsY) return null
  const scale = POSTER_W / 1500
  const ySrc = y / scale
  const xSrc = x / scale
  const edge = 908 - ySrc * 0.99 + 8
  if (ySrc < 330 && xSrc < edge) return null
  return "hero"
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function clampFocus(focus: Focus, imgW: number, imgH: number, rect: Rect): Focus {
  const zoom = clamp(focus.zoom, 1, 2.8)
  const scale = Math.max(rect.w / imgW, rect.h / imgH) * zoom
  const halfX = rect.w / scale / 2 / imgW
  const halfY = rect.h / scale / 2 / imgH
  return {
    zoom,
    focusX: halfX >= 0.5 ? 0.5 : clamp(focus.focusX, halfX, 1 - halfX),
    focusY: halfY >= 0.5 ? 0.5 : clamp(focus.focusY, halfY, 1 - halfY),
  }
}

export function shiftFocus(
  focus: Focus,
  imgW: number,
  imgH: number,
  rect: Rect,
  dx: number,
  dy: number,
): Focus {
  const scale = Math.max(rect.w / imgW, rect.h / imgH) * focus.zoom
  return clampFocus(
    {
      zoom: focus.zoom,
      focusX: focus.focusX - dx / scale / imgW,
      focusY: focus.focusY - dy / scale / imgH,
    },
    imgW,
    imgH,
    rect,
  )
}

export function sourceWindow(focus: Focus, imgW: number, imgH: number, rect: Rect) {
  const next = clampFocus(focus, imgW, imgH, rect)
  const scale = Math.max(rect.w / imgW, rect.h / imgH) * next.zoom
  const sw = rect.w / scale
  const sh = rect.h / scale
  return {
    sx: next.focusX * imgW - sw / 2,
    sy: next.focusY * imgH - sh / 2,
    sw,
    sh,
  }
}
