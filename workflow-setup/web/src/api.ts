import type {
  Agent,
  ApiError,
  Config,
  ConfigResponse,
  Definition,
  Status,
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({
      error: "network_error",
      message: response.statusText,
    }))) as ApiError;
    throw Object.assign(new Error(error.message), {
      api: error,
      status: response.status,
    });
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}

export const api = {
  status: () => request<Status>("/status"),
  agents: () => request<{ kinds: Agent[] }>("/agents"),
  models: (kind: string, search: string) =>
    request<{
      kind: string;
      modelsSource: "discovered" | "fallback";
      models: { value: string; label: string }[];
      truncated: boolean;
    }>(
      `/agents/${encodeURIComponent(kind)}/models?search=${encodeURIComponent(search)}`,
    ),
  config: () => request<ConfigResponse>("/config"),
  save: (config: Config) =>
    request<ConfigResponse>("/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),
  definition: (name: string) =>
    request<{ name: string; path: string; builtin: boolean; content: string }>(
      `/definitions/${encodeURIComponent(name)}`,
    ),
  putDefinition: (name: string, content: string) =>
    request<{ name: string; path: string; builtin: boolean; content: string }>(
      `/definitions/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) },
    ),
  deleteDefinition: (name: string) =>
    request<void>(`/definitions/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }),
};

export type {
  Agent,
  Config,
  ConfigResponse,
  Definition,
  Status,
} from "./types";
