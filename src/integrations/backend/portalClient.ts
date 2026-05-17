// Dedicated backend client for CLIENT PORTAL only.
// Uses a distinct auth storage key so admin and client sessions can coexist on the same domain.

import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Keep this stable across deployments; different from the default client storage key.
const PORTAL_STORAGE_KEY = `sb-${PROJECT_ID}-portal-auth-token`;

const readAccessToken = (storageKey: string): string | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.access_token || parsed?.currentSession?.access_token || null;
  } catch {
    return null;
  }
};

export const portalClient = createClient(BACKEND_URL, BACKEND_PUBLISHABLE_KEY, {
  auth: {
    storageKey: PORTAL_STORAGE_KEY,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers || {});
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);
      const isEdgeFunctionRequest = requestUrl.includes("/functions/v1/");

      try {
        const raw = sessionStorage.getItem("nivra_impersonation_v1");
        if (raw) {
          const parsed = JSON.parse(raw) as { expiresAt?: string };
          const stillValid = parsed?.expiresAt ? new Date(parsed.expiresAt).getTime() > Date.now() : true;

          if (stillValid && !isEdgeFunctionRequest) {
            const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
            const adminStorageKey = `sb-${projectId}-staff-auth-token`;
            const adminAccessToken = readAccessToken(adminStorageKey);

            if (adminAccessToken) {
              headers.set("Authorization", `Bearer ${adminAccessToken}`);
            }
          }
        }
      } catch {
        // Ignore impersonation header fallback errors and continue with default auth.
      }

      return fetch(input, {
        ...init,
        headers,
      });
    },
  },
});
