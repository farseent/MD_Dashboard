import api from './axios'


// ==============================
// EXPENSES
// ==============================

export const getExpense = async (params, signal) => {
  const { data } = await api.get("/expense", { params, signal });
  return data;
};

export const createExpense = async (payload) => {
  const { data } = await api.post("/expense", payload);
  return data;
};

export const getExpenseById = async (id) => {
  const { data } = await api.get(`/expense/${id}`);
  return data;
};

export const updateExpenseAmount = async (id, amount) => {
  const { data } = await api.patch(`/expense/${id}/amount`, { amount });
  return data;
};

/**
 * Full expense update (name, location, category, frequency, amount, notes).
 * ⚠️ Requires backend endpoint PUT /expense/:id — not yet confirmed live.
 * Mirrors the existing PUT /expense/category/:id pattern.
 * payload: { expenseName, branchOrFranchise, locationModel, category, frequency, amount, notes }
 */
export const updateExpense = async (id, payload) => {
  const { data } = await api.put(`/expense/${id}`, payload);
  return data;
};

export const updateExpenseStatus = async (id, paymentStatus) => {
  const { data } = await api.patch(`/expense/${id}/status`, { paymentStatus });
  return data;
};

// ==============================
// EXPENSE CATEGORIES
// ==============================

export const getExpenseCategories = async () => {
  const { data } = await api.get("/expense/category");
  return data;
};

export const createExpenseCategory = async (categoryData) => {
  const { data } = await api.post(
    "/expense/category",
    categoryData
  );
  return data;
};

export const getExpenseCategoryById = async (id) => {
  const { data } = await api.get(`/expense/category/${id}`);
  return data;
};

export const updateExpenseCategory = async (id, categoryData) => {
  // categoryData: { name, description }
  const { data } = await api.put(`/expense/category/${id}`, categoryData);
  return data;
};

export const updateExpenseCategoryStatus = async (id, isActive) => {
  const { data } = await api.patch(`/expense/category/${id}/status`, { isActive });
  return data;
};

// ==============================
// BRANCHES / FRANCHISES
// ==============================

/**
 * @param {"Branch" | "Franchise"} type
 */
export const getBranchOrFranchise = async (type) => {
  const { data } = await api.get(`/expense/locations/${type}`);
  return data;
};

// ==============================
// EXPENSE ANALYTICS / STATS
// ==============================

/**
 * KPI summary: totalThisMonth, totalLastMonth, trendPercent,
 * largestCategory, topLocation.
 */
export const getExpenseStatsSummary = async () => {
  const { data } = await api.get("/expense/stats/summary");
  return data;
};

/**
 * Stacked bar chart data — monthly totals grouped by category.
 * @param {number} [months=4] Number of trailing months to include
 */
export const getMonthlyExpensesByCategory = async (months = 4) => {
  const { data } = await api.get("/expense/stats/monthly-by-category", {
    params: { months },
  });
  return data;
};

/**
 * Pie chart data — category share of total spend within a date range.
 * @param {{ from?: string, to?: string }} [range] ISO date strings
 */
export const getExpenseCategoryShare = async (range = {}) => {
  const { from, to } = range;
  const { data } = await api.get("/expense/stats/category-share", {
    params: { from, to },
  });
  return data;
};

/**
 * Line chart data — total spend per month over time.
 * @param {number} [months=6] Number of trailing months to include
 */
export const getExpenseTrend = async (months = 6) => {
  const { data } = await api.get("/expense/stats/trend", {
    params: { months },
  });
  return data;
};