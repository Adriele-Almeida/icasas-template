import type { PosterDraft } from "@/lib/draft"
import { iconById } from "@/lib/icon-catalog"
import {
  LAYOUT,
  POSTER_H,
  POSTER_W,
  slotRect,
  sourceWindow,
  type PhotoSlot,
} from "@/lib/poster-geom"

const ORANGE = "#e67126"
const CREAM = "#f3f0ea"
const SILVER_TOP = "#f7f4ef"
const SILVER_MID = "#d4d0c8"
const SILVER_BOT = "#a9a49c"

const iconCache = new Map<string, HTMLImageElement>()

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function up(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR")
}

function font(weight: number, size: number, family: string) {
  return `${weight} ${size}px ${family}`
}

function iconImage(id: string, size: number, redraw: () => void, color = ORANGE) {
  const key = `${id}:${size}:${color}`
  let image = iconCache.get(key)
  if (!image) {
    const icon = iconById(id)
    const body = icon.nodes
      .map((node) => {
        const attrs = Object.entries(node.attrs)
          .map(([name, value]) => `${name}="${value.replace(/"/g, "")}"`)
          .join(" ")
        return `<${node.tag} ${attrs}/>`
      })
      .join("")
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
    image = new Image()
    image.onload = () => redraw()
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    iconCache.set(key, image)
  }
  return image.complete && image.naturalWidth > 0 ? image : null
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slot: PhotoSlot,
  draft: PosterDraft,
) {
  const rect = slotRect(slot)
  const window = sourceWindow(draft.adjust[slot], image.naturalWidth, image.naturalHeight, rect)
  ctx.save()
  if (slot === "hero") {
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
  } else {
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, LAYOUT.photoR)
    ctx.clip()
  }
  ctx.drawImage(image, window.sx, window.sy, window.sw, window.sh, rect.x, rect.y, rect.w, rect.h)
  ctx.restore()
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = ORANGE
  ctx.beginPath()
  ctx.moveTo(0, size * 0.46)
  ctx.bezierCurveTo(-size * 0.48, 0.02 * size, -size * 0.4, -size * 0.46, 0, -size * 0.46)
  ctx.bezierCurveTo(size * 0.4, -size * 0.46, size * 0.48, 0.02 * size, 0, size * 0.46)
  ctx.fill()
  ctx.fillStyle = "#1a100c"
  ctx.beginPath()
  ctx.arc(0, -size * 0.14, size * 0.13, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function metal(ctx: CanvasRenderingContext2D, y: number, size: number) {
  const gradient = ctx.createLinearGradient(0, y, 0, y + size)
  gradient.addColorStop(0, SILVER_TOP)
  gradient.addColorStop(0.42, SILVER_MID)
  gradient.addColorStop(1, SILVER_BOT)
  return gradient
}

function measureTitle(ctx: CanvasRenderingContext2D, text: string, size: number) {
  ctx.font = font(700, size, '"Cormorant Garamond"')
  ctx.letterSpacing = "1.4px"
  return ctx.measureText(text).width
}

function layoutTitle(ctx: CanvasRenderingContext2D, title: string, accent: string, maxW: number) {
  const words = title.split(/\s+/).filter(Boolean)
  for (let size = 56; size >= 28; size -= 1) {
    const gap = accent ? size * 0.22 : 0
    const accentW = accent ? measureTitle(ctx, accent, size) : 0
    const extra = accent ? gap + accentW : 0
    if (!words.length) return { lines: [] as string[], size, accentOnOwnLine: false }
    const full = words.join(" ")
    if (measureTitle(ctx, full, size) + extra <= maxW) {
      return { lines: [full], size, accentOnOwnLine: false }
    }
    let best: { lines: [string, string]; score: number } | null = null
    for (let split = 1; split < words.length; split += 1) {
      const first = words.slice(0, split).join(" ")
      const second = words.slice(split).join(" ")
      const firstW = measureTitle(ctx, first, size)
      const secondW = measureTitle(ctx, second, size) + extra
      if (firstW > maxW || secondW > maxW) continue
      const score = Math.abs(firstW - secondW)
      if (!best || score < best.score) best = { lines: [first, second], score }
    }
    if (best) return { lines: best.lines, size, accentOnOwnLine: false }
    if (measureTitle(ctx, full, size) <= maxW && (!accent || accentW <= maxW)) {
      return { lines: [full], size, accentOnOwnLine: Boolean(accent) }
    }
  }
  return { lines: words.length ? [words.join(" ")] : [], size: 28, accentOnOwnLine: Boolean(accent) }
}

function drawCard(ctx: CanvasRenderingContext2D, draft: PosterDraft) {
  const card = LAYOUT.card
  const padX = 36
  const left = card.x + padX
  const right = card.x + card.w - padX
  const maxW = right - left
  const title = up(draft.title)
  const accent = up(draft.accent)
  const laid = layoutTitle(ctx, title, accent, maxW)
  const size = laid.size
  ctx.letterSpacing = "1.4px"
  ctx.textBaseline = "top"
  ctx.textAlign = "left"
  ctx.shadowColor = "rgba(0,0,0,0.72)"
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 3
  let y = card.y + 28
  laid.lines.forEach((line, index) => {
    ctx.font = font(700, size, '"Cormorant Garamond"')
    ctx.fillStyle = metal(ctx, y, size)
    ctx.fillText(line, left, y)
    const last = index === laid.lines.length - 1
    if (last && accent && !laid.accentOnOwnLine) {
      const gap = size * 0.22
      const accentX = left + ctx.measureText(line).width + gap
      ctx.shadowColor = "rgba(0,0,0,0.45)"
      ctx.fillStyle = ORANGE
      ctx.fillText(accent, accentX, y)
    }
    y += size * 0.92
  })
  if (accent && laid.accentOnOwnLine) {
    ctx.font = font(700, size, '"Cormorant Garamond"')
    ctx.fillStyle = ORANGE
    ctx.fillText(accent, left, y)
    y += size * 0.92
  }
  ctx.letterSpacing = "0px"
  ctx.shadowOffsetY = 0
  ctx.shadowColor = "transparent"
  const subtitle = draft.subtitle.trim()
  if (subtitle) {
    y += 6
    ctx.font = font(500, 22, "Outfit")
    ctx.fillStyle = CREAM
    ctx.fillText(subtitle, left, y, maxW)
  }

  const note = up(draft.priceNote)
  const price = draft.price.trim()
  ctx.font = font(700, 36, "Outfit")
  const priceW = Math.min(ctx.measureText(price || "R$").width, 280)
  const pillW = Math.max(210, priceW + 48)
  const pillH = 62
  const pillX = right - pillW
  const noteH = note ? 26 : 0
  const pillY = card.y + card.h - 28 - noteH - pillH
  if (price) {
    ctx.save()
    roundRect(ctx, pillX, pillY, pillW, pillH, 16)
    ctx.fillStyle = "#0d0d0f"
    ctx.fill()
    ctx.shadowColor = "rgba(230,113,38,0.8)"
    ctx.shadowBlur = 16
    ctx.lineWidth = 2
    ctx.strokeStyle = ORANGE
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = ORANGE
    ctx.font = font(700, 36, "Outfit")
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(price, pillX + pillW / 2, pillY + pillH / 2 + 1, pillW - 28)
    ctx.restore()
  }
  if (note) {
    ctx.font = font(500, 15, "Outfit")
    ctx.fillStyle = CREAM
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.letterSpacing = "1.6px"
    ctx.fillText(note, pillX + pillW / 2, pillY + pillH + 8, pillW + 20)
    ctx.letterSpacing = "0px"
  }

  const place1 = up(draft.place1)
  const place2 = up(draft.place2)
  const lines = [place1, place2].filter(Boolean)
  if (lines.length) {
    const blockH = lines.length * 22
    const blockY = pillY + pillH / 2 - blockH / 2
    drawPin(ctx, left + 12, blockY + blockH / 2, 30)
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    ctx.font = font(500, 17, "Outfit")
    ctx.fillStyle = CREAM
    ctx.letterSpacing = "0.8px"
    lines.forEach((line, index) => {
      ctx.fillText(line, left + 34, blockY + index * 22, pillX - left - 48)
    })
    ctx.letterSpacing = "0px"
  }
}

function drawSpecs(ctx: CanvasRenderingContext2D, draft: PosterDraft, redraw: () => void) {
  const visible = draft.specs.filter((spec) => spec.icon || spec.label.trim())
  if (!visible.length) return
  const count = visible.length
  const col = POSTER_W / count
  const iconSize = count >= 7 ? 26 : 34
  const iconY = LAYOUT.specsY + (count >= 7 ? 14 : 22)
  const labelMax = count >= 7 ? 14 : 18
  const labelMin = count >= 7 ? 10 : 12
  visible.forEach((spec, index) => {
    const cx = col * index + col / 2
    const image = spec.icon ? iconImage(spec.icon, 72, redraw) : null
    if (image) ctx.drawImage(image, cx - iconSize / 2, iconY, iconSize, iconSize)
    const label = spec.label.trim()
    if (label) {
      ctx.fillStyle = CREAM
      ctx.textAlign = "center"
      ctx.textBaseline = "top"
      let labelSize = labelMax
      ctx.font = font(500, labelSize, "Outfit")
      while (labelSize > labelMin && ctx.measureText(label).width > col - 12) {
        labelSize -= 1
        ctx.font = font(500, labelSize, "Outfit")
      }
      const labelY = image ? iconY + iconSize + 10 : iconY + iconSize / 2 - labelSize / 2
      ctx.fillText(label, cx, labelY, col - 16)
    }
    if (index > 0) {
      const x = col * index
      ctx.strokeStyle = ORANGE
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, iconY + 2)
      ctx.lineTo(x, iconY + iconSize - 2)
      ctx.stroke()
    }
  })
}

