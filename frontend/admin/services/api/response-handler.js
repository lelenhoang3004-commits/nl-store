import { ApiError } from "./api-error.js";

// Parse backend responses following the project API standard.
export async function handleResponse(response) {
  const payload = await parsePayload(response);

  if (!response.ok) {
    throw createApiError(response, payload);
  }

  if (payload?.success === false) {
    throw createApiError(response, payload);
  }

  return {
    data: payload?.data ?? payload,
    message: payload?.message ?? payload?.meta?.message ?? "",
    meta: payload?.meta ?? null,
    status: response.status,
    headers: response.headers,
    raw: response
  };
}

export async function handleDownloadResponse(response) {
  if (!response.ok) {
    return handleResponse(response);
  }

  return {
    blob: await response.blob(),
    fileName: getFileNameFromHeaders(response.headers),
    status: response.status,
    headers: response.headers,
    raw: response
  };
}

function getFileNameFromHeaders(headers) {
  const disposition = headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? "download";
}

async function parsePayload(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch (error) {
      throw new ApiError({
        message: "Invalid JSON response",
        status: response.status,
        code: "INVALID_JSON",
        details: error,
        response
      });
    }
  }

  return response.text();
}

function createApiError(response, payload) {
  const errorPayload = payload?.error ?? payload;

  return new ApiError({
    message: payload?.message ?? errorPayload?.message ?? response.statusText,
    status: response.status,
    code: errorPayload?.code ?? payload?.code ?? "HTTP_ERROR",
    details: errorPayload?.details ?? errorPayload ?? payload,
    response
  });
}

