// Nivra API client (Supabase compatibility layer)

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

const nivraClient = {
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

/*
SUPABASE COMPATIBILITY LAYER
This prevents the frontend from crashing
*/

const fakeAuth = {
  getSession: async () => {
    return {
      data: { session: null },
      error: null,
    };
  },

  onAuthStateChange: () => {
    return {
      data: { subscription: { unsubscribe: () => {} } },
    };
  },

  signInWithPassword: async () => {
    throw new Error("Auth handled by Nivra API");
  },

  signOut: async () => {
    return { error: null };
  },
};

export const supabase = {
  ...nivraClient,
  auth: fakeAuth,
};
