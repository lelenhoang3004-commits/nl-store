export function sanitizePagination(inputLimit, inputOffset, defaultLimit = 10) {
  const parsedLimit = Math.trunc(Number(inputLimit));
  const parsedOffset = Math.trunc(Number(inputOffset));

  return {
    limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit || defaultLimit, 100)) : defaultLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset || 0) : 0
  };
}

export function normalizeSqlParams(params = []) {
  return params.map((value) => value === undefined ? null : value);
}
