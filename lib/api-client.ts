const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001").replace(/\/+$/, "");
const DEV_USER = import.meta.env.VITE_DEV_USER ?? "admin";

type RequestBody = BodyInit | Record<string, unknown> | unknown[] | null | undefined;

export async function apiRequest<T>(path: string, options: Omit<RequestInit, "body"> & { body?: RequestBody } = {}) {
  const headers = new Headers(options.headers);
  headers.set("x-dev-user", DEV_USER);

  let body = options.body as BodyInit | undefined;
  if (options.body != null && !(options.body instanceof FormData) && !(options.body instanceof Blob) && typeof options.body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = await response.json() as { message?: string | string[]; error?: string };
      const detail = payload.message ?? payload.error;
      message = Array.isArray(detail) ? detail.join(", ") : detail ?? message;
    } catch {
      // Keep the generic HTTP error when the response has no JSON body.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiDownload(path: string) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "x-dev-user": DEV_USER }
  });

  if (!response.ok) {
    throw new Error(`Unable to download file (${response.status}).`);
  }

  return response.blob();
}

export async function openApiFile(path: string) {
  const blob = await apiDownload(path);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
