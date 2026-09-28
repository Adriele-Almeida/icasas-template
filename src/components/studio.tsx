import * as Dialog from "@radix-ui/react-dialog"
import { useEffect, useRef, useState } from "react"
import { Glyph } from "@/components/glyph"
import { DEFAULT_DRAFT, MAX_SPECS, type PosterDraft } from "@/lib/draft"
import { ICON_CATALOG, ICON_GROUPS } from "@/lib/icon-catalog"
import {
  EXPORT_H,
  EXPORT_W,
  hitSlot,
  POSTER_H,
  POSTER_W,
  shiftFocus,
  slotRect,
  type PhotoSlot,
} from "@/lib/poster-geom"
import { renderPoster } from "@/lib/render-poster"
import { loadDraft, loadPhotos, saveDraft, savePhotos, type PhotoMap } from "@/lib/storage"

const SLOTS: { id: PhotoSlot; title: string }[] = [
  { id: "hero", title: "Foto de cima" },
  { id: "left", title: "Foto da esquerda" },
  { id: "right", title: "Foto da direita" },
]

const FILENAME = "icasas-template-1080x1440.png"

function isEmbedded() {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

function isIos() {
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function pngFromCanvas(canvas: HTMLCanvasElement) {
  const out = document.createElement("canvas")
  out.width = EXPORT_W
  out.height = EXPORT_H
  const ctx = out.getContext("2d")
  if (!ctx) return new Blob()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(canvas, 0, 0, EXPORT_W, EXPORT_H)
  const dataUrl = out.toDataURL("image/png")
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: "image/png" })
}

