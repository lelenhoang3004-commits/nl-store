/**
 * Query options helper for REST list endpoints.
 * It standardizes pagination, search, sorting, and filtering before repositories are added.
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

function toPositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
}

function normalizeDirection(value) {
  return String(value).toLowerCase() === "asc" ? "asc" : "desc";
}

export function parsePagination(query = {}) {
  const page = toPositiveInteger(query.page, DEFAULT_PAGE);
  const requestedLimit = toPositiveInteger(query.limit, DEFAULT_LIMIT);
  const limit = Math.min(requestedLimit, MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

export function parseSearch(query = {}) {
  const keyword = typeof query.search === "string" ? query.search.trim() : "";

  return {
    keyword,
    enabled: keyword.length > 0
  };
}

export function parseSort(query = {}, allowedFields = []) {
  const requestedField = typeof query.sortBy === "string" ? query.sortBy.trim() : "";
  const field = allowedFields.includes(requestedField) ? requestedField : allowedFields[0] || null;

  return {
    field,
    direction: normalizeDirection(query.sortOrder)
  };
}

export function parseFilters(query = {}, allowedFilters = []) {
  return allowedFilters.reduce((filters, field) => {
    if (query[field] !== undefined && query[field] !== "") {
      filters[field] = query[field];
    }

    return filters;
  }, {});
}

export function createPaginationMeta({ page, limit }, totalItems = 0) {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    page,
    limit,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

export function parseQueryOptions(query = {}, options = {}) {
  const pagination = parsePagination(query);
  const search = parseSearch(query);
  const sort = parseSort(query, options.allowedSortFields || []);
  const filter = parseFilters(query, options.allowedFilterFields || []);

  return {
    pagination,
    search,
    sort,
    filter
  };
}
