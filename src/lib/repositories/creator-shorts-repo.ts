import { db, type AudioTranscriberDB } from "@/lib/db";
import type { CreatorShortExportRecord, CreatorShortProjectRecord } from "@/lib/creator/storage";

export interface CreatorShortsRepository {
  listProjects(sourceProjectId?: string): Promise<CreatorShortProjectRecord[]>;
  listExports(sourceProjectId?: string): Promise<CreatorShortExportRecord[]>;
  putProject(record: CreatorShortProjectRecord): Promise<void>;
  putExport(record: CreatorShortExportRecord): Promise<void>;
  deleteProject(projectId: string): Promise<void>;
}

export function sortCreatorShortProjects(records: CreatorShortProjectRecord[]): CreatorShortProjectRecord[] {
  return [...records].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
}

export function sortCreatorShortExports(records: CreatorShortExportRecord[]): CreatorShortExportRecord[] {
  return [...records].sort((a, b) => b.createdAt - a.createdAt);
}

export function groupCreatorShortExportsByProjectId(exports: CreatorShortExportRecord[]): Map<string, CreatorShortExportRecord[]> {
  const map = new Map<string, CreatorShortExportRecord[]>();
  for (const exportRecord of exports) {
    const list = map.get(exportRecord.shortProjectId) ?? [];
    list.push(exportRecord);
    map.set(exportRecord.shortProjectId, list);
  }
  return map;
}

export function createDexieCreatorShortsRepository(database: AudioTranscriberDB = db): CreatorShortsRepository {
  return {
    async listProjects(sourceProjectId?: string) {
      const records = sourceProjectId
        ? await database.creatorShortProjects.where("sourceProjectId").equals(sourceProjectId).toArray()
        : await database.creatorShortProjects.toArray();
      return sortCreatorShortProjects(records || []);
    },

    async listExports(sourceProjectId?: string) {
      const records = sourceProjectId
        ? await database.creatorShortExports.where("sourceProjectId").equals(sourceProjectId).toArray()
        : await database.creatorShortExports.toArray();
      return sortCreatorShortExports(records || []);
    },

    async putProject(record) {
      await database.creatorShortProjects.put(record);
    },

    async putExport(record) {
      await database.creatorShortExports.put(record);
    },

    async deleteProject(projectId) {
      await database.transaction("rw", database.creatorShortProjects, database.creatorShortExports, async () => {
        await database.creatorShortProjects.delete(projectId);
        await database.creatorShortExports.where("shortProjectId").equals(projectId).delete();
      });
    },
  };
}
