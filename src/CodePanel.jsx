import { useState } from 'react'

/* ── File name helpers ──────────────────────────────────── */
const stemOf  = f => f ? f.replace(/\.riv$/i, '') : 'animation'
const rawName = f => stemOf(f).toLowerCase().replace(/[^a-z0-9]+/g, '_')
const cap     = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s

/* ── Platform config ────────────────────────────────────── */
const PLATFORMS = [
  { id: 'react',   label: 'React',   sub: '@rive-app/react-canvas' },
  { id: 'flutter', label: 'Flutter', sub: 'package:rive'           },
  { id: 'swift',   label: 'Swift',   sub: 'RiveRuntime (SPM)'      },
  { id: 'kotlin',  label: 'Kotlin',  sub: 'app.rive:rive-android'  },
]

/* ══════════════════════════════════════════════════════════
   REACT snippets
══════════════════════════════════════════════════════════ */

// DataType enum — p.type from WASM is a string
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

const toVarName = s => s
  .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
  .replace(/^[A-Z]/, c => c.toLowerCase())
  .replace(/[^a-zA-Z0-9]/g, '')

function buildViewModelSnippet(artboard) {
  const vms = artboard.viewModels
  if (!vms?.length) return null

  const active = vms.filter(vm => vm.properties.some(p => VM_HOOK[p.type]) || vm.instanceNames.length)
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
    const props   = vm.properties.filter(p => VM_HOOK[p.type])
    const varBase = single ? 'vm' : toVarName(vm.name) || `vm${i}`
    const varVM   = single ? 'vm'         : `vm${cap(varBase)}`
    const varInst = single ? 'vmInstance' : `vmInstance${cap(varBase)}`
    const vmArg   = single ? '{ useDefault: true }' : `{ name: '${vm.name}' }`

    props.forEach(p => hooksUsed.add(VM_HOOK[p.type]))

    if (i > 0) lines.push('')
    if (vm.instanceNames.length)
      lines.push(`// instances: ${vm.instanceNames.join(', ')}`)

    lines.push(
      `// ViewModel : "${vm.name}"`,
      `const ${varVM} = useViewModel(rive, ${vmArg})`,
      `const ${varInst} = useViewModelInstance(${varVM}, { rive, useDefault: true })`,
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
  if (boolDecls.length || trigDecls.length)
    sections.push(`// — Declare inputs (after useRive) ——————————\n${[...boolDecls, ...trigDecls].join('\n\n')}`)
  if (boolUsage.length)
    sections.push(`// — Boolean toggle (onClick) ————————————————\n${boolUsage.join('\n')}`)
  if (triggerUsage.length)
    sections.push(`// — Fire trigger (onClick) ——————————————————\n${triggerUsage.join('\n')}`)

  return sections.join('\n\n')
}

/* ══════════════════════════════════════════════════════════
   FLUTTER snippets  (rive ^0.14.x — RiveWidget + RiveWidgetController)
══════════════════════════════════════════════════════════ */
function buildFlutterPubspecSnippet(fileName) {
  const src = `assets/${fileName ?? 'animation.riv'}`
  return [
    `# pubspec.yaml`,
    `dependencies:`,
    `  rive: ^0.14.6`,
    ``,
    `flutter:`,
    `  assets:`,
    `    - ${src}`,
  ].join('\n')
}

function buildFlutterSetupSnippet(artboard, fileName) {
  const src      = `assets/${fileName ?? 'animation.riv'}`
  const sm       = artboard.stateMachine
  const bools    = artboard.boolInputs    ?? []
  const triggers = artboard.triggerInputs ?? []
  const numbers  = artboard.numberInputs  ?? []
  const hasInputs = bools.length > 0 || triggers.length > 0 || numbers.length > 0
  const smSel    = sm
    ? `      stateMachineSelector: StateMachineNamed('${sm}'),`
    : `      // pas de State Machine → StateMachineDefault()`

  const L = []
  L.push(`import 'package:rive/rive.dart';`)
  L.push(``)
  L.push(`class MyWidget extends StatefulWidget {`)
  L.push(`  const MyWidget({super.key});`)
  L.push(`  @override`)
  L.push(`  State<MyWidget> createState() => _MyWidgetState();`)
  L.push(`}`)
  L.push(``)
  L.push(`class _MyWidgetState extends State<MyWidget> {`)
  L.push(`  RiveWidgetController? _ctrl;`)
  if (hasInputs) {
    bools.forEach(n    => L.push(`  BooleanInput?  _${n};`))
    triggers.forEach(n => L.push(`  TriggerInput?  _${n};`))
    numbers.forEach(n  => L.push(`  NumberInput?   _${n};`))
  }
  L.push(``)
  L.push(`  @override`)
  L.push(`  void initState() {`)
  L.push(`    super.initState();`)
  L.push(`    _load();`)
  L.push(`  }`)
  L.push(``)
  L.push(`  Future<void> _load() async {`)
  L.push(`    final file = await File.asset('${src}',`)
  L.push(`      riveFactory: Factory.rive,`)
  L.push(`    );`)
  L.push(`    if (file == null || !mounted) return;`)
  L.push(`    final ctrl = RiveWidgetController(file,`)
  L.push(`      artboardSelector: ArtboardNamed('${artboard.label}'),`)
  L.push(`${smSel}`)
  L.push(`    );`)
  if (hasInputs) {
    L.push(`    final s = ctrl.stateMachine;`)
    bools.forEach(n    => L.push(`    _${n} = s.boolean('${n}');`))
    triggers.forEach(n => L.push(`    _${n} = s.trigger('${n}');`))
    numbers.forEach(n  => L.push(`    _${n} = s.number('${n}');`))
  }
  L.push(`    setState(() => _ctrl = ctrl);`)
  L.push(`  }`)
  L.push(``)
  L.push(`  @override`)
  L.push(`  void dispose() {`)
  L.push(`    _ctrl?.dispose();`)
  L.push(`    super.dispose();`)
  L.push(`  }`)
  L.push(``)
  L.push(`  @override`)
  L.push(`  Widget build(BuildContext context) {`)
  L.push(`    final ctrl = _ctrl;`)
  L.push(`    if (ctrl == null) return const CircularProgressIndicator();`)
  L.push(`    return RiveWidget(controller: ctrl, fit: Fit.contain);`)
  L.push(`  }`)
  L.push(`}`)

  return L.join('\n')
}

function buildFlutterInputsSnippet(artboard) {
  const bools    = artboard.boolInputs    ?? []
  const triggers = artboard.triggerInputs ?? []
  const numbers  = artboard.numberInputs  ?? []
  if (!bools.length && !triggers.length && !numbers.length) return null

  const L = []
  if (bools.length) {
    L.push(`// — Boolean ————————————————————————————————`)
    bools.forEach(n => L.push(`_${n}?.value = !(_${n}?.value ?? false);`))
  }
  if (triggers.length) {
    if (L.length) L.push(``)
    L.push(`// — Trigger —————————————————————————————————`)
    triggers.forEach(n => L.push(`_${n}?.fire();`))
  }
  if (numbers.length) {
    if (L.length) L.push(``)
    L.push(`// — Number (0–100) ——————————————————————————`)
    numbers.forEach(n => L.push(`_${n}?.value = 50.0;`))
  }
  return L.join('\n')
}

/* ══════════════════════════════════════════════════════════
   SWIFT snippets
══════════════════════════════════════════════════════════ */
function buildSwiftSetupSnippet(artboard, fileName) {
  const stem     = stemOf(fileName)
  const sm       = artboard.stateMachine
  const L = []
  L.push(`import SwiftUI`)
  L.push(`import RiveRuntime`)
  L.push(``)
  L.push(`// Swift Package Manager :`)
  L.push(`// https://github.com/rive-app/rive-ios`)
  L.push(`// Ajouter "${stem}.riv" dans le bundle Xcode`)
  L.push(``)
  L.push(`struct ContentView: View {`)
  L.push(`  @StateObject var vm = RiveViewModel(`)
  L.push(`    fileName: "${stem}",`)
  if (artboard.label) L.push(`    artboardName: "${artboard.label}",`)
  if (sm) L.push(`    stateMachineName: "${sm}"`)
  L.push(`  )`)
  L.push(``)
  L.push(`  var body: some View {`)
  L.push(`    vm.view()`)
  L.push(`  }`)
  L.push(`}`)
  return L.join('\n')
}

function buildSwiftInputsSnippet(artboard) {
  const bools    = artboard.boolInputs    ?? []
  const triggers = artboard.triggerInputs ?? []
  if (!bools.length && !triggers.length) return null

  const L = []
  if (bools.length) {
    L.push(`// — Boolean inputs ————————————————————————`)
    bools.forEach(n => {
      L.push(`vm.setInput("${n}", value: true)  // ou false`)
    })
  }
  if (triggers.length) {
    if (L.length) L.push(``)
    L.push(`// — Triggers ——————————————————————————————`)
    triggers.forEach(n => L.push(`vm.triggerInput("${n}")`))
  }
  return L.join('\n')
}

/* ══════════════════════════════════════════════════════════
   KOTLIN snippets
══════════════════════════════════════════════════════════ */
function buildKotlinSetupSnippet(artboard, fileName) {
  const raw = rawName(fileName)
  const sm  = artboard.stateMachine
  const L = []
  L.push(`// build.gradle (app) :`)
  L.push(`// implementation 'app.rive:rive-android:9.+'`)
  L.push(`// Placer "${fileName ?? 'animation.riv'}" dans res/raw/`)
  L.push(``)
  L.push(`// ── Layout XML ──────────────────────────────`)
  L.push(`<app.rive.runtime.kotlin.RiveAnimationView`)
  L.push(`    android:id="@+id/rive"`)
  L.push(`    android:layout_width="match_parent"`)
  L.push(`    android:layout_height="wrap_content"`)
  L.push(`    app:riveResource="@raw/${raw}"`)
  if (artboard.label) L.push(`    app:riveArtboard="${artboard.label}"`)
  if (sm)             L.push(`    app:riveStateMachineName="${sm}"`)
  L.push(`    app:riveAutoPlay="true" />`)
  L.push(``)
  L.push(`// ── Activity / Fragment ─────────────────────`)
  L.push(`val rive = findViewById<RiveAnimationView>(R.id.rive)`)
  return L.join('\n')
}

function buildKotlinInputsSnippet(artboard) {
  const sm       = artboard.stateMachine
  const bools    = artboard.boolInputs    ?? []
  const triggers = artboard.triggerInputs ?? []
  if (!bools.length && !triggers.length) return null

  const L = []
  if (bools.length) {
    L.push(`// — Boolean inputs ————————————————————————`)
    bools.forEach(n => L.push(`rive.setInputState("${sm}", "${n}", true)`))
  }
  if (triggers.length) {
    if (L.length) L.push(``)
    L.push(`// — Triggers ——————————————————————————————`)
    triggers.forEach(n => L.push(`rive.fireState("${sm}", "${n}")`))
  }
  return L.join('\n')
}

/* ══════════════════════════════════════════════════════════
   UI components
══════════════════════════════════════════════════════════ */
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
      {copied ? '✓ Copié' : 'Copy'}
    </button>
  )
}

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

