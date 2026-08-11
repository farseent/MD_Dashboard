import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Wallet, Layers, MapPin, TrendingUp, TrendingDown, Plus, Pencil } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

import AddExpenseModal from './components/AddExpenseModal'
import { LOCATION_MODEL_OPTIONS, FREQUENCY_OPTIONS } from './components/expenseOptions'

import KpiCard from '../../components/kpi/KpiCard'
import ChartWrapper from '../../components/charts/ChartWrapper'
import TableFilterBar from '../../components/table/TableFilterBar'
import ChartTooltip from '../../components/charts/ChartTooltip'
import DataTable from '../../components/table/DataTable'

import { KpiCardSkeleton, ChartSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { formatCurrency } from '../../lib/formatters'
import { buildCategoryColorMap, getCategoryColor } from '../../lib/chartColors'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

import {
  createExpense,
  getExpense,
  getExpenseCategories,
  getExpenseStatsSummary,
  getMonthlyExpensesByCategory,
  getExpenseCategoryShare,
  getExpenseTrend,
  updateExpense,
  updateExpenseStatus
} from '../../api/expenseAPI'

const emptySummary = {
  totalThisMonth: 0,
  totalLastMonth: 0,
  trendPercent: 0,
  largestCategory: { name: '-', amount: 0 },
  topLocation: { name: '-', locationModel: '', amount: 0 },
}

export default function ExpensesPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 400)
  const abortControllerRef = useRef(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [locationFilter, setLocationFilter] = useState('All')
  const [frequencyFilter, setFrequencyFilter] = useState('All')
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [loadingExpenses, setLoadingExpenses] = useState(true)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({})
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  
  // Analytics state
  const [summary, setSummary] = useState(emptySummary)
  const [monthlyByCategory, setMonthlyByCategory] = useState([])
  const [categoryShare, setCategoryShare] = useState([])
  const [expenseTrend, setExpenseTrend] = useState([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    fetchExpenses()
  }, [page, debouncedSearch, categoryFilter, locationFilter, frequencyFilter, sortKey, sortDir])
  
  // Categories: fetch once
  useEffect(() => {
    fetchExpenseCategories()
  }, [])

  useEffect(() => {
    fetchStats()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, categoryFilter, locationFilter, frequencyFilter])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const RECEIPTS_PAGE_SIZE = 5
  const fetchExpenses = async () => {
    // Cancel whatever request is still in flight — its response would be stale anyway
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      setLoadingExpenses(true)

      const params = { page, limit: RECEIPTS_PAGE_SIZE }

      if (debouncedSearch) params.search = debouncedSearch
      if (categoryFilter !== 'All') params.category = categoryFilter
      if (locationFilter !== 'All') params.locationModel = locationFilter
      if (frequencyFilter !== 'All') params.frequency = frequencyFilter

      const sortFieldMap = {
        category: 'category.name',
        branchOrFranchise: 'branchOrFranchise.branchName',
      }

      if (sortKey) {
        params.sortField = sortFieldMap[sortKey] || sortKey
        params.sortOrder = sortDir
      }

      const response = await getExpense(params, controller.signal)

      if (response.success) {
        const dataWithId = response.data.map(e => ({ ...e, id: e._id }))
        setExpenses(dataWithId)
        setPagination(response.pagination)
      }
    } catch (err) {
      if (err.code === 'ERR_CANCELED') {
        // Expected — a newer request superseded this one, nothing to do
        return
      }
      console.error("Failed to fetch expenses", err)
    } finally {
      // Only clear the loading state if this request is still the current one.
      // If it was aborted, a newer fetch's own `finally` already owns that job.
      if (abortControllerRef.current === controller) {
        setLoadingExpenses(false)
      }
    }
  }

  const fetchStats = async () => {
    try {
      setLoadingStats(true)
      setStatsError('')

      const [summaryRes, monthlyRes, shareRes, trendRes] = await Promise.all([
        getExpenseStatsSummary(),
        getMonthlyExpensesByCategory(4),
        getExpenseCategoryShare(),
        getExpenseTrend(6),
      ])

      setSummary(summaryRes.data || emptySummary)
      setMonthlyByCategory(monthlyRes.data || [])
      setCategoryShare(shareRes.data || [])
      setExpenseTrend(trendRes.data || [])
    } catch (err) {
      console.error("Failed to fetch expense stats:", err)
      setStatsError('Failed to load analytics.')
    } finally {
      setLoadingStats(false)
    }
  }

  const fetchExpenseCategories = async () => {
    try {
      const response = await getExpenseCategories()
      setCategories(response.data || response)
    } catch (error) {
      console.error("Failed to fetch expense categories:", error)
      return []
    }
  }

  const handleCreateExpense = async (expenseData) => {
    try {
      await createExpense(expenseData)
      await Promise.all([fetchExpenses(), fetchStats()])
    } catch (error) {
      console.error("Failed to create expense:", error)
      throw error
    }
  }

  const handleUpdateExpense = async (id, expenseData) => {
    try {
      await updateExpense(id, expenseData)

      // Refresh table + analytics so KPIs/charts reflect the edit
      await Promise.all([fetchExpenses(), fetchStats()])
    } catch (error) {
      console.error("Failed to update expense:", error)
      throw error
    }
  }

  const handleStatusChange = async (id, status) => {
    try {
      await updateExpenseStatus(id, status)

      // Optimistic UI update (fast UX)
      setExpenses(prev =>
        prev.map(e => (e.id === id ? { ...e, status } : e))
      )
    } catch (error) {
      console.error("Failed to update status", error)
    }
  }

  const handleEditClick = useCallback((expense) => {
    setEditingExpense(expense)
    setIsAddModalOpen(true)
  }, [])

  const handleAddClick = useCallback(() => {
    setEditingExpense(null)
    setIsAddModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsAddModalOpen(false)
    setEditingExpense(null)
  }, [])

  const handleCategoriesChange = useCallback((freshCategories) => {
    setCategories(freshCategories)
  }, [])

  const handleSortChange = useCallback((key, dir) => {
    setSortKey(key)
    setSortDir(dir)
    setPage(1)
  }, [])

  const handleResetFilters = useCallback(() => {
    setSearch('')
    setCategoryFilter('All')
    setLocationFilter('All')
    setFrequencyFilter('All')
  }, [])

  const columns = useMemo(() => [
    { key: 'expenseName', label: 'Expense', sortable: true },
    { key: 'category', label: 'Category', sortable: true, render: (r) => r.category?.name || '-' },
    { key: 'branchOrFranchise', label: 'Location', sortable: true, render: (r) => r.branchOrFranchise?.branchName || r.branchOrFranchise?.franchiseeName || "-" },
    { key: 'locationModel', label: 'Type', sortable: true },
    { key: 'frequency', label: 'Frequency', sortable: true },
    { key: 'amount', label: 'Amount', sortable: true, render: (r) => formatCurrency(r.amount) },
    { key: 'expenseDate', label: 'Date', sortable: true, render: (r) => new Date(r.expenseDate).toLocaleDateString('en-IN') },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (r) => {
        const isPaid = r.status === 'paid'

        return (
          <select
            value={r.status || 'pending'} 
            onChange={(e) => handleStatusChange(r.id, e.target.value)}
            className={`px-2 py-1 rounded-md text-xs font-medium border
              ${isPaid 
                ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700' 
                : 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700'
              }`}
          >
            <option value="unpaid" className="bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Unpaid
            </option>
            <option value="partially_paid" className="bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Partially Paid
            </option>
            <option value="paid" className="bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Paid
            </option>
          </select>
        )
      }
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      align: 'right',
      render: (r) => (
        <button
          type="button"
          onClick={() => handleEditClick(r)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-accent-600 px-3 py-1.5 text-sm font-medium text-white transition-all hover:text-accent-700 hover:scale-105"
          title="Edit expense"
        >
          <Pencil size={14} />
          <span>Edit</span>
        </button>
      ),
    },
  ], [handleEditClick])

  // Category keys for the stacked bar chart are derived from whatever
  // categories actually appear in the response — not hardcoded, since
  // real category names (Fuel, Electricity, etc.) vary per company.
  const categoryKeys = useMemo(() => {
    const totals = {}
    monthlyByCategory.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== 'month') {
          totals[k] = (totals[k] || 0) + (row[k] || 0)
        }
      })
    })
    return Object.keys(totals).sort((a, b) => totals[b] - totals[a])
  }, [monthlyByCategory])

  const tooltipOrder = useMemo(() => {
    return [...categoryKeys].reverse()
  }, [categoryKeys])
  
  const categoryColorMap = useMemo(() => {
    const totals = categoryShare.map(c => ({ name: c.name, total: c.value }))
    return buildCategoryColorMap(totals)
  }, [categoryShare])

  const MAX_SLICES = 7
  const pieData = useMemo(() => {
    if (categoryShare.length <= MAX_SLICES) return categoryShare
    const sorted = [...categoryShare].sort((a, b) => b.value - a.value)
    const top = sorted.slice(0, MAX_SLICES)
    const rest = sorted.slice(MAX_SLICES)
    const otherTotal = rest.reduce((sum, c) => sum + c.value, 0)
    return otherTotal > 0 ? [...top, { name: 'Other', value: otherTotal }] : top
  }, [categoryShare])

  // Category filter still needs real names, sourced from the categories
  // state (not the current page of expenses).
  const categoryOptions = useMemo(
    () => categories.map((c) => c.name).filter(Boolean),
    [categories]
  )

  // Location & frequency are fixed enums — same source of truth AddExpenseModal uses.
  const locationOptions = useMemo(() => LOCATION_MODEL_OPTIONS, [])
  const frequencyOptions = useMemo(() => FREQUENCY_OPTIONS, [])

  const trendDirection = summary.trendPercent >= 0 ? 'up' : 'down'
  const trendIcon = trendDirection === 'up' ? TrendingUp : TrendingDown
  const trendValue = `${summary.trendPercent >= 0 ? '+' : ''}${summary.trendPercent.toFixed(1)}%`

  const trendData = useMemo(() => ({
    direction: trendDirection,
    value: trendValue,
    tone: trendDirection === 'up' ? 'negative' : 'positive',
  }), [trendDirection, trendValue])

  const barChartElement = useMemo(() => (
    <BarChart data={monthlyByCategory}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ee" vertical={false} />
      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b84a8" />
      <YAxis tick={{ fontSize: 12 }} stroke="#6b84a8" />
      <ChartTooltip formatter={(v) => formatCurrency(v)} order={tooltipOrder} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      {categoryKeys.map((key, i) => (
        <Bar
          key={key}
          dataKey={key}
          stackId="a"
          fill={getCategoryColor(categoryColorMap, key)}
          radius={i === categoryKeys.length - 1 ? [6, 6, 0, 0] : 0}
        />
      ))}
    </BarChart>
  ), [monthlyByCategory, categoryKeys, tooltipOrder, categoryColorMap])

  const pieChartElement = useMemo(() => (
    <PieChart>
      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2} stroke="none">
        {pieData.map((entry, i) => (
          <Cell key={i} fill={getCategoryColor(categoryColorMap, entry.name)} />
        ))}
      </Pie>
      <ChartTooltip formatter={(v) => formatCurrency(v)} />
      <Legend wrapperStyle={{ fontSize: 11 }} />
    </PieChart>
  ), [pieData, categoryColorMap])

  const lineChartElement = useMemo(() => (
    <LineChart data={expenseTrend}>
      <CartesianGrid strokeDasharray="3 3" stroke="#e5e8ee" vertical={false} />
      <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b84a8" />
      <YAxis tick={{ fontSize: 12 }} stroke="#6b84a8" />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <ChartTooltip formatter={(v) => formatCurrency(v)} />
      <Line type="monotone" dataKey="value" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
    </LineChart>
  ), [expenseTrend])

  return (
    <div className="space-y-6">
      {statsError && (
        <p className="rounded-md border border-negative-100 bg-negative-50 px-3 py-2 text-xs text-negative-600">
          {statsError}
        </p>
      )}

      {/* KPI Cards */}
      {loadingStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total Expense This Month" value={formatCurrency(summary.totalThisMonth)} icon={Wallet} subtext="all categories"  />
          <KpiCard label="Largest Category" value={summary.largestCategory.name} icon={Layers} subtext={formatCurrency(summary.largestCategory.amount)} />
          <KpiCard label="Top Spending Location" value={summary.topLocation.name} icon={MapPin} subtext={formatCurrency(summary.topLocation.amount)} />
          <KpiCard label="Expense Trend" value={trendValue} icon={trendIcon} trend={trendData} subtext="vs last month" />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartWrapper title="Monthly Expenses by Category" subtitle="Last 4 months, stacked">
            {loadingStats ? <ChartSkeleton /> : barChartElement}
          </ChartWrapper>
        </div>

        <ChartWrapper title="Category Share" subtitle="Of total spend">
          {loadingStats ? <ChartSkeleton /> : pieChartElement }
        </ChartWrapper>
      </div>

      <ChartWrapper title="Expense Trend" subtitle="Last 6 months — spot the spikes" height={240}>
        {loadingStats ? <ChartSkeleton /> : lineChartElement }
      </ChartWrapper>

      {/* Table */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg">Expense Log</h3>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-all hover:scale-105"
        >
          <Plus size={16} />
          Add Expense
        </button>
      </div>
      <TableFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search expenses..."
        filters={[
          { key: 'category', label: 'Category', options: categoryOptions },
          { key: 'locationModel', label: 'Location', options: locationOptions },
          { key: 'frequency', label: 'Frequency', options: frequencyOptions },
        ]}
        values={{
          category: categoryFilter,
          locationModel: locationFilter,
          frequency: frequencyFilter,
        }}
        onFilterChange={(key, value) => {
          if (key === 'category') setCategoryFilter(value)
          if (key === 'locationModel') setLocationFilter(value)
          if (key === 'frequency') setFrequencyFilter(value)
        }}
        onReset={handleResetFilters}
      />
      <DataTable
        columns={columns}
        rows={expenses}
        pageSize={RECEIPTS_PAGE_SIZE}
        page={page}
        totalPages={pagination.totalPages}
        totalCount={pagination.total}
        onPageChange={setPage}
        loading={loadingExpenses}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        serverPagination
      />
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onCreate={handleCreateExpense}
        onUpdate={handleUpdateExpense}
        categories={categories}
        expenseToEdit={editingExpense}
        onCategoriesChange={handleCategoriesChange}
      />
    </div>
  )
}