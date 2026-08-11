import { NavLink } from 'react-router-dom'
import { Compass, Menu, X, Sun, Moon } from 'lucide-react'
import { NAV_ITEMS } from '../constants/navigation'
import { useTheme } from '../lib/useTheme'
import clsx from 'clsx'

/**
 * Sidebar is always visible as a fixed icon rail (w-20).
 * Tapping the compass logo expands it to w-64 as an overlay.
 * Collapses via the X button or clicking the backdrop.
 */
export default function Sidebar({ isExpanded, onExpand, onCollapse }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-brand-950/50 transition-opacity duration-200"
          onClick={onCollapse}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex h-dvh flex-col overflow-y-auto overflow-x-hidden border-r border-[#232d42] bg-[#121a2c] text-white transition-[width] duration-300 ease-in-out',
          isExpanded ? 'w-54' : 'w-0 sm:w-20'
        )}
      >
        <div className={clsx('flex items-center py-6', isExpanded ? 'justify-between px-4' : 'justify-center px-2')}>
          <button
            onClick={onExpand}
            className="flex items-center gap-2"
            aria-label="Expand sidebar"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              {isExpanded ? (
                <Compass className="h-5 w-5 text-white" />
              ) : (
                <Menu className="h-5 w-5 text-white" />
              )}
            </div>
            <div
              className={clsx(
                'overflow-hidden whitespace-nowrap text-left transition-all duration-300',
                isExpanded ? 'w-40 opacity-100' : 'w-0 opacity-0'
              )}
            >
              <p className="text-sm font-semibold tracking-tight">Managing Director</p>
              <p className="text-[11px] text-brand-400">Operations Console</p>
            </div>
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              title={!isExpanded ? label : undefined}
              className={({ isActive }) =>
                clsx(
                  'flex items-center overflow-hidden whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  !isExpanded && 'justify-center',
                  isActive
                    ? 'bg-accent-600 text-white'
                    : 'text-brand-400 hover:bg-brand-800 hover:text-white'
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={clsx(
                  'overflow-hidden transition-all duration-300',
                  isExpanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
                )}
              >
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle — replaces the version footer */}
        <div className={clsx('border-t border-brand-800 py-4', isExpanded ? 'px-3' : 'flex justify-center px-2')}>
          <button
            onClick={toggleTheme}
            className={clsx(
              'flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-brand-400 transition-colors duration-300 hover:bg-brand-700 hover:text-white',
              isExpanded ? 'w-full justify-between gap-3' : 'h-10 w-10 justify-center'
            )}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span className="flex items-center">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {isDark ? <Sun className="h-4 w-4 text-amber-400 opacity-100" />: <Moon className="h-4 w-4" /> }
              </span>
              <span
                className={clsx(
                  'overflow-hidden whitespace-nowrap transition-all duration-300 ease-in-out',
                  isExpanded ? 'w-24 opacity-100' : 'w-0 opacity-0'
                )}
              >
                Dark mode
              </span>
            </span>

            <span
              className={clsx(
                'relative flex h-6 shrink-0 items-center rounded-full transition-all duration-300',
                isExpanded ? 'w-11 opacity-100' : 'w-0 opacity-0',
                isDark ? 'bg-accent-600' : 'bg-brand-700'
              )}
            >
              <span
                className={clsx(
                  'absolute h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-300',
                  isDark ? 'translate-x-5.5' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>
        </div>
      </aside>
    </>
  )
}