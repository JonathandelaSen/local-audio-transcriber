import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import type { CreatorShortExportRecord, CreatorShortProjectRecord } from "@/lib/creator/storage";

function sortProjects(records: CreatorShortProjectRecord[]): CreatorShortProjectRecord[] {
  return [...records].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
}

function sortExports(records: CreatorShortExportRecord[]): CreatorShortExportRecord[] {
  return [...records].sort((a, b) => b.createdAt - a.createdAt);
}

export function useCreatorShortsLibrary(sourceProjectId?: string) {
  const [projects, setProjects] = useState<CreatorShortProjectRecord[]>([]);
  const [exports, setExports] = useState<CreatorShortExportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allProjects, allExports] = await Promise.all([
        sourceProjectId
          ? db.creatorShortProjects.where("sourceProjectId").equals(sourceProjectId).toArray()
          : db.creatorShortProjects.toArray(),
        sourceProjectId
          ? db.creatorShortExports.where("sourceProjectId").equals(sourceProjectId).toArray()
          : db.creatorShortExports.toArray(),
      ]);
      setProjects(sortProjects(allProjects || []));
      setExports(sortExports(allExports || []));
    } catch (err) {
      console.error("Failed to load creator shorts library", err);
      setError(err instanceof Error ? err.message : "Failed to load creator shorts library");
    } finally {
      setIsLoading(false);
    }
  }, [sourceProjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const upsertProject = useCallback(async (record: CreatorShortProjectRecord) => {
    await db.creatorShortProjects.put(record);
    setProjects((prev) => {
      const next = prev.filter((item) => item.id !== record.id);
      next.push(record);
      return sortProjects(next);
    });
  }, []);

  const upsertExport = useCallback(async (record: CreatorShortExportRecord) => {
    await db.creatorShortExports.put(record);
    setExports((prev) => {
      const next = prev.filter((item) => item.id !== record.id);
      next.push(record);
      return sortExports(next);
    });
  }, []);

  const exportsByProjectId = useMemo(() => {
    const map = new Map<string, CreatorShortExportRecord[]>();
    for (const exportRecord of exports) {
      const list = map.get(exportRecord.shortProjectId) ?? [];
      list.push(exportRecord);
      map.set(exportRecord.shortProjectId, list);
    }
    return map;
  }, [exports]);

  return {
    projects,
    exports,
    exportsByProjectId,
    isLoading,
    error,
    refresh,
    upsertProject,
    upsertExport,
  };
}
