export type TagsApiConfig = {
  baseUrl: string;
  apiKey: string;
};

function headers(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function request<T>(
  config: TagsApiConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = config.baseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/api/tags/v1${path}`, {
    ...init,
    headers: { ...headers(config.apiKey), ...init?.headers },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { raw: text };
    }
  }
  if (!res.ok) {
    const err = body as { error?: string };
    throw new Error(err?.error ?? `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return body as T;
}

export function createTagsApiClient(config: TagsApiConfig) {
  return {
    listTags: (q?: string) =>
      request<{ items: { name: string; referenceCount: number }[]; total: number }>(
        config,
        `/tags${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      ),

    getReferenceTags: (referenceId: string) =>
      request<{ referenceId: string; tags: string[] }>(config, `/references/${referenceId}/tags`),

    setReferenceTags: (referenceId: string, tags: string[]) =>
      request<{ referenceId: string; tags: string[] }>(config, `/references/${referenceId}/tags`, {
        method: "PUT",
        body: JSON.stringify({ tags }),
      }),

    addReferenceTag: (referenceId: string, tag: string) =>
      request<{ referenceId: string; tags: string[] }>(config, `/references/${referenceId}/tags`, {
        method: "POST",
        body: JSON.stringify({ tag }),
      }),

    removeReferenceTag: (referenceId: string, tagName: string) =>
      request<{ referenceId: string; tags: string[] }>(
        config,
        `/references/${referenceId}/tags/${encodeURIComponent(tagName)}`,
        { method: "DELETE" },
      ),

    normalizeAll: (dryRun?: boolean) =>
      request<{
        referencesScanned: number;
        referencesUpdated: number;
        tagsRemoved: number;
        tagsAdded: number;
        reviewCount: number;
        dryRun: boolean;
      }>(config, "/normalize", {
        method: "POST",
        body: JSON.stringify({ dryRun: dryRun ?? false }),
      }),

    listNumericReview: (page?: number, pageSize?: number) => {
      const params = new URLSearchParams();
      if (page) params.set("page", String(page));
      if (pageSize) params.set("pageSize", String(pageSize));
      const qs = params.toString();
      return request<{
        items: Array<{
          referenceId: string;
          storageKey: string;
          folderPath: string;
          tags: string[];
          numericTags: string[];
          url: string;
        }>;
        total: number;
        page: number;
        pageSize: number;
      }>(config, `/review/numeric${qs ? `?${qs}` : ""}`);
    },
  };
}

export type TagsApiClient = ReturnType<typeof createTagsApiClient>;
