import { useEffect } from 'react'
import { useRive } from '@rive-app/react-canvas'

// StateMachineInputType.Boolean = 59  (Number=56, Trigger=58)
const BOOL = 59

/**
 * Parse rive.contents into the artboard config array.
 * Called from RiveDiscoverer after file load, and exported for tests.
 */
export function parseContents(contents) {
  if (!contents?.artboards) return []

  return contents.artboards.map((ab, idx) => {
    // Prefer the SM that has boolean inputs; fall back to the first SM
    const smWithBools = ab.stateMachines?.find(sm =>
      sm.inputs?.some(i => i.type === BOOL)
    )
    const mainSM = smWithBools || ab.stateMachines?.[0] || null

    const boolInputs = mainSM?.inputs
      ?.filter(i => i.type === BOOL)
      .map(i => i.name) ?? []

    return {
      id:           `${ab.name}__${idx}`,
      label:        ab.name,
      stateMachine: mainSM?.name ?? null,
      ...(boolInputs.length ? { boolInputs } : {}),
    }
  })
}

/**
 * Enumerate all ViewModels defined in the .riv file.
 * DataType: none=0, string=1, number=2, boolean=3, color=4,
 *           list=5, enumType=6, trigger=7, viewModel=8
 */
export function parseViewModels(rive) {
  const count = rive.viewModelCount ?? 0
  const vms = []
  for (let i = 0; i < count; i++) {
    const vm = rive.viewModelByIndex(i)
    if (!vm) continue
    vms.push({
      name:          vm.name,
      instanceNames: vm.instanceNames ?? [],
      properties:    (vm.properties ?? []).map(p => ({ name: p.name, type: p.type })),
    })
  }
  return vms
}

/**
 * Invisible component — loads a .riv file on a 1×1 off-screen canvas,
 * reads rive.contents once loaded, and calls onDiscovered(config[]).
 */
export default function RiveDiscoverer({ src, onDiscovered }) {
  const { rive, RiveComponent } = useRive({ src, autoplay: false })

  useEffect(() => {
    if (!rive) return
    const artboards  = parseContents(rive.contents)
    const viewModels = parseViewModels(rive)
    onDiscovered(artboards.map(ab => ({ ...ab, viewModels })))
  }, [rive]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        bottom: 0, right: 0,
        width: 1, height: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <RiveComponent />
    </div>
  )
}
