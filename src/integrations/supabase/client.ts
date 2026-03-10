// Nivra API client (replaces Supabase)

const API_BASE_URL = "https://nivra-api.proud-band-c162.workers.dev";

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
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API request failed");
  }

  return res.json();
}

export const api = {
  get: (endpoint: string) => request(endpoint),

  post: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "POST",
      body
    }),

  put: (endpoint: string, body: any) =>
    request(endpoint, {
      method: "PUT",
      body
    }),

  delete: (endpoint: string) =>
    request(endpoint, {
      method: "DELETE"
    })
};
