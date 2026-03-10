// Nivra API portal client

const API_BASE_URL = "https://telecom-zen-hub-b5f9c7c4.proud-band-c162.workers.dev";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

async function request(endpoint: string, options: RequestOptions = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || "API request failed");
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const portalClient = {
  get: (endpoint: string) => request(endpoint),

  post: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "POST",
      body,
    }),

  put: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "PUT",
      body,
    }),

  delete: (endpoint: string) =>
    request(endpoint, {
      method: "DELETE",
    }),
};

export const portalSupabase = portalClient;