/* ── Panel ──────────────────────────────────────────────── */
export default function CodePanel({ artboard, fileName }) {
  const [platform, setPlatform] = useState('react')
  const plat = PLATFORMS.find(p => p.id === platform)

  let blocks = []

  if (platform === 'react') {
    const setupCode     = buildSetupSnippet(artboard, fileName)
    const inputsCode    = buildInputsSnippet(artboard)
    const viewModelCode = buildViewModelSnippet(artboard)
    const textRunsCode  = buildTextRunsSnippet()
    blocks = [
      { title: 'useRive — setup',              code: setupCode     },
      inputsCode    && { title: 'useStateMachineInput — inputs',    code: inputsCode    },
      viewModelCode && { title: 'useViewModel — data binding',      code: viewModelCode },
      { title: 'Text Value Runs — dynamic text', code: textRunsCode },
    ].filter(Boolean)
  }

  if (platform === 'flutter') {
    const pubspecCode = buildFlutterPubspecSnippet(fileName)
    const setupCode   = buildFlutterSetupSnippet(artboard, fileName)
    const inputCode   = buildFlutterInputsSnippet(artboard)
    blocks = [
      { title: 'pubspec.yaml',          code: pubspecCode },
      { title: 'Widget — setup',        code: setupCode   },
      inputCode && { title: 'Contrôler les inputs', code: inputCode },
    ].filter(Boolean)
  }

  if (platform === 'swift') {
    const setupCode  = buildSwiftSetupSnippet(artboard, fileName)
    const inputCode  = buildSwiftInputsSnippet(artboard)
    blocks = [
      { title: 'RiveViewModel — setup (SwiftUI)', code: setupCode },
      inputCode && { title: 'Contrôler les inputs', code: inputCode },
    ].filter(Boolean)
  }

  if (platform === 'kotlin') {
    const setupCode  = buildKotlinSetupSnippet(artboard, fileName)
    const inputCode  = buildKotlinInputsSnippet(artboard)
    blocks = [
      { title: 'RiveAnimationView — setup (XML + Kotlin)', code: setupCode },
      inputCode && { title: 'Contrôler les inputs',        code: inputCode },
    ].filter(Boolean)
  }

  return (
    <aside className="code-panel">
      <div className="code-panel-header">
        <div className="platform-tabs">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              className={'platform-tab' + (platform === p.id ? ' platform-tab--active' : '')}
              onClick={() => setPlatform(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="code-panel-sub">{plat.sub}</span>
      </div>

      <div className="code-panel-body">
        {blocks.map(b => <CodeBlock key={b.title} title={b.title} code={b.code} />)}
      </div>
    </aside>
  )
}
