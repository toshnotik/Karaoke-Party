const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!configuredBaseUrl) {
  throw new Error('VITE_API_BASE_URL is not configured')
}

export function resolveApiBaseUrl(configuredUrl: string, hostname: string): string {
  return configuredUrl.replace('{hostname}', hostname).replace(/\/$/, '')
}

export const apiBaseUrl = resolveApiBaseUrl(
  configuredBaseUrl,
  window.location.hostname,
)

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init)

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`
    try {
      const body = (await response.json()) as { detail?: unknown }
      if (typeof body.detail === 'string') {
        message = body.detail
      }
    } catch {
      // Keep the status-based fallback for non-JSON errors.
    }
    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}
