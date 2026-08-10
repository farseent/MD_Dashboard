import { useEffect, useState } from 'react'
import Select from 'react-select'
import CreatableSelect from 'react-select/creatable'
import { X, Settings2, Plus, IndianRupee, Tag, Calendar, MapPin, FileText } from 'lucide-react'
import Modal from '../../../components/modal/Modal'
import ManageCategoriesModal from './ManageCategoriesModal'
import { getBranchOrFranchise, createExpenseCategory, getExpenseCategories } from '../../../api/expenseAPI'
import { LOCATION_MODEL_OPTIONS, FREQUENCY_OPTIONS } from './expenseOptions'

// Local YYYY-MM-DD (avoids UTC off-by-one you'd get from toISOString())
const getTodayDateString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const initialForm = {
  expenseName: '',
  locationModel: LOCATION_MODEL_OPTIONS[0],
  branchOrFranchise: null,
  category: null,
  frequency: FREQUENCY_OPTIONS[2], // Monthly
  amount: '',
  date: getTodayDateString(),
  notes: '',
}

// Converts a raw expense document (from getExpense/getExpenseById) into
// the select-option shape this form uses. Handles the Branch/Franchisee
// naming split (branchName vs franchiseeName) the same way the table does.
const mapExpenseToForm = (expense) => {
  if (!expense) return initialForm

  const locationModel =
    LOCATION_MODEL_OPTIONS.find((o) => o.value === expense.locationModel) || LOCATION_MODEL_OPTIONS[0]

  const branchOrFranchise = expense.branchOrFranchise
    ? {
        value: expense.branchOrFranchise._id,
        label:
          expense.branchOrFranchise.branchName ||
          expense.branchOrFranchise.franchiseeName ||
          expense.branchOrFranchise.name ||
          '',
      }
    : null

  const category = expense.category
    ? { value: expense.category._id, label: expense.category.name }
    : null

  const frequency = FREQUENCY_OPTIONS.find((o) => o.value === expense.frequency) || FREQUENCY_OPTIONS[2]
  const date = expense.expenseDate ? String(expense.expenseDate).slice(0, 10) : getTodayDateString()

  return {
    expenseName: expense.expenseName || '',
    locationModel,
    branchOrFranchise,
    category,
    frequency,
    amount: expense.amount != null ? String(expense.amount) : '',
    date,
    notes: expense.notes || '',
  }
}

