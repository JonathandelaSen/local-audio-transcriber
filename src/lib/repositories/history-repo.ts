import { db, type AudioTranscriberDB } from "@/lib/db";
import { normalizeHistoryItem, sortHistoryItems, type HistoryItem } from "@/lib/history";

export interface HistoryRepository {
  listHistory(): Promise<HistoryItem[]>;
  bulkPutHistory(items: HistoryItem[]): Promise<void>;
  deleteHistoryItem(id: string): Promise<void>;
  putMediaFile(record: { id: string; file: File }): Promise<void>;
  deleteMediaFile(id: string): Promise<void>;
}

export function createDexieHistoryRepository(database: AudioTranscriberDB = db): HistoryRepository {
  return {
    async listHistory() {
      const stored = await database.history.orderBy("timestamp").reverse().toArray();
      return sortHistoryItems((stored || []).map(normalizeHistoryItem));
    },

    async bulkPutHistory(items) {
      await database.history.bulkPut(items);
    },

    async deleteHistoryItem(id) {
      await database.history.delete(id);
    },

    async putMediaFile(record) {
      await database.mediaFiles.put(record);
    },

    async deleteMediaFile(id) {
      await database.mediaFiles.delete(id);
    },
  };
}

