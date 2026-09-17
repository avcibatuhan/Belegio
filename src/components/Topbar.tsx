import { Icon } from './Icon'

type TopbarProps = {
  /** Placeholder text for the global search field. */
  searchPlaceholder?: string
}

export function Topbar({ searchPlaceholder = 'Belege, Händler oder Beträge suchen…' }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-outline-variant bg-surface px-margin">
      <label className="relative flex-1 max-w-md">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant"
        />
        <input
          type="search"
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-10 pr-3 text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-[#0F766E26]"
        />
      </label>

      <div className="ml-auto flex items-center gap-2">
        <button className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low" title="Hilfe">
          <Icon name="help" />
        </button>
        <button className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low" title="Benachrichtigungen">
          <Icon name="notifications" />
        </button>
        <button className="flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-label-md text-on-surface transition-colors hover:bg-surface-container-low">
          <Icon name="ios_share" className="text-[18px]" />
          <span>Export</span>
        </button>

        <div className="ml-2 flex items-center gap-2 border-l border-outline-variant pl-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-label-sm font-semibold text-on-primary">
            BK
          </div>
          <div className="leading-tight">
            <span className="block text-label-sm font-medium text-on-surface">Batuhan K.</span>
            <span className="block text-label-sm text-on-surface-variant">Freiberufler</span>
          </div>
        </div>
      </div>
    </header>
  )
}
