const requestInterceptors = [];
const responseInterceptors = [];
const errorInterceptors = [];

export const interceptors = {
  request: {
    use(handler) {
      requestInterceptors.push(handler);
      return () => removeInterceptor(requestInterceptors, handler);
    }
  },
  response: {
    use(handler) {
      responseInterceptors.push(handler);
      return () => removeInterceptor(responseInterceptors, handler);
    }
  },
  error: {
    use(handler) {
      errorInterceptors.push(handler);
      return () => removeInterceptor(errorInterceptors, handler);
    }
  }
};

export async function runRequestInterceptors(config) {
  let nextConfig = config;

  for (const interceptor of requestInterceptors) {
    nextConfig = await interceptor(nextConfig);
  }

  return nextConfig;
}

export async function runResponseInterceptors(response) {
  let nextResponse = response;

  for (const interceptor of responseInterceptors) {
    nextResponse = await interceptor(nextResponse);
  }

  return nextResponse;
}

export async function runErrorInterceptors(error) {
  let nextError = error;

  for (const interceptor of errorInterceptors) {
    nextError = await interceptor(nextError);
  }

  throw nextError;
}

function removeInterceptor(collection, handler) {
  const index = collection.indexOf(handler);

  if (index >= 0) {
    collection.splice(index, 1);
  }
}
