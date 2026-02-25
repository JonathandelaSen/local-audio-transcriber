import Dexie, { type EntityTable } from 'dexie';
import type { HistoryItem } from '@/lib/history';
import type { CreatorShortExportRecord, CreatorShortProjectRecord } from '@/lib/creator/storage';

// Define the interface for media files
export interface MediaFile {
  id: string; // Will match the HistoryItem.id
  file: File;
}

// Subclass Dexie to provide types
export class AudioTranscriberDB extends Dexie {
  history!: EntityTable<HistoryItem, 'id'>;
  mediaFiles!: EntityTable<MediaFile, 'id'>;
  creatorShortProjects!: EntityTable<CreatorShortProjectRecord, 'id'>;
  creatorShortExports!: EntityTable<CreatorShortExportRecord, 'id'>;

  constructor() {
    super('AudioTranscriberDB');
    
    // Define the schema. We index 'id' and 'timestamp' for history
    this.version(1).stores({
      history: 'id, timestamp',
      mediaFiles: 'id'
    });

    this.version(2).stores({
      history: 'id, timestamp',
      mediaFiles: 'id',
      creatorShortProjects: 'id, sourceProjectId, sourceMediaId, updatedAt, createdAt, status, platform',
      creatorShortExports: 'id, shortProjectId, sourceProjectId, createdAt, status, platform'
    });
  }
}

export const db = new AudioTranscriberDB();