export default function AddExpenseModal({
  isOpen,
  onClose,
  onCreate,
  onUpdate,
  categories = [],
  expenseToEdit = null,
  onCategoriesChange
}) {
  const isEditMode = Boolean(expenseToEdit)

  const [form, setForm] = useState(initialForm)
  const [locationOptions, setLocationOptions] = useState([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [localCategories, setLocalCategories] = useState(categories)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Prefill from the expense being edited, or reset to blank for a new one
  useEffect(() => {
    if (isOpen) {
      setForm(mapExpenseToForm(expenseToEdit))
      setErrors({})
      setSubmitError('')
    }
  }, [isOpen, expenseToEdit])

  // Keep local categories in sync with whatever the parent passes in
  useEffect(() => {
    setLocalCategories(categories)
  }, [categories])

  // Derive select options from local categories (kept separate so
  // create/edit flows can update localCategories without waiting on props)
  useEffect(() => {
    setCategoryOptions(localCategories.map((c) => ({ value: c._id, label: c.name })))
  }, [localCategories])

  // Fetches locations for the currently selected location type. In edit
  // mode the prefilled branchOrFranchise value is kept as-is even before
  // this resolves — react-select just needs { value, label }, it doesn't
  // require the value to already exist in `options`.
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const fetchLocations = async () => {
      try {
        setLoadingLocations(true)
        const response = await getBranchOrFranchise(form.locationModel.value)
        if (cancelled) return
        const opts = (response.branchesOrFranchises || []).map((loc) => ({
          value: loc._id,
          label: loc.name,
        }))
        setLocationOptions(opts)
      } catch (err) {
        console.error('Failed to fetch locations:', err)
        if (!cancelled) setLocationOptions([])
      } finally {
        if (!cancelled) setLoadingLocations(false)
      }
    }

    fetchLocations()
    return () => {
      cancelled = true
    }
  }, [isOpen, form.locationModel])

  const handleTextChange = (field) => (e) => {
    const value = e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSelectChange = (field) => (option) => {
    setForm((prev) => ({
      ...prev,
      [field]: option,
      ...(field === 'locationModel' ? { branchOrFranchise: null } : {}),
    }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // Fires when the user types a name that doesn't match an existing
  // category and presses enter / clicks "Create ...".
  const handleCreateCategory = async (inputValue) => {
    const name = inputValue.trim()
    if (!name) return

    try {
      setCreatingCategory(true)
      const res = await createExpenseCategory({ name })

      // ⚠️ Adjust this line to match your actual API response shape —
      // assuming it returns the created category similar to
      // getExpenseCategories items: { _id, name }.
      const created = res.data ?? res.category ?? res

      setLocalCategories((prev) => [...prev, created])
      setForm((prev) => ({ ...prev, category: { value: created._id, label: created.name } }))
      setErrors((prev) => ({ ...prev, category: undefined }))
    } catch (err) {
      console.error('Failed to create category:', err)
      setSubmitError(
        err?.response?.data?.message || 'Failed to create category. Please try again.'
      )
    } finally {
      setCreatingCategory(false)
    }
  }

  // Called after ManageCategoriesModal edits a category, so this modal's
  // dropdown reflects renamed categories without needing to reopen it.
  const refreshCategories = async () => {
    try {
      const response = await getExpenseCategories()
      const fresh = response.data || response
      setLocalCategories(fresh)
      onCategoriesChange?.(fresh) 

      // If the currently selected category was renamed, sync its label too
      setForm((prev) => {
        if (!prev.category) return prev
        const updated = fresh.find((c) => c._id === prev.category.value)
        if (!updated || updated.name === prev.category.label) return prev
        return { ...prev, category: { value: updated._id, label: updated.name } }
      })
    } catch (err) {
      console.error('Failed to refresh categories:', err)
    }
  }

  const validate = () => {
    const next = {}
    if (!form.expenseName.trim()) next.expenseName = 'Expense name is required'
    if (!form.branchOrFranchise)
      next.branchOrFranchise = `Select a ${form.locationModel.label.toLowerCase()}`
    if (!form.category) next.category = 'Select a category'
    if (!form.amount || Number(form.amount) <= 0) next.amount = 'Enter a valid amount'
    if (!form.date) next.date = 'Select a date'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    if (!validate()) return

    const payload = {
      expenseName: form.expenseName.trim(),
      branchOrFranchise: form.branchOrFranchise.value,
      locationModel: form.locationModel.value,
      category: form.category.value,
      frequency: form.frequency.value,
      amount: Number(form.amount),
      expenseDate: form.date,
      notes: form.notes.trim(),
    }

    try {
      setIsSubmitting(true)
      if (isEditMode) {
        await onUpdate(expenseToEdit._id, payload)
      } else {
        await onCreate(payload)
      }
      onClose()
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message ||
          `Failed to ${isEditMode ? 'update' : 'create'} expense. Please try again.`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Custom select styles for dark mode support
  const selectStyles = {
    control: (base) => ({
      ...base,
      backgroundColor: 'var(--color-surface)',
      borderColor: 'var(--color-border-subtle)',
      color: 'var(--color-fg)',
      '&:hover': {
        borderColor: 'var(--color-border-subtle)',
      },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-surface-raised)',
      borderColor: 'var(--color-border-subtle)',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? 'var(--color-surface)' : 'transparent',
      color: 'var(--color-fg)',
      '&:active': {
        backgroundColor: 'var(--color-surface)',
      },
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--color-fg)',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--color-fg-subtle)',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--color-fg)',
    }),
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? 'Edit Expense' : 'Add New Expense'} size="2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Expense Name with icon */}
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1.5" htmlFor="expenseName">
              Expense Name
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                <FileText size={18} />
              </div>
              <input
                id="expenseName"
                type="text"
                className="w-full rounded-xl border border-border-subtle bg-surface pl-10 pr-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-all focus:border-accent-500 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                placeholder="e.g. Office rent"
                value={form.expenseName}
                onChange={handleTextChange('expenseName')}
              />
            </div>
            {errors.expenseName && (
              <p className="mt-1.5 text-sm text-negative-500 flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-negative-500" />
                {errors.expenseName}
              </p>
            )}
          </div>

          {/* Location Type & Branch/Franchise */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-fg-subtle" />
                  Location Type
                </div>
              </label>
              <Select
                unstyled
                styles={selectStyles}
                classNames={{
                  control: () => 'w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-fg transition-all focus:border-accent-500 focus:bg-surface-raised focus:ring-2 focus:ring-accent-500/20',
                  menu: () => 'mt-1 rounded-xl border border-border-subtle bg-surface-raised shadow-lg overflow-hidden',
                  option: () => 'px-4 py-2.5 text-sm hover:bg-surface cursor-pointer text-fg',
                }}
                options={LOCATION_MODEL_OPTIONS}
                value={form.locationModel}
                onChange={handleSelectChange('locationModel')}
                isSearchable={false}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">
                {form.locationModel.label}
              </label>
              <Select
                unstyled
                styles={selectStyles}
                classNames={{
                  control: () => 'w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-fg transition-all focus:border-accent-500 focus:bg-surface-raised focus:ring-2 focus:ring-accent-500/20',
                  menu: () => 'mt-1 rounded-xl border border-border-subtle bg-surface-raised shadow-lg overflow-hidden',
                  option: () => 'px-4 py-2.5 text-sm hover:bg-surface cursor-pointer text-fg',
                }}
                options={locationOptions}
                value={form.branchOrFranchise}
                onChange={handleSelectChange('branchOrFranchise')}
                isLoading={loadingLocations}
                isDisabled={loadingLocations}
                placeholder={`Select ${form.locationModel.label.toLowerCase()}`}
                noOptionsMessage={() => 'No locations found'}
              />
              {errors.branchOrFranchise && (
                <p className="mt-1.5 text-sm text-negative-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-negative-500" />
                  {errors.branchOrFranchise}
                </p>
              )}
            </div>
          </div>

          {/* Category & Frequency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-sm font-medium text-fg-muted">
                  <Tag size={16} className="text-fg-subtle" />
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setIsManageCategoriesOpen(true)}
                  className="flex items-center gap-1 text-xs font-medium text-accent-600 transition-all hover:text-accent-700 hover:scale-105"
                >
                  <Settings2 size={14} />
                  Manage
                </button>
              </div>
              <CreatableSelect
                unstyled
                styles={selectStyles}
                classNames={{
                  control: () => 'w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-fg transition-all focus:border-accent-500 focus:bg-surface-raised focus:ring-2 focus:ring-accent-500/20',
                  menu: () => 'mt-1 rounded-xl border border-border-subtle bg-surface-raised shadow-lg overflow-hidden',
                  option: () => 'px-4 py-2.5 text-sm hover:bg-surface cursor-pointer text-fg',
                }}
                options={categoryOptions}
                value={form.category}
                onChange={handleSelectChange('category')}
                onCreateOption={handleCreateCategory}
                isLoading={creatingCategory}
                isDisabled={creatingCategory}
                placeholder="Select or add category"
                formatCreateLabel={(input) => (
                  <span className="flex items-center gap-2 text-fg">
                    <Plus size={14} />
                    Create "{input}"
                  </span>
                )}
              />
              {errors.category && (
                <p className="mt-1.5 text-sm text-negative-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-negative-500" />
                  {errors.category}
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-fg-muted mb-1.5">
                <Calendar size={16} className="text-fg-subtle" />
                Frequency
              </label>
              <Select
                unstyled
                styles={selectStyles}
                classNames={{
                  control: () => 'w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-fg transition-all focus:border-accent-500 focus:bg-surface-raised focus:ring-2 focus:ring-accent-500/20',
                  menu: () => 'mt-1 rounded-xl border border-border-subtle bg-surface-raised shadow-lg overflow-hidden',
                  option: () => 'px-4 py-2.5 text-sm hover:bg-surface cursor-pointer text-fg',
                }}
                options={FREQUENCY_OPTIONS}
                value={form.frequency}
                onChange={handleSelectChange('frequency')}
                isSearchable={false}
              />
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5" htmlFor="amount">
                Amount
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle">
                  <IndianRupee size={18} />
                </div>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-border-subtle bg-surface pl-10 pr-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-all focus:border-accent-500 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500/20"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleTextChange('amount')}
                />
              </div>
              {errors.amount && (
                <p className="mt-1.5 text-sm text-negative-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-negative-500" />
                  {errors.amount}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5" htmlFor="date">
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-fg-subtle" />
                  Date
                </div>
              </label>
              <div className="relative">
                <input
                  id="date"
                  type="date"
                  max={getTodayDateString()}
                  className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm text-fg transition-all focus:border-accent-500 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500/20 scheme-light dark:scheme-dark"
                  value={form.date}
                  onChange={handleTextChange('date')}
                />
              </div>
              {errors.date && (
                <p className="mt-1.5 text-sm text-negative-500 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-negative-500" />
                  {errors.date}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1.5" htmlFor="notes">
              Notes <span className="text-fg-subtle font-normal">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-2.5 text-sm text-fg placeholder:text-fg-subtle transition-all focus:border-accent-500 focus:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-accent-500/20 resize-none"
              placeholder="Add any additional details..."
              value={form.notes}
              onChange={handleTextChange('notes')}
            />
          </div>

          {/* Error message */}
          {submitError && (
            <div className="flex items-center gap-2 rounded-xl border border-negative-200 bg-negative-50 px-4 py-3 text-sm text-negative-600">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-negative-100 text-negative-600 text-xs font-bold">!</span>
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border-subtle pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2.5 text-sm font-medium text-fg-muted transition-all hover:bg-surface hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-accent-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:text-accent-700 hover:scale-105
               hover:bg-accent-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-none active:scale-[0.98]"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </span>
              ) : isEditMode ? (
                'Update Expense'
              ) : (
                'Add Expense'
              )}
            </button>
          </div>
        </form>
      </Modal>

      <ManageCategoriesModal
        isOpen={isManageCategoriesOpen}
        onClose={() => setIsManageCategoriesOpen(false)}
        onUpdated={refreshCategories}
      />
    </>
  )
}