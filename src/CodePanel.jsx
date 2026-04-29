import { useState } from 'react'

/* ── ViewModel helpers ──────────────────────────────────── */
// DataType enum: none=0, string=1, number=2, boolean=3, color=4,
//                list=5, enumType=6, trigger=7, viewModel=8
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

// p.type from WASM runtime is a string: "number", "color", "boolean", etc.
const VM_HOOK = {
  string:   'useViewModelInstanceString',
  number:   'useViewModelInstanceNumber',
  boolean:  'useViewModelInstanceBoolean',
  color:    'useViewModelInstanceColor',
  enumType: 'useViewModelInstanceEnum',
  trigger:  'useViewModelInstanceTrigger',
}

const vmDestructure = (type, n) => {
  switch (type) {
    case 'string':   return `{ value: ${n}, setValue: set${cap(n)} }`
    case 'number':   return `{ value: ${n}, setValue: set${cap(n)} }`
    case 'boolean':  return `{ value: ${n}, setValue: set${cap(n)} }`
    case 'color':    return `{ value: ${n}, setRgb: set${cap(n)}Rgb, setRgba: set${cap(n)}Rgba }`
    case 'enumType': return `{ value: ${n}, setValue: set${cap(n)}, values: ${n}Values }`
    case 'trigger':  return `{ trigger: trigger${cap(n)} }`
    default: return `{ value: ${n} }`
  }
}

// "My ViewModel" → "myViewModel"
const toVarName = s => s
  .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
  .replace(/^[A-Z]/, c => c.toLowerCase())
  .replace(/[^a-zA-Z0-9]/g, '')

function buildViewModelSnippet(artboard) {
  const vms = artboard.viewModels
  if (!vms?.length) return null

  const active    = vms.filter(vm => vm.properties.some(p => VM_HOOK[p.type]) || vm.instanceNames.length)
  if (!active.length) return null

  const hasColor  = active.some(vm => vm.properties.some(p => p.type === 'color'))
  const single    = active.length === 1
  const hooksUsed = new Set(['useViewModel', 'useViewModelInstance'])
  const lines     = []

  if (hasColor)
    lines.push(
      `// Hex → r,g,b helper`,
      `const hexToRgb = hex => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16))`,
      '',
    )

  active.forEach((vm, i) => {
    const props    = vm.properties.filter(p => VM_HOOK[p.type])
    const varBase  = single ? 'vm' : toVarName(vm.name) || `vm${i}`
    const varVM    = single ? 'vm'         : `vm${cap(varBase)}`
    const varInst  = single ? 'vmInstance' : `vmInstance${cap(varBase)}`
    const vmArg    = single ? '{ useDefault: true }' : `{ name: '${vm.name}' }`
    const instArg  = `{ rive, useDefault: true }`

    props.forEach(p => hooksUsed.add(VM_HOOK[p.type]))

    if (i > 0) lines.push('')

    if (vm.instanceNames.length)
      lines.push(`// instances: ${vm.instanceNames.join(', ')}`)

    lines.push(
      `// ViewModel : "${vm.name}"`,
      `const ${varVM} = useViewModel(rive, ${vmArg})`,
      `const ${varInst} = useViewModelInstance(${varVM}, ${instArg})`,
    )

    if (props.length) {
      lines.push('')
      props.forEach(p => {
        const dest = vmDestructure(p.type, p.name)
        lines.push(`const ${dest} = ${VM_HOOK[p.type]}('${p.name}', ${varInst})`)
        if (p.type === 'color') {
          lines.push(`// set${cap(p.name)}Rgb(r, g, b)              ← 0–255`)
          lines.push(`// set${cap(p.name)}Rgba(r, g, b, a)          ← 0–255 + alpha`)
          lines.push(`// set${cap(p.name)}Rgb(...hexToRgb('#RRGGBB')) ← from hex`)
        }
      })
    }
  })

  return [
    `import { ${[...hooksUsed].join(', ')} } from '@rive-app/react-canvas'`,
    '',
    ...lines,
  ].join('\n')
}

