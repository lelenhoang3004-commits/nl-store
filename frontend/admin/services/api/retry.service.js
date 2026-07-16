// Retry only transient failures. Business errors should fail fast.
export async function retryRequest(task, options = {}) {
  const attempts = options.attempts ?? 0;
  const delay = options.delay ?? 0;
  const statuses = options.statuses ?? [];
  let lastError = null;

  for (let index = 0; index <= attempts; index += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;

      if (index >= attempts || !shouldRetry(error, statuses)) {
        throw error;
      }

      await wait(delay * (index + 1));
    }
  }

  throw lastError;
}

function shouldRetry(error, statuses) {
  if (error.isTimeout || error.isNetworkError || !error.status) {
    return true;
  }

  return statuses.includes(error.status);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
