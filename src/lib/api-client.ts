import { env } from "./env";

export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL;
export const WS_BASE_URL = env.NEXT_PUBLIC_WS_BASE_URL;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const detail = Array.isArray(errorData.detail)
      ? errorData.detail.map((entry: { msg?: string }) => entry.msg ?? "Invalid request").join("; ")
      : errorData.detail;
    throw new ApiError(
      detail || errorData.message || `API Error: ${response.statusText}`,
      response.status
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