export function renderPoster(
  ctx: CanvasRenderingContext2D,
  draft: PosterDraft,
  images: Partial<Record<PhotoSlot, HTMLImageElement | null>>,
  fundo: HTMLImageElement | null,
  redraw: () => void,
) {
  ctx.clearRect(0, 0, POSTER_W, POSTER_H)
  ctx.fillStyle = "#070708"
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)

  const hero = images.hero
  if (hero && hero.complete && hero.naturalWidth) drawCover(ctx, hero, "hero", draft)
  const left = images.left
  const right = images.right
  if (left && left.complete && left.naturalWidth) drawCover(ctx, left, "left", draft)
  if (right && right.complete && right.naturalWidth) drawCover(ctx, right, "right", draft)

  if (fundo && fundo.complete && fundo.naturalWidth) {
    ctx.drawImage(fundo, 0, 0, POSTER_W, POSTER_H)
  }

  const hole = (slot: PhotoSlot, label: string) => {
    const image = images[slot]
    if (image && image.complete && image.naturalWidth) return
    const rect = slotRect(slot)
    ctx.fillStyle = "#8a847b"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = font(500, slot === "hero" ? 22 : 18, "Outfit")
    ctx.fillText(label, rect.x + rect.w * (slot === "hero" ? 0.68 : 0.5), rect.y + rect.h * (slot === "hero" ? 0.46 : 0.5))
  }
  hole("hero", "Foto de cima")
  hole("left", "Foto da esquerda")
  hole("right", "Foto da direita")

  drawCard(ctx, draft)
  drawSpecs(ctx, draft, redraw)
}
