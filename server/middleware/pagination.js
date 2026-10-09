export function parsePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  const hasPagination = query?.page != null || query?.limit != null;
  if (!hasPagination) return null;
  const page = Math.max(1, Number.parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit || String(defaultLimit), 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginateArray(items, pagination) {
  if (!pagination) return { items, meta: null };
  const total = items.length;
  const itemsPage = items.slice(pagination.offset, pagination.offset + pagination.limit);
  return {
    items: itemsPage,
    meta: {
      page: pagination.page,
      limit: pagination.limit,
      total,
      totalPages: Math.ceil(total / pagination.limit),
      hasNextPage: pagination.offset + itemsPage.length < total,
      hasPreviousPage: pagination.page > 1
    }
  };
}
