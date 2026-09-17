import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function Layout() {
  return (
    <div className="min-h-full bg-surface">
      <Sidebar />
      <div className="pl-60">
        <Topbar />
        <main className="px-margin py-space-xl">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