function startAnchorDownload(url: string) {
  const link = document.createElement("a")
  link.href = url
  link.download = FILENAME
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function openPosterTab(url: string) {
  const popup = window.open("", "_blank")
  if (!popup) return false
  popup.document.title = "Template ICASAS"
  popup.document.body.style.margin = "0"
  popup.document.body.style.background = "#0c0c0e"
  const image = popup.document.createElement("img")
  image.src = url
  image.alt = "Template ICASAS"
  image.style.display = "block"
  image.style.width = "100%"
  image.style.height = "auto"
  popup.document.body.appendChild(image)
  return true
}

const emptyPhotos = (): PhotoMap => ({ hero: null, left: null, right: null })

export function Studio() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imagesRef = useRef<Partial<Record<PhotoSlot, HTMLImageElement | null>>>({})
  const logoRef = useRef<HTMLImageElement | null>(null)
  const draftRef = useRef<PosterDraft>(DEFAULT_DRAFT)
  const redrawRef = useRef<() => void>(() => {})
  const dragRef = useRef<{ slot: PhotoSlot; x: number; y: number } | null>(null)
  const fileRefs = useRef<Record<PhotoSlot, HTMLInputElement | null>>({
    hero: null,
    left: null,
    right: null,
  })

  const [draft, setDraft] = useState<PosterDraft>(DEFAULT_DRAFT)
  const [photos, setPhotos] = useState<PhotoMap>(emptyPhotos)
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(0.32)
  const [active, setActive] = useState<PhotoSlot | null>(null)
  const [picker, setPicker] = useState<number | null>(null)
  const [frame, setFrame] = useState(0)
  const [canShare, setCanShare] = useState(false)
  const [notice, setNotice] = useState("")
  const [photoError, setPhotoError] = useState("")
  const [posterExport, setPosterExport] = useState<{ url: string; file: File } | null>(null)
  const posterExportRef = useRef<{ url: string; file: File } | null>(null)

  draftRef.current = draft

  useEffect(() => {
    const saved = loadDraft()
    if (saved) setDraft(saved)
    setCanShare(typeof navigator.share === "function")
    let cancel = false
    void loadPhotos().then((stored) => {
      if (cancel || !stored) return
      setPhotos(stored)
    })
    const logo = new Image()
    logo.onload = () => {
      logoRef.current = logo
      setFrame((value) => value + 1)
    }
    logo.src = "/template/fundo.png"
    void document.fonts.load('700 64px "Cormorant Garamond"').then(() => {
      if (!cancel) setFrame((value) => value + 1)
    })
    void document.fonts.load("600 28px Outfit").then(() => {
      if (!cancel) setFrame((value) => value + 1)
    })
    setReady(true)
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    saveDraft(draft)
  }, [draft, ready])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void savePhotos(photos)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [photos, ready])

  useEffect(() => {
    let cancel = false
    ;(Object.keys(photos) as PhotoSlot[]).forEach((slot) => {
      const src = photos[slot]
      if (!src) {
        imagesRef.current[slot] = null
        return
      }
      const image = new Image()
      image.onload = () => {
        if (cancel) return
        imagesRef.current[slot] = image
        setFrame((value) => value + 1)
      }
      image.onerror = () => {
        if (cancel) return
        imagesRef.current[slot] = null
        setPhotoError("Não foi possível ler uma foto. Use JPG, PNG ou WebP.")
      }
      image.src = src
    })
    setFrame((value) => value + 1)
    return () => {
      cancel = true
    }
  }, [photos])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const draw = () => {
      const context = canvasRef.current?.getContext("2d")
      if (!context) return
      renderPoster(context, draftRef.current, imagesRef.current, logoRef.current, () => {
        requestAnimationFrame(() => redrawRef.current())
      })
    }
    redrawRef.current = draw
    draw()
  }, [draft, frame])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const measure = () => {
      const pad = 28
      const width = node.clientWidth - pad
      const height = node.clientHeight - pad
      if (width < 40 || height < 40) return
      setScale(Math.min(width / POSTER_W, height / POSTER_H))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  function update(patch: Partial<PosterDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function pointFrom(clientX: number, clientY: number) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * POSTER_W,
      y: ((clientY - rect.top) / rect.height) * POSTER_H,
    }
  }

  function readFile(slot: PhotoSlot, file: File) {
    if (!file.type.startsWith("image/")) {
      setPhotoError("Esse arquivo não é uma imagem.")
      return
    }
    setPhotoError("")
    const reader = new FileReader()
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : null
      setPhotos((current) => ({ ...current, [slot]: src }))
      setDraft((current) => ({
        ...current,
        adjust: {
          ...current.adjust,
          [slot]: { zoom: 1, focusX: 0.5, focusY: 0.5 },
        },
      }))
      setActive(slot)
    }
    reader.readAsDataURL(file)
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointFrom(event.clientX, event.clientY)
    const slot = hitSlot(point.x, point.y)
    if (!slot) return
    setActive(slot)
    if (!photos[slot]) {
      fileRefs.current[slot]?.click()
      return
    }
    dragRef.current = { slot, x: point.x, y: point.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag) return
    const point = pointFrom(event.clientX, event.clientY)
    const dx = point.x - drag.x
    const dy = point.y - drag.y
    drag.x = point.x
    drag.y = point.y
    const image = imagesRef.current[drag.slot]
    if (!image) return
    setDraft((current) => ({
      ...current,
      adjust: {
        ...current.adjust,
        [drag.slot]: shiftFocus(
          current.adjust[drag.slot],
          image.naturalWidth,
          image.naturalHeight,
          slotRect(drag.slot),
          dx,
          dy,
        ),
      },
    }))
  }

  function endDrag() {
    dragRef.current = null
  }

  function holdExport(next: { url: string; file: File }) {
    const previous = posterExportRef.current
    if (previous && previous.url !== next.url) URL.revokeObjectURL(previous.url)
    posterExportRef.current = next
    setPosterExport(next)
  }

  function closeExport() {
    const previous = posterExportRef.current
    if (previous) URL.revokeObjectURL(previous.url)
    posterExportRef.current = null
    setPosterExport(null)
  }

  function makeExport() {
    const canvas = canvasRef.current
    if (!canvas) return null
    try {
      const blob = pngFromCanvas(canvas)
      const file = new File([blob], FILENAME, { type: "image/png" })
      return { url: URL.createObjectURL(blob), file }
    } catch {
      setNotice("Não consegui gerar o PNG. Troque a foto que não carregou e tente de novo.")
      return null
    }
  }

  function download() {
    const next = makeExport()
    if (!next) return
    const embedded = isEmbedded()
    const ios = isIos()

    if (ios && navigator.canShare?.({ files: [next.file] })) {
      void navigator.share({ files: [next.file], title: "Template ICASAS" }).then(
        () => {
          URL.revokeObjectURL(next.url)
          setNotice("Template enviado. Escolha Salvar imagem no menu.")
        },
        (error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            URL.revokeObjectURL(next.url)
            return
          }
          holdExport(next)
        },
      )
      return
    }

    // Keep this synchronous: an awaited toBlob drops the user gesture and the
    // preview iframe silently blocks the file.
    startAnchorDownload(next.url)
    if (embedded || ios) {
      holdExport(next)
      setNotice("")
    } else {
      setNotice("PNG de 1080×1440 baixado.")
      window.setTimeout(() => URL.revokeObjectURL(next.url), 90_000)
    }
  }

  function share() {
    const next = makeExport()
    if (!next) return
    if (!navigator.canShare?.({ files: [next.file] })) {
      URL.revokeObjectURL(next.url)
      download()
      return
    }
    void navigator.share({ files: [next.file], title: "Template ICASAS" }).then(
      () => URL.revokeObjectURL(next.url),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          URL.revokeObjectURL(next.url)
          return
        }
        holdExport(next)
      },
    )
  }

  useEffect(() => () => {
    if (posterExportRef.current) URL.revokeObjectURL(posterExportRef.current.url)
  }, [])

  const highlight = active ? slotRect(active) : null

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface text-accent ring-1 ring-line">
            <HouseMark />
          </span>
          <div>
            <p className="font-display text-2xl leading-none tracking-wide text-fg">ICASAS</p>
            <p className="text-xs text-muted">Template 1080 × 1440</p>
          </div>
        </div>
        <div className="hidden gap-2 lg:flex">
          {canShare ? (
            <button type="button" className="btn-ghost" onClick={() => void share()}>
              Compartilhar
            </button>
          ) : null}
          <button type="button" className="btn-primary" onClick={() => void download()}>
            Baixar PNG
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1480px] lg:grid-cols-[minmax(0,1fr)_400px]">
        <div
          ref={stageRef}
          className="flex h-[54dvh] items-center justify-center bg-stage lg:sticky lg:top-[65px] lg:h-[calc(100dvh-65px)]"
        >
          <div style={{ width: POSTER_W * scale, height: POSTER_H * scale }}>
            <div
              className="relative overflow-hidden rounded-sm shadow-poster ring-1 ring-line"
              style={{
                width: POSTER_W,
                height: POSTER_H,
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
            >
              <canvas
                ref={canvasRef}
                width={POSTER_W}
                height={POSTER_H}
                className="block touch-none"
                style={{ width: POSTER_W, height: POSTER_H }}
                aria-label="Prévia do template ICASAS"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const point = pointFrom(event.clientX, event.clientY)
                  const slot = hitSlot(point.x, point.y)
                  const file = event.dataTransfer.files[0]
                  if (slot && file) readFile(slot, file)
                }}
              />
              {highlight ? (
                <div
                  className="pointer-events-none absolute border-2 border-accent"
                  style={{
                    left: highlight.x,
                    top: highlight.y,
                    width: highlight.w,
                    height: highlight.h,
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <form
          className="border-line pb-28 lg:border-l lg:pb-8"
          onSubmit={(event) => {
            event.preventDefault()
            void download()
          }}
        >
          <div className="px-4 py-5">
            <h1 className="text-lg font-semibold text-fg">Template</h1>
            {notice ? <p className="mt-2 text-sm text-accent">{notice}</p> : null}
            {photoError ? <p className="mt-2 text-sm text-danger">{photoError}</p> : null}
          </div>

          <section className="border-t border-line px-4 py-5">
            <h2 className="text-sm font-semibold text-fg">Modelo</h2>
            <img
              src="/template/modelo.jpg"
              alt="Modelo do template ICASAS"
              className="mt-3 w-full rounded-xl ring-1 ring-line"
            />
          </section>

          <section className="flex flex-col gap-3 border-t border-line px-4 py-5">
            <h2 className="text-sm font-semibold text-fg">Fotos</h2>
            {SLOTS.map((slot) => (
              <div
                key={slot.id}
                className={`rounded-2xl bg-surface p-3 ring-1 ${active === slot.id ? "ring-accent" : "ring-line"}`}
              >
                <div className="flex gap-3">
                  <button
                    type="button"
                    className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-muted ring-1 ring-line"
                    onClick={() => fileRefs.current[slot.id]?.click()}
                  >
                    {photos[slot.id] ? (
                      <img src={photos[slot.id] ?? ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs">+</span>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{slot.title}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn-tiny"
                        onClick={() => fileRefs.current[slot.id]?.click()}
                      >
                        {photos[slot.id] ? "Trocar" : "Anexar"}
                      </button>
                      {photos[slot.id] ? (
                        <button
                          type="button"
                          className="btn-tiny"
                          onClick={() => {
                            setPhotos((current) => ({ ...current, [slot.id]: null }))
                            update({
                              adjust: {
                                ...draft.adjust,
                                [slot.id]: { zoom: 1, focusX: 0.5, focusY: 0.5 },
                              },
                            })
                          }}
                        >
                          Remover
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                {photos[slot.id] ? (
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="text-xs text-muted">Zoom</span>
                    <input
                      type="range"
                      min={1}
                      max={2.8}
                      step={0.01}
                      value={draft.adjust[slot.id].zoom}
                      className="accent-accent"
                      onChange={(event) => {
                        const zoom = Number(event.target.value)
                        update({
                          adjust: {
                            ...draft.adjust,
                            [slot.id]: { ...draft.adjust[slot.id], zoom },
                          },
                        })
                      }}
                    />
                  </label>
                ) : null}
                <input
                  ref={(node) => {
                    fileRefs.current[slot.id] = node
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) readFile(slot.id, file)
                    event.target.value = ""
                  }}
                />
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-3 border-t border-line px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-fg">Textos</h2>
              <button
                type="button"
                className="btn-tiny"
                onClick={() =>
                  update({
                    title: "",
                    accent: "",
                    subtitle: "",
                    place1: "",
                    place2: "",
                    price: "",
                    priceNote: "",
                    cta: "",
                    specs: [],
                  })
                }
              >
                Limpar campos
              </button>
            </div>
            <Field label="Título" value={draft.title} onChange={(title) => update({ title })} />
            <Field label="Em laranja" value={draft.accent} onChange={(accent) => update({ accent })} />
            <Field label="Subtítulo" value={draft.subtitle} onChange={(subtitle) => update({ subtitle })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bairro" value={draft.place1} onChange={(place1) => update({ place1 })} />
              <Field label="Cidade" value={draft.place2} onChange={(place2) => update({ place2 })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor" value={draft.price} onChange={(price) => update({ price })} />
              <Field label="Condição" value={draft.priceNote} onChange={(priceNote) => update({ priceNote })} />
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-line px-4 py-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-fg">Ícones e informações</h2>
              <button
                type="button"
                className="btn-tiny disabled:opacity-40"
                disabled={draft.specs.length >= MAX_SPECS}
                onClick={() => {
                  if (draft.specs.length >= MAX_SPECS) return
                  update({ specs: [...draft.specs, { icon: "", label: "" }] })
                  setPicker(draft.specs.length)
                }}
              >
                Incluir ícone
              </button>
            </div>
            {draft.specs.map((spec, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-surface text-accent ring-1 ring-line"
                  onClick={() => setPicker(index)}
                  aria-label={spec.icon ? `Trocar ícone ${index + 1}` : `Escolher ícone ${index + 1}`}
                >
                  {spec.icon ? <Glyph id={spec.icon} /> : <span className="text-lg text-muted">+</span>}
                </button>
                <input
                  value={spec.label}
                  aria-label={`Texto do ícone ${index + 1}`}
                  className="field"
                  onChange={(event) => {
                    const specs = draft.specs.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, label: event.target.value } : item,
                    )
                    update({ specs })
                  }}
                />
                <button
                  type="button"
                  className="btn-tiny shrink-0"
                  onClick={() => update({ specs: draft.specs.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  Remover
                </button>
              </div>
            ))}
          </section>
        </form>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-line bg-bg/95 p-3 backdrop-blur lg:hidden">
        {canShare ? (
          <button type="button" className="btn-ghost flex-1" onClick={() => void share()}>
            Compartilhar
          </button>
        ) : null}
        <button type="button" className="btn-primary flex-1" onClick={() => void download()}>
          Baixar PNG
        </button>
      </div>

      <Dialog.Root open={picker !== null} onOpenChange={(open) => !open && setPicker(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
          <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 max-h-[78dvh] overflow-auto rounded-2xl bg-surface p-4 ring-1 ring-line outline-none lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[680px] lg:-translate-x-1/2 lg:-translate-y-1/2">
            <Dialog.Title className="text-base font-semibold text-fg">Ícones</Dialog.Title>
            <Dialog.Description className="sr-only">Escolha o ícone.</Dialog.Description>
            <button
              type="button"
              className="btn-tiny mt-3"
              onClick={() => {
                if (picker === null) return
                const specs = draft.specs.map((item, index) =>
                  index === picker ? { ...item, icon: "" } : item,
                )
                update({ specs })
                setPicker(null)
              }}
            >
              Deixar sem ícone
            </button>
            <div className="mt-4 flex flex-col gap-4">
              {ICON_GROUPS.map((group) => (
                <div key={group.id}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-muted">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {ICON_CATALOG.filter((icon) => icon.group === group.id).map((icon) => {
                      const selected = picker !== null && draft.specs[picker]?.icon === icon.id
                      return (
                        <button
                          key={icon.id}
                          type="button"
                          className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl bg-surface-2 text-accent ring-1 ${selected ? "ring-accent" : "ring-line"}`}
                          onClick={() => {
                            if (picker === null) return
                            const specs = draft.specs.map((item, index) =>
                              index === picker ? { ...item, icon: icon.id } : item,
                            )
                            update({ specs })
                            setPicker(null)
                          }}
                        >
                          <Glyph id={icon.id} />
                          <span className="max-w-full truncate px-1 text-xs text-muted">{icon.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={posterExport !== null} onOpenChange={(open) => !open && closeExport()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
          <Dialog.Content className="fixed inset-x-3 bottom-3 z-50 flex max-h-[88dvh] flex-col gap-3 overflow-hidden rounded-2xl bg-surface p-4 ring-1 ring-line outline-none lg:inset-auto lg:left-1/2 lg:top-1/2 lg:w-[420px] lg:-translate-x-1/2 lg:-translate-y-1/2">
            <Dialog.Title className="text-base font-semibold text-fg">Salvar template</Dialog.Title>
            <Dialog.Description className="sr-only">PNG 1080 por 1440.</Dialog.Description>
            {posterExport ? (
              <img
                src={posterExport.url}
                alt="Template ICASAS pronto para salvar"
                className="mx-auto max-h-[48dvh] w-auto rounded-lg ring-1 ring-line"
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {posterExport ? (
                <a
                  className="btn-primary cursor-pointer whitespace-nowrap"
                  href={posterExport.url}
                  download={FILENAME}
                  target="_blank"
                  rel="noopener"
                >
                  Salvar PNG
                </a>
              ) : null}
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  if (!posterExport) return
                  if (navigator.canShare?.({ files: [posterExport.file] })) {
                    void navigator.share({ files: [posterExport.file], title: "Template ICASAS" }).catch(
                      (error: unknown) => {
                        if (error instanceof DOMException && error.name === "AbortError") return
                        if (!openPosterTab(posterExport.url)) {
                          setNotice("O navegador bloqueou a nova aba. Segure a imagem para salvar.")
                        }
                      },
                    )
                    return
                  }
                  if (!openPosterTab(posterExport.url)) {
                    setNotice("O navegador bloqueou a nova aba. Segure a imagem para salvar.")
                  }
                }}
              >
                Abrir imagem
              </button>
              <button type="button" className="btn-ghost" onClick={closeExport}>
                Fechar
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <input
        className="field placeholder:text-muted"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function HouseMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 11.5 12 4l8 7.5V20H4v-8.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="1.3" fill="currentColor" />
    </svg>
  )
}
