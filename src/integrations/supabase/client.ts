// Nivra API client (compatibility layer)

const API_BASE_URL = "https://nivra-api.proud-band-c162.workers.dev/";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

async function request(endpoint: string, options: RequestOptions = {}) {
  const res = await fetch(`${API_BASE_URL}${endpoint.replace(/^\/+/, "")}`, {
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

export const nivraClient = {
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

// Compatibility layer so old code importing "supabase" doesn't break
export const supabase = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      return nivraClient.post("auth/login", { email, password });
    },
    signOut: async () => {
      return { data: true };
    },
  },

  from: () => {
    throw new Error("Database access moved to Nivra Core API.");
  },

  rpc: () => {
    throw new Error("RPC calls moved to Nivra Core API.");
  },
};
