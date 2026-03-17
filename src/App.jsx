import { useState, useEffect, useRef } from 'react'
import RivePlayer      from './RivePlayer'
import CodePanel       from './CodePanel'
import RiveDiscoverer  from './RiveDiscoverer'
import './App.css'

export default function App() {
  const [riveSrc,    setRiveSrc]    = useState(null)
  const [fileName,   setFileName]   = useState(null)
  const [artboards,  setArtboards]  = useState([])
  const [current,    setCurrent]    = useState(null)
  const [codeOpen,   setCodeOpen]   = useState(false)
  const [bgColor,    setBgColor]    = useState('#0d1117')
  const [hue,        setHue]        = useState(0)
  const [saturation, setSaturation] = useState(100)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (artboards.length > 0) setCurrent(artboards[0])
  }, [artboards])

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (riveSrc) URL.revokeObjectURL(riveSrc)
    setRiveSrc(URL.createObjectURL(file))
    setFileName(file.name)
    setArtboards([])
    setCurrent(null)
    setCodeOpen(false)
  }

  // Drop zone handlers
  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file?.name.endsWith('.riv')) return
    if (riveSrc) URL.revokeObjectURL(riveSrc)
    setRiveSrc(URL.createObjectURL(file))
    setFileName(file.name)
    setArtboards([])
    setCurrent(null)
    setCodeOpen(false)
  }

  return (
    <div className="app-root">

      {/* ── Hidden file input ───────────────────────────── */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".riv"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {!riveSrc ? (
        /* ── Drop screen ──────────────────────────────── */
        <div
          className="drop-screen"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-box">
            <span className="drop-icon">🗂</span>
            <p className="drop-title">Rive Viewer</p>
            <p className="drop-sub">Drop a <strong>.riv</strong> file here<br/>or click to browse</p>
          </div>
        </div>
      ) : (
        /* ── Viewer ───────────────────────────────────── */
        <div className="shell">

          {riveSrc && <RiveDiscoverer key={riveSrc} src={riveSrc} onDiscovered={setArtboards} />}

          <aside className="sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title" title={fileName}>{fileName}</span>
              <button
                className="upload-btn"
                title="Load a .riv file"
                onClick={() => fileInputRef.current?.click()}
              >
                ↑ .riv
              </button>
            </div>
            <nav className="nav">
              {artboards.length === 0
                ? <div className="nav-loading">Loading…</div>
                : artboards.map(a => (
                    <button
                      key={a.id}
                      className={'nav-btn' + (a.id === current?.id ? ' nav-btn--active' : '')}
                      onClick={() => setCurrent(a)}
                      title={a.id}
                    >
                      {a.boolInputs?.length > 0 && <span className="nav-dot" />}
                      <span className="nav-label">{a.label}</span>
                    </button>
                  ))
              }
            </nav>
          </aside>

          <main className="main">
            {current ? (
              <>
                <header className="topbar">
                  <h1 className="artboard-name">{current.label}</h1>
                  {current.stateMachine && (
                    <span className="state-badge">{current.stateMachine}</span>
                  )}
                  <button
                    className={'topbar-btn' + (codeOpen ? ' topbar-btn--active' : '')}
                    onClick={() => setCodeOpen(v => !v)}
                  >
                    {'</>'} Code React
                  </button>
                </header>
                <div className="content">
                  <RivePlayer
                    key={current.id + riveSrc}
                    src={riveSrc}
                    artboard={current.label}
                    stateMachine={current.stateMachine ?? null}
                    boolInputs={current.boolInputs ?? []}
                    bgColor={bgColor}
                    onBgColorChange={setBgColor}
                    hue={hue}
                    onHueChange={setHue}
                    saturation={saturation}
                    onSaturationChange={setSaturation}
                  />
                  {codeOpen && <CodePanel artboard={current} />}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Loading…</p>
              </div>
            )}
          </main>

        </div>
      )}

    </div>
  )
}
