import { NavLink } from 'react-router-dom'
import { Icon } from './Icon'

const NAV = [
  { to: '/', label: 'Übersicht', icon: 'dashboard', end: true },
  { to: '/upload', label: 'Beleg hochladen', icon: 'upload_file' },
  { to: '/belege', label: 'Belege', icon: 'receipt_long' },
  { to: '/export', label: 'Export', icon: 'ios_share' },
  { to: '/einstellungen', label: 'Einstellungen', icon: 'settings' },
]

export function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 z-30 flex h-full w-60 flex-col justify-between border-r border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-sm">
            <Icon name="receipt_long" className="text-[20px]" />
          </div>
          <div>
            <span className="block text-headline-md font-bold tracking-tight text-primary">Belegio</span>
            <span className="block text-label-sm text-on-surface-variant">GoBD-konform &amp; Lokal</span>
          </div>
        </div>

        <NavLink
          to="/upload"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-3 py-2.5 text-label-md text-on-primary shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
        >
          <Icon name="upload_file" className="text-[18px]" />
          <span>Beleg hochladen</span>
        </NavLink>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-label-md transition-colors',
                  isActive
                    ? 'border-l-2 border-primary bg-secondary-container text-on-secondary-container'
                    : 'text-on-surface-variant hover:bg-surface-container-low',
                ].join(' ')
              }
            >
              <Icon name={item.icon} className="text-[20px]" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Privacy badge — the core product promise, per DESIGN.md */}
      <div className="flex items-center justify-center gap-1.5 rounded-full border border-[#0F766E20] bg-[#0F766E1A] px-3 py-1.5 text-label-sm text-primary-container">
        <Icon name="lock" className="text-[14px]" />
        <span>100 % lokal verarbeitet</span>
      </div>
    </aside>
  )
}
