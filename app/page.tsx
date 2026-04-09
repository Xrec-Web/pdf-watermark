'use client'

import { useState, useRef, useCallback } from 'react'

interface Settings {
  size: number      // % of PDF width (10–150)
  opacity: number   // 1–100
  rotation: number  // –180 to 180 degrees
}

const DEFAULT_SETTINGS: Settings = { size: 80, opacity: 30, rotation: 20 }

export default function Home() {
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Blob Storage URLs (for server-side processing)
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [logoBlobUrl, setLogoBlobUrl] = useState<string | null>(null)

  // Local preview URLs
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)

  // Canvas dimensions (used to size the CSS overlay correctly)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const uploadToBlob = async (file: File, type: 'pdf' | 'logo'): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Upload failed')
    return data.url as string
  }

  const renderPdfToCanvas = useCallback(async (file: File) => {
    const objectUrl = URL.createObjectURL(file)
    try {
      // Dynamic import keeps pdfjs out of the server bundle
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument(objectUrl).promise
      const page = await pdf.getPage(1)

      const container = previewContainerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return

      const viewport = page.getViewport({ scale: 1 })
      const scale = (container.clientWidth || 595) / viewport.width
      const scaled = page.getViewport({ scale })

      canvas.width = scaled.width
      canvas.height = scaled.height
      setCanvasSize({ width: scaled.width, height: scaled.height })

      // pdfjs-dist v5 requires `canvas` in RenderParameters
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render as any)({ canvasContext: canvas.getContext('2d')!, canvas, viewport: scaled }).promise
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  }, [])

  // ─── Event handlers ────────────────────────────────────────────────────────

  const handlePdfDrop = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    setError(null)
    setPdfFile(file)
    setUploadingPdf(true)
    try {
      await renderPdfToCanvas(file)
      const url = await uploadToBlob(file, 'pdf')
      setPdfBlobUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF. Please try again.')
    } finally {
      setUploadingPdf(false)
    }
  }

  const handleLogoDrop = async (file: File) => {
    setError(null)
    setLogoFile(file)
    const preview = URL.createObjectURL(file)
    setLogoPreviewUrl(preview)
    setUploadingLogo(true)
    try {
      const url = await uploadToBlob(file, 'logo')
      setLogoBlobUrl(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleDownload = async () => {
    if (!pdfBlobUrl || !logoBlobUrl) return
    setIsDownloading(true)
    setError(null)
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: pdfBlobUrl, logoUrl: logoBlobUrl, ...settings }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server error: ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'watermarked.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF.')
    } finally {
      setIsDownloading(false)
    }
  }

  const setSetting = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }))

  const isReady = !!pdfBlobUrl && !!logoBlobUrl

  // Logo overlay width in pixels relative to canvas
  const overlayWidthPx = canvasSize.width * (settings.size / 100)

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: '#0f1117', color: '#f1f5f9' }}>
      {/* Header */}
      <header
        style={{
          borderBottom: '1px solid #1e2433',
          background: '#131720',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="6" fill="#4f6ef7" />
          <path d="M8 20V8l10 6-10 6z" fill="white" />
          <line x1="19" y1="8" x2="19" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 18 }}>PDF Watermark</span>
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            background: '#1e2433',
            color: '#7c8db5',
            borderRadius: 4,
            padding: '2px 8px',
          }}
        >
          beta
        </span>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        {error && (
          <div
            style={{
              background: '#2d1515',
              border: '1px solid #7f2020',
              color: '#f87171',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {/* ── Left panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* PDF upload */}
            <DropZone
              label="PDF Document"
              accept=".pdf"
              icon="📄"
              hint="A4 or any size PDF"
              file={pdfFile}
              loading={uploadingPdf}
              onFile={handlePdfDrop}
            />

            {/* Logo upload */}
            <DropZone
              label="Watermark Logo"
              accept=".png,.jpg,.jpeg"
              icon="🖼"
              hint="PNG or JPEG image"
              file={logoFile}
              loading={uploadingLogo}
              onFile={handleLogoDrop}
            />

            {/* Controls */}
            <div
              style={{
                background: '#131720',
                border: '1px solid #1e2433',
                borderRadius: 12,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
              }}
            >
              <div
                style={{ fontSize: 12, fontWeight: 600, color: '#7c8db5', letterSpacing: '0.08em' }}
              >
                ADJUSTMENTS
              </div>

              <SliderControl
                label="Size"
                value={settings.size}
                min={10}
                max={150}
                unit="%"
                onChange={(v) => setSetting('size', v)}
              />
              <SliderControl
                label="Opacity"
                value={settings.opacity}
                min={1}
                max={100}
                unit="%"
                onChange={(v) => setSetting('opacity', v)}
              />
              <SliderControl
                label="Rotation"
                value={settings.rotation}
                min={-180}
                max={180}
                unit="°"
                onChange={(v) => setSetting('rotation', v)}
              />

              <button
                onClick={handleDownload}
                disabled={!isReady || isDownloading}
                style={{
                  marginTop: 4,
                  height: 44,
                  borderRadius: 8,
                  border: 'none',
                  cursor: isReady && !isDownloading ? 'pointer' : 'not-allowed',
                  background: isReady && !isDownloading ? '#4f6ef7' : '#1e2433',
                  color: isReady && !isDownloading ? '#fff' : '#7c8db5',
                  fontWeight: 600,
                  fontSize: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                {isDownloading ? (
                  <>
                    <Spinner /> Processing…
                  </>
                ) : (
                  <>↓ Download Watermarked PDF</>
                )}
              </button>

              {!isReady && !isDownloading && (
                <p style={{ fontSize: 12, color: '#7c8db5', textAlign: 'center', margin: 0 }}>
                  Upload both a PDF and a logo to enable download
                </p>
              )}
            </div>
          </div>

          {/* ── Preview panel ── */}
          <div
            style={{
              background: '#131720',
              border: '1px solid #1e2433',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #1e2433',
                fontSize: 12,
                fontWeight: 600,
                color: '#7c8db5',
                letterSpacing: '0.08em',
              }}
            >
              PREVIEW — page 1
            </div>

            <div
              ref={previewContainerRef}
              style={{ position: 'relative', width: '100%', lineHeight: 0 }}
            >
              {/* PDF canvas */}
              {!pdfFile && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 480,
                    color: '#3a4560',
                    gap: 12,
                  }}
                >
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect width="64" height="64" rx="12" fill="#1e2433" />
                    <path d="M20 14h16l8 8v28H20V14z" fill="#2d3654" />
                    <path d="M36 14l8 8h-8V14z" fill="#3a4560" />
                    <line x1="26" y1="28" x2="38" y2="28" stroke="#4f6ef7" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="26" y1="33" x2="38" y2="33" stroke="#4f6ef7" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="26" y1="38" x2="34" y2="38" stroke="#4f6ef7" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 14 }}>Upload a PDF to see preview</span>
                </div>
              )}
              <canvas ref={canvasRef} style={{ width: '100%', display: pdfFile ? 'block' : 'none' }} />

              {/* Watermark overlay */}
              {logoPreviewUrl && canvasSize.width > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreviewUrl}
                    alt="watermark preview"
                    style={{
                      width: overlayWidthPx,
                      maxWidth: 'none',
                      opacity: settings.opacity / 100,
                      transform: `rotate(${settings.rotation}deg)`,
                    }}
                  />
                </div>
              )}

              {/* Uploading spinner overlay */}
              {(uploadingPdf || uploadingLogo) && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15,17,23,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#7c8db5',
                    fontSize: 14,
                    gap: 10,
                  }}
                >
                  <Spinner /> Uploading…
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function DropZone({
  label,
  accept,
  icon,
  hint,
  file,
  loading,
  onFile,
}: {
  label: string
  accept: string
  icon: string
  hint: string
  file: File | null
  loading: boolean
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handle = (f: File | undefined) => {
    if (f) onFile(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handle(e.dataTransfer.files[0])
      }}
      style={{
        background: dragging ? '#1a2240' : '#131720',
        border: `2px dashed ${dragging ? '#4f6ef7' : file ? '#2a4070' : '#1e2433'}`,
        borderRadius: 12,
        padding: '20px 16px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: file ? '#162040' : '#1e2433',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {loading ? <Spinner /> : icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{label}</div>
        {file ? (
          <div
            style={{
              fontSize: 12,
              color: '#4f6ef7',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {file.name}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#7c8db5' }}>
            Drop here or click · {hint}
          </div>
        )}
      </div>
    </div>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#c8d4f0' }}>{label}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#4f6ef7',
            minWidth: 50,
            textAlign: 'right',
          }}
        >
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#4f6ef7',
          height: 4,
          cursor: 'pointer',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#3a4560' }}>
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="8" cy="8" r="6" stroke="#4f6ef7" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
    </svg>
  )
}
