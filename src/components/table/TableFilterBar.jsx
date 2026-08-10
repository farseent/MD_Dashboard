import { Search, RotateCcw } from 'lucide-react'

/**
 * search: string, onSearchChange: fn
 * filters: [{ key, label, options: string[] }]
 * values: { [key]: string }, onFilterChange: (key, value) => void
 */
export default function TableFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  values = {},
  onFilterChange,
  onReset,
  actions
}) {
    const hasActiveFilters =
    search?.trim() !== '' ||
    Object.entries(values).some(([key, v]) => {
      const filter = filters.find((f) => f.key === key)
      return filter && v && v !== 'All'
    })
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-surface-raised px-4 py-3">
      <div className="relative min-w-55 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-border-subtle bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>

      {filters.map((filter) => (
        <select
          key={filter.key}
          value={values[filter.key] ?? 'All'}
          onChange={(e) => onFilterChange(filter.key, e.target.value)}
          className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-fg focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
        >
          <option value="All">{filter.label}: All</option>
          {filter.options.map((opt) => {
            const optValue = typeof opt === 'object' ? opt.value : opt
            const optLabel = typeof opt === 'object' ? opt.label : opt
            return (
              <option key={optValue} value={optValue}>
                {optLabel}
              </option>
            )
          })}
        </select>
      ))}
    {actions && <div className="flex items-center rounded-lg  border-border-subtle bg-surface">{actions}</div>}
    
    {onReset && (
  <button
    type="button"
    onClick={onReset}
    title="Reset filters"
    className={`
      flex h-9 w-9 items-center justify-center rounded-lg border transition-colors
      ${hasActiveFilters 
        ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:text-accent-700 hover:scale-105' 
        : 'border-border-subtle bg-surface-2 text-fg-muted hover:border-primary/40 hover:bg-primary/10 hover:text-primary'
      }
    `}
  >
    <RotateCcw size={16} />
  </button>
)}
    </div>
  )
}