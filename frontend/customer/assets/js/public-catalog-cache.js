const DEFAULT_TTL_MS = 60 * 1000;
const publicJsonCache = new Map();

export async function getCachedPublicJson(url, options = {}) {
  const key = String(url || "");
  const ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
  const now = Date.now();
  const cached = publicJsonCache.get(key);

  if (cached?.data && now - cached.loadedAt < ttlMs) {
    return cached.data;
  }

  if (options.staleOk && cached?.data) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = fetch(key, options.fetchOptions || {})
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Public request failed with status ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      publicJsonCache.set(key, { data, loadedAt: Date.now(), promise: null });
      return data;
    })
    .catch((error) => {
      publicJsonCache.delete(key);
      throw error;
    });

  publicJsonCache.set(key, { data: cached?.data || null, loadedAt: cached?.loadedAt || 0, promise });
  return promise;
}

export function invalidateCachedPublicJson(match) {
  if (!match) {
    publicJsonCache.clear();
    return;
  }

  const predicate = typeof match === "function"
    ? match
    : (key) => key.includes(String(match));

  Array.from(publicJsonCache.keys()).forEach((key) => {
    if (predicate(key)) publicJsonCache.delete(key);
  });
}
