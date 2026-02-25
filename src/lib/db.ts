import Dexie, { type EntityTable } from 'dexie';
import type { HistoryItem } from '@/lib/history';

// Define the interface for media files
export interface MediaFile {
  id: string; // Will match the HistoryItem.id
  file: File;
}

// Subclass Dexie to provide types
export class AudioTranscriberDB extends Dexie {
  history!: EntityTable<HistoryItem, 'id'>;
  mediaFiles!: EntityTable<MediaFile, 'id'>;

  constructor() {
    super('AudioTranscriberDB');
    
    // Define the schema. We index 'id' and 'timestamp' for history
    this.version(1).stores({
      history: 'id, timestamp',
      mediaFiles: 'id'
    });
  }
}

export const db = new AudioTranscriberDB();
