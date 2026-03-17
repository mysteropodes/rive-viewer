import { useState, useEffect } from 'react'
import { useRive, useStateMachineInput } from '@rive-app/react-canvas'

const STATE_MACHINE = 'default'

export default function SonalyzePage() {
  const [frEn, setFrEn] = useState(false)

  const { rive, RiveComponent } = useRive({
    src: '/sonalyse.riv',
    artboard: 'Sonalyze',
    stateMachines: STATE_MACHINE,
    autoplay: true,
  })

  const Fr_EnInput = useStateMachineInput(rive, STATE_MACHINE, 'Fr_En', false)

  // Sync input value whenever frEn changes
  useEffect(() => {
    if (Fr_EnInput) Fr_EnInput.value = frEn
  }, [Fr_EnInput, frEn])

  return (
    <div className="sonalyze-page">

      <div className="sonalyze-canvas-wrap">
        <RiveComponent className="sonalyze-canvas" />
      </div>

      <div className="sonalyze-bar">
        <span className="sonalyze-title">Sonalyze — sonalyse.riv</span>

        <button
          className={'sonalyze-toggle' + (frEn ? ' sonalyze-toggle--on' : '')}
          onClick={() => setFrEn(v => !v)}
          disabled={!rive}
        >
          <span className={'sonalyze-lang' + (!frEn ? ' sonalyze-lang--active' : '')}>FR</span>
          <span className="sonalyze-sep">/</span>
          <span className={'sonalyze-lang' + (frEn ? ' sonalyze-lang--active' : '')}>EN</span>
          <span className="sonalyze-badge">{frEn ? 'EN' : 'FR'}</span>
        </button>

        <code className="sonalyze-code">
          Fr_En = {frEn ? 'true' : 'false'}
        </code>
      </div>

    </div>
  )
}
