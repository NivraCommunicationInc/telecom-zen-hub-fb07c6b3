// Dedicated backend client for CLIENT PORTAL only.
// Uses a distinct auth storage key so admin and client sessions can coexist on the same domain.

import { createClient } from "@supabase/supabase-js";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const BACKEND_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// Keep this stable across deployments; different from the default client storage key.
const PORTAL_STORAGE_KEY = `sb-${PROJECT_ID}-portal-auth-token`;

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
            const adminRaw = localStorage.getItem(adminStorageKey);
            const adminSession = adminRaw ? JSON.parse(adminRaw) : null;
            const adminAccessToken = adminSession?.access_token;

            if (adminAccessToken && !headers.has("Authorization")) {
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
