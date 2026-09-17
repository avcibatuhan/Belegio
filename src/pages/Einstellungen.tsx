import { Card, CardHeader } from '../components/Card'
import { Icon } from '../components/Icon'

/** Not part of the Stitch design set — a placeholder so the nav item resolves. */
export function Einstellungen() {
  return (
    <div className="mx-auto max-w-[900px] space-y-space-md">
      <div>
        <h1 className="text-headline-lg text-on-surface">Einstellungen</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">
          Stammdaten, Steuernummern und lokale Verarbeitung konfigurieren.
        </p>
      </div>

      <Card>
        <CardHeader title="Noch nicht gestaltet" subtitle="Für diesen Bereich liegt kein Stitch-Entwurf vor." />
        <div className="flex items-center gap-3 rounded-lg bg-surface-container-low p-4">
          <Icon name="draw" className="text-[20px] text-primary" />
          <p className="text-body-md text-on-surface-variant">
            Sag Bescheid, wenn ich diesen Screen in Stitch entwerfen soll — dann baue ich ihn wie die anderen nach.
          </p>
        </div>
      </Card>
    </div>
  )
}
