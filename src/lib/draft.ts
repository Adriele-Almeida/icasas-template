import type { Focus, PhotoSlot } from "@/lib/poster-geom"
import { ICON_CATALOG } from "@/lib/icon-catalog"

export type SpecItem = { icon: string; label: string }

export type PosterDraft = {
  title: string
  accent: string
  subtitle: string
  place1: string
  place2: string
  price: string
  priceNote: string
  cta: string
  phone: string
  instagram: string
  specs: SpecItem[]
  adjust: Record<PhotoSlot, Focus>
}

const focus = (): Focus => ({ zoom: 1, focusX: 0.5, focusY: 0.5 })

export const MAX_SPECS = 8

export const DEFAULT_DRAFT: PosterDraft = {
  title: "",
  accent: "",
  subtitle: "",
  place1: "",
  place2: "",
  price: "",
  priceNote: "",
  cta: "",
  phone: "(31) 99707-4170",
  instagram: "",
  specs: [],
  adjust: { hero: focus(), left: focus(), right: focus() },
}

function asFocus(value: unknown): Focus {
  const o = value && typeof value === "object" ? (value as Partial<Focus>) : {}
  return {
    zoom: typeof o.zoom === "number" && Number.isFinite(o.zoom) ? o.zoom : 1,
    focusX: typeof o.focusX === "number" && Number.isFinite(o.focusX) ? o.focusX : 0.5,
    focusY: typeof o.focusY === "number" && Number.isFinite(o.focusY) ? o.focusY : 0.5,
  }
}

function knownIcon(id: string) {
  return ICON_CATALOG.some((icon) => icon.id === id) ? id : ""
}

function asSpec(value: unknown): SpecItem | null {
  if (!value || typeof value !== "object") return null
  const raw = value as Partial<SpecItem>
  const icon = typeof raw.icon === "string" ? knownIcon(raw.icon) : ""
  const label = typeof raw.label === "string" ? raw.label : ""
  return { icon, label }
}

export function normalizeDraft(value: unknown): PosterDraft {
  const raw = value && typeof value === "object" ? (value as Partial<PosterDraft> & { title1?: unknown; title2?: unknown }) : {}
  const text = (key: keyof PosterDraft) => (typeof raw[key] === "string" ? raw[key] : "")
  const joined = [raw.title1, raw.title2].filter((part): part is string => typeof part === "string" && part.trim().length > 0)
  const title = typeof raw.title === "string" ? raw.title : joined.join(" ")
  const incoming = Array.isArray(raw.specs) ? raw.specs : []
  const specs = incoming
    .map(asSpec)
    .filter((item): item is SpecItem => item !== null)
    .slice(0, MAX_SPECS)
  const adjustIn =
    raw.adjust && typeof raw.adjust === "object" ? (raw.adjust as Partial<PosterDraft["adjust"]>) : {}
  return {
    title,
    accent: text("accent"),
    subtitle: text("subtitle"),
    place1: text("place1"),
    place2: text("place2"),
    price: text("price"),
    priceNote: text("priceNote"),
    cta: text("cta"),
    phone: typeof raw.phone === "string" ? raw.phone : DEFAULT_DRAFT.phone,
    instagram: text("instagram"),
    specs,
    adjust: {
      hero: asFocus(adjustIn.hero),
      left: asFocus(adjustIn.left),
      right: asFocus(adjustIn.right),
    },
  }
}