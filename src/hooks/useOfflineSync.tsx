/**
 * useOfflineSync - Hook for managing offline data synchronization
 * Stores pending sales in IndexedDB and syncs when online
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_NAME = "nivra_field_sales";
const DB_VERSION = 1;
const STORE_NAME = "pending_sales";

interface PendingSale {
  localId: string;
  data: any;
  createdAt: string;
  attempts: number;
}

let db: IDBDatabase | null = null;

// Initialize IndexedDB
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "localId" });
      }
    };
  });
};

// Get all pending sales
const getPendingSales = async (): Promise<PendingSale[]> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

// Add a pending sale
const addPendingSale = async (sale: PendingSale): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(sale);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

// Remove a pending sale
const removePendingSale = async (localId: string): Promise<void> => {
  const database = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(localId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load pending count
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingSales();
      setPendingCount(pending.length);
    } catch (error) {
      console.error("Error loading pending sales:", error);
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline]);

  // Save a sale (works offline)
  const saveSale = useCallback(async (saleData: any): Promise<{ success: boolean; localId?: string; error?: string }> => {
    const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (isOnline) {
      // Try to save directly to server
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error("Not authenticated");
        }

        const { data, error } = await supabase
          .from("field_sales_orders")
          .insert({
            ...saleData,
            local_id: localId,
            salesperson_id: session.user.id,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) throw error;

        toast.success("Vente enregistrée !");
        return { success: true, localId };
      } catch (error: any) {
        console.error("Error saving sale online:", error);
        // Fall back to offline storage
      }
    }

    // Save offline
    try {
      await addPendingSale({
        localId,
        data: saleData,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
      
      await refreshPendingCount();
      toast.info("Vente sauvegardée hors ligne", {
        description: "Elle sera synchronisée automatiquement",
      });
      
      return { success: true, localId };
    } catch (error: any) {
      console.error("Error saving sale offline:", error);
      return { success: false, error: error.message };
    }
  }, [isOnline, refreshPendingCount]);

  // Sync all pending sales
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pending = await getPendingSales();
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée, reconnectez-vous");
        setIsSyncing(false);
        return;
      }

      for (const sale of pending) {
        try {
          const { error } = await supabase
            .from("field_sales_orders")
            .insert({
              ...sale.data,
              local_id: sale.localId,
              salesperson_id: session.user.id,
              sync_status: "synced",
              synced_at: new Date().toISOString(),
            });

          if (error) throw error;

          await removePendingSale(sale.localId);
          syncedCount++;
        } catch (error) {
          console.error("Error syncing sale:", sale.localId, error);
          failedCount++;
          
          // Update attempt count
          await addPendingSale({
            ...sale,
            attempts: sale.attempts + 1,
          });
        }
      }

      await refreshPendingCount();

      if (syncedCount > 0) {
        toast.success(`${syncedCount} vente(s) synchronisée(s)`);
      }
      if (failedCount > 0) {
        toast.error(`${failedCount} vente(s) en échec`, {
          description: "Réessayez plus tard",
        });
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Erreur de synchronisation");
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    saveSale,
    syncNow,
    refreshPendingCount,
  };
}

export { addPendingSale, getPendingSales, removePendingSale };
