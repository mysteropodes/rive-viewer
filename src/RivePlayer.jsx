import { useState, useEffect, useRef } from 'react'
import { useRive } from '@rive-app/react-webgl2'

// StateMachineInputType: Number=56, Trigger=58, Boolean=59
const BOOL    = 59
const TRIGGER = 58

const BG_PRESETS = [
  { label: 'Dark',        value: '#0d1117' },
  { label: 'Black',       value: '#000000' },
  { label: 'White',       value: '#ffffff' },
  { label: 'Light gray',  value: '#f0f0f0' },
  { label: 'Transparent', value: 'transparent' },
]

/* ── Boolean toggle ──────────────────────────────────── */
function BoolToggle({ label, input }) {
  const [on, setOn] = useState(false)
  const toggle = () => {
    const next = !on
    setOn(next)
    if (input) input.value = next
  }
  return (
    <button
      onClick={toggle}
      className={'bool-btn' + (on ? ' bool-btn--on' : '')}
      disabled={!input}
    >
      <span className="bool-dot" />
      {label}
      <span className="bool-badge">{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}

/* ── Trigger button ──────────────────────────────────── */
function TriggerBtn({ label, input }) {
  const [flash, setFlash] = useState(false)
  const fire = () => {
    if (input) input.fire()
    setFlash(true)
    setTimeout(() => setFlash(false), 300)
  }
  return (
    <button
      onClick={fire}
      className={'trigger-btn' + (flash ? ' trigger-btn--flash' : '')}
      disabled={!input}
    >
      ▶ {label}
    </button>
  )
}

/* ── Hue / saturation tint ───────────────────────────── */
function TintPicker({ hue, saturation, onHueChange, onSaturationChange }) {
  const isActive = hue !== 0 || saturation !== 100
  return (
    <div className="tint-picker">
      <span className="tint-label">Tint</span>

      <div className="tint-ring-wrap" title={`Hue: ${hue}°`}>
        <div className="tint-ring" style={{ filter: `hue-rotate(${hue}deg)` }} />
        <input
          type="range" min="0" max="359" value={hue}
          onChange={e => onHueChange(Number(e.target.value))}
          className="tint-range tint-range--hue"
        />
      </div>
      <span className="tint-val">{hue}°</span>

      <div className="tint-ring-wrap" title={`Saturation: ${saturation}%`}>
        <div className="tint-sat-track" />
        <input
          type="range" min="0" max="200" value={saturation}
          onChange={e => onSaturationChange(Number(e.target.value))}
          className="tint-range tint-range--sat"
        />
      </div>
      <span className="tint-val">{saturation}%</span>

      {isActive && (
        <button
          className="tint-reset" title="Reset"
          onClick={() => { onHueChange(0); onSaturationChange(100) }}
        >↺</button>
      )}
    </div>
  )
}

/* ── Background color picker ─────────────────────────── */
function ColorPicker({ color, onChange }) {
  return (
    <div className="color-picker">
      <span className="color-label">Background</span>
      {BG_PRESETS.map(p => (
        <button
          key={p.value} title={p.label}
          className={'color-swatch' + (color === p.value ? ' color-swatch--active' : '')}
          style={{
            background: p.value === 'transparent'
              ? 'repeating-conic-gradient(#444 0% 25%, #222 0% 50%) 0 0/10px 10px'
              : p.value,
          }}
          onClick={() => onChange(p.value)}
        />
      ))}
      <label className="color-custom" title="Custom color">
        <input
          type="color"
          value={color === 'transparent' ? '#000000' : color}
          onChange={e => onChange(e.target.value)}
        />
        <span className="color-custom-icon">🎨</span>
      </label>
    </div>
  )
}

/* ── Player ──────────────────────────────────────────── */
export default function RivePlayer({
  src, artboard, stateMachine = null, boolInputs = [], triggerInputs = [],
  bgColor, onBgColorChange,
  hue, onHueChange, saturation, onSaturationChange,
}) {
  // Dynamic inputs: populated after rive loads
  const [inputMap, setInputMap] = useState({})

  const { rive, canvas, RiveComponent } = useRive({
    src,
    artboard,
    ...(stateMachine ? { stateMachines: stateMachine } : {}),
    autoplay: true,
    autoBind: true,
  })

  // Build inputMap for booleans AND triggers from the loaded SM
  useEffect(() => {
    if (!rive || !stateMachine) { setInputMap({}); return }
    const inputs = rive.stateMachineInputs(stateMachine) || []
    const map = {}
    inputs.forEach(input => {
      if (input.type === BOOL || input.type === TRIGGER) map[input.name] = input
    })
    setInputMap(map)
  }, [rive, stateMachine])

  // ── Paramètres d'export ───────────────────────────────
  const [exportFps,   setExportFps]   = useState(30)
  // exportWidth : null = natif, sinon largeur cible en px
  const [exportWidth, setExportWidth] = useState(null)

  // Capture un frame à la taille cible (proportions conservées)
  const captureFrame = (cvs) => {
    const tw = exportWidth ?? cvs.width
    const th = exportWidth ? Math.round(cvs.height * (exportWidth / cvs.width)) : cvs.height
    if (tw === cvs.width && th === cvs.height) return cvs.toDataURL('image/png').split(',')[1]
    const tmp = document.createElement('canvas')
    tmp.width = tw ; tmp.height = th
    const ctx = tmp.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cvs, 0, 0, tw, th)
    return tmp.toDataURL('image/png').split(',')[1]
  }

  const exportSuffix = () => {
    if (!canvas) return ''
    const tw = exportWidth ?? canvas.width
    const th = exportWidth ? Math.round(canvas.height * (exportWidth / canvas.width)) : canvas.height
    return `${tw}x${th}`
  }

  // ── PNG (frame courant) ───────────────────────────────
  const captureAsPng = () => {
    if (!canvas) return
    const b64  = captureFrame(canvas)
    const link = document.createElement('a')
    link.download = `${artboard}_${exportSuffix()}.png`
    link.href = `data:image/png;base64,${b64}`
    link.click()
  }

  // ── Séquence PNG avec alpha → ZIP ────────────────────
  const [recording, setRecording]   = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const rafRef    = useRef(null)
  const framesRef = useRef([])
  const lastTsRef = useRef(0)

  const stopAndPack = async () => {
    cancelAnimationFrame(rafRef.current)
    setRecording(false)
    const frames = framesRef.current
    if (!frames.length) return
    const JSZip = (await import('jszip')).default
    const zip   = new JSZip()
    const dir   = zip.folder(artboard)
    frames.forEach((b64, i) =>
      dir.file(`frame_${String(i).padStart(5, '0')}.png`, b64, { base64: true })
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.download  = `${artboard}_${exportFps}fps_${exportSuffix()}_seq.zip`
    a.href      = url
    a.click()
    URL.revokeObjectURL(url)
    setFrameCount(0)
  }

  const toggleRecord = () => {
    if (!canvas) return
    if (recording) { stopAndPack(); return }
    framesRef.current = []
    lastTsRef.current = 0
    setFrameCount(0)
    setRecording(true)
    const interval = 1000 / exportFps
    const tick = ts => {
      if (ts - lastTsRef.current >= interval) {
        lastTsRef.current = ts
        framesRef.current.push(captureFrame(canvas))
        setFrameCount(n => n + 1)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // CSS filter applied to canvas-wrap (background color unaffected since darks don't shift)
  const canvasFilter = [
    hue !== 0         ? `hue-rotate(${hue}deg)`    : '',
    saturation !== 100 ? `saturate(${saturation}%)` : '',
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className="player">
      <div
        className="canvas-wrap"
        style={{
          background: bgColor,
          ...(canvasFilter ? { filter: canvasFilter } : {}),
        }}
      >
        <RiveComponent className="canvas" />
      </div>

      <div className="bottom-bar">
        {/* playback */}
        <div className="controls">
          <button onClick={() => rive?.play()}  disabled={!rive}>▶ Play</button>
          <button onClick={() => rive?.pause()} disabled={!rive}>⏸ Pause</button>
          <button onClick={() => rive?.reset({ autoplay: true })} disabled={!rive}>↺ Replay</button>

          <span className="export-sep" />

          {/* Export format */}
          <span className="export-label">Export</span>
          <select
            className="export-select"
            value={exportWidth ?? ''}
            onChange={e => setExportWidth(e.target.value === '' ? null : Number(e.target.value))}
            disabled={recording}
            title="Export width (height proportional)"
          >
            <option value="">Native</option>
            <option value={720}>720px</option>
            <option value={1080}>1080px</option>
            <option value={1920}>1920px</option>
            <option value={2560}>2560px</option>
            <option value={3840}>4K</option>
          </select>
          <select
            className="export-select"
            value={exportFps}
            onChange={e => setExportFps(Number(e.target.value))}
            disabled={recording}
            title="FPS (sequence)"
          >
            <option value={24}>24fps</option>
            <option value={30}>30fps</option>
            <option value={60}>60fps</option>
          </select>

          <button onClick={captureAsPng} disabled={!canvas} title="Capture PNG — current frame">📷 PNG</button>
          <button
            onClick={toggleRecord} disabled={!canvas}
            className={recording ? 'record-btn record-btn--on' : 'record-btn'}
            title={recording ? `Stop — ${frameCount} frames → ZIP` : `PNG sequence ${exportFps}fps ${exportWidth ? exportWidth + 'px' : 'native'} → ZIP`}
          >{recording ? `⏹ ${frameCount}f` : '⏺ PNG seq'}</button>
        </div>

        {/* boolean inputs — driven by boolInputs list from discovery */}
        {boolInputs.length > 0 && (
          <div className="bool-inputs">
            <span className="bool-label">Boolean</span>
            {boolInputs.map(name => (
              <BoolToggle key={name} label={name} input={inputMap[name]} />
            ))}
          </div>
        )}

        {/* trigger inputs */}
        {triggerInputs.length > 0 && (
          <div className="bool-inputs">
            <span className="bool-label">Trigger</span>
            {triggerInputs.map(name => (
              <TriggerBtn key={name} label={name} input={inputMap[name]} />
            ))}
          </div>
        )}

        {/* tint */}
        <TintPicker
          hue={hue} saturation={saturation}
          onHueChange={onHueChange} onSaturationChange={onSaturationChange}
        />

        {/* background */}
        <ColorPicker color={bgColor} onChange={onBgColorChange} />
      </div>
    </div>
  )
}
