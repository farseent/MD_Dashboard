// lib/expenseOptions.js

// Single source of truth for these two enums — used by both
// AddExpenseModal (react-select options) and ExpensesPage (filter bar).
export const LOCATION_MODEL_OPTIONS = [
  { value: 'Branch', label: 'Branch' },
  { value: 'Franchisee', label: 'Franchise' },
]

export const FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'No frequency'].map((f) => ({
  value: f,
  label: f,
}))