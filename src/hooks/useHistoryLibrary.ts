import { useCallback, useEffect, useState } from "react";
import { db } from "@/lib/db";
import { normalizeHistoryItem, sortHistoryItems, type HistoryItem } from "@/lib/history";

export function useHistoryLibrary() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stored = await db.history.orderBy("timestamp").reverse().toArray();
      setHistory(sortHistoryItems((stored || []).map(normalizeHistoryItem)));
    } catch (err) {
      console.error("Failed to load history", err);
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { history, isLoading, error, refresh };
}