/* ── helpers ───────────────────────────────────────────── */
function buildSetupSnippet(artboard, fileName) {
  const hasInputs = (artboard.boolInputs?.length > 0) || (artboard.triggerInputs?.length > 0)
  const sm        = artboard.stateMachine ?? null
  const smLine    = sm ? `\n  stateMachines: STATE_MACHINE,` : ''
  const smConst   = sm ? `\nconst STATE_MACHINE = '${sm}'\n` : ''
  const srcName   = fileName ?? 'animation.riv'
  return `import { useRive${hasInputs ? ', useStateMachineInput' : ''} } from '@rive-app/react-canvas'
${smConst}
const { rive, RiveComponent } = useRive({
  src: '${srcName}',
  artboard: '${artboard.label}',${smLine}
  autoplay: true,
})

return (
  <RiveComponent style={{ width: '100%', height: '100%' }} />
)`
}

function buildTextRunsSnippet() {
  return `// ── Text Value Runs ──────────────────────────────────────
// Run name = name set in Rive Editor (properties panel)

// Read current value
const text = rive?.getTextRunValue('runName')

// Update text
rive?.setTextRunValue('runName', 'new text')

// Multiple runs at once
const runs = { title: 'Hello', subtitle: 'World' }
Object.entries(runs).forEach(([run, val]) =>
  rive?.setTextRunValue(run, val)
)

// Nested artboard run
rive?.setTextRunValueAtPath('runName', 'text', 'path/artboard')`
}

function buildInputsSnippet(artboard) {
  const bools    = artboard.boolInputs    ?? []
  const triggers = artboard.triggerInputs ?? []
  if (!bools.length && !triggers.length) return null

  const sm = artboard.stateMachine

  const boolDecls = bools.map(
    name => `const ${name}Input = useStateMachineInput(\n  rive, '${sm}', '${name}', false\n)`
  )
  const trigDecls = triggers.map(
    name => `const ${name}Input = useStateMachineInput(\n  rive, '${sm}', '${name}'\n)`
  )

  const boolUsage    = bools.map(name => `${name}Input.value = !${name}Input.value`)
  const triggerUsage = triggers.map(name => `${name}Input?.fire()`)

  const sections = []

  if (boolDecls.length || trigDecls.length) {
    sections.push(`// — Declare inputs (after useRive) ——————————\n${[...boolDecls, ...trigDecls].join('\n\n')}`)
  }
  if (boolUsage.length) {
    sections.push(`// — Boolean toggle (onClick) ————————————————\n${boolUsage.join('\n')}`)
  }
  if (triggerUsage.length) {
    sections.push(`// — Fire trigger (onClick) ——————————————————\n${triggerUsage.join('\n')}`)
  }

  return sections.join('\n\n')
}

/* ── copy button ───────────────────────────────────────── */
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button className="copy-btn" onClick={copy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

/* ── code block ────────────────────────────────────────── */
function CodeBlock({ title, code }) {
  return (
    <section className="code-section">
      <div className="code-header">
        <span className="code-title">{title}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="code-pre"><code>{code}</code></pre>
    </section>
  )
}

/* ── panel ─────────────────────────────────────────────── */
export default function CodePanel({ artboard, fileName }) {
  const setupCode     = buildSetupSnippet(artboard, fileName)
  const inputsCode    = buildInputsSnippet(artboard)
  const viewModelCode = buildViewModelSnippet(artboard)
  const textRunsCode  = buildTextRunsSnippet()

  return (
    <aside className="code-panel">
      <div className="code-panel-header">
        <span className="code-panel-title">Code React</span>
        <span className="code-panel-sub">@rive-app/react-canvas</span>
      </div>

      <div className="code-panel-body">
        <CodeBlock title="useRive — setup" code={setupCode} />
        {inputsCode && (
          <CodeBlock title="useStateMachineInput — boolean" code={inputsCode} />
        )}
        {viewModelCode && (
          <CodeBlock title="useViewModel — data binding" code={viewModelCode} />
        )}
        <CodeBlock title="Text Value Runs — dynamic text" code={textRunsCode} />
      </div>
    </aside>
  )
}
