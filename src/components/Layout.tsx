import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-600 hover:text-white'
    }`

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-800 shadow">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <span className="text-white font-bold text-lg tracking-tight">
              Batting Order Maker
            </span>
            <div className="flex gap-2">
              <NavLink to="/" end className={linkClass}>
                Games
              </NavLink>
              <NavLink to="/admin" className={linkClass}>
                Roster
              </NavLink>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
