import {
  sortTranscriptVersions,
  type HistoryItem,
  type TranscriptVersion,
} from "../../history";

export function updateTranscriptInHistoryItems(
  projects: HistoryItem[],
  options: {
    projectId: string;
    transcriptVersionId: string;
    now: number;
    updater: (transcript: TranscriptVersion) => TranscriptVersion;
  }
): HistoryItem[] {
  return projects.map((project) => {
    if (project.id !== options.projectId) return project;

    let changed = false;
    const transcripts = project.transcripts.map((tx) => {
      if (tx.id !== options.transcriptVersionId) return tx;
      changed = true;
      return options.updater(tx);
    });

    if (!changed) return project;

    return {
      ...project,
      transcripts: sortTranscriptVersions(transcripts),
      activeTranscriptVersionId: options.transcriptVersionId,
      updatedAt: options.now,
      timestamp: options.now,
    };
  });
}

export function markInterruptedTranscriptsAsErrored(
  projects: HistoryItem[],
  options?: { now?: number; message?: string }
): HistoryItem[] {
  const now = options?.now ?? Date.now();
  const message = options?.message ?? "Interrupted by page reload";

  return projects.map((project) => {
    let hasInterrupted = false;
    const transcripts = project.transcripts.map((tx) => {
      if (tx.status !== "transcribing") return tx;
      hasInterrupted = true;
      return {
        ...tx,
        status: "error" as const,
        error: tx.error || message,
        updatedAt: now,
      };
    });

    if (!hasInterrupted) return project;

    return {
      ...project,
      transcripts,
      updatedAt: now,
      timestamp: now,
    };
  });
}

export function upsertTranscribingTranscriptProject(
  projects: HistoryItem[],
  options: {
    now: number;
    projectId: string;
    transcriptVersionId: string;
    fileName: string;
    requestedLanguage: string;
  }
): HistoryItem[] {
  let found = false;

  const next = projects.map((project) => {
    if (project.id !== options.projectId) return project;
    found = true;

    const nextVersionNumber = project.transcripts.reduce((max, tx) => Math.max(max, tx.versionNumber || 0), 0) + 1;
    const newTranscript: TranscriptVersion = {
      id: options.transcriptVersionId,
      versionNumber: nextVersionNumber,
      label: `Transcript v${nextVersionNumber}`,
      status: "transcribing",
      createdAt: options.now,
      updatedAt: options.now,
      requestedLanguage: options.requestedLanguage,
      subtitles: [],
    };

    return {
      ...project,
      filename: project.filename || options.fileName,
      updatedAt: options.now,
      timestamp: options.now,
      activeTranscriptVersionId: options.transcriptVersionId,
      transcripts: sortTranscriptVersions([...project.transcripts, newTranscript]),
    };
  });

  if (found) return next;

  const firstTranscript: TranscriptVersion = {
    id: options.transcriptVersionId,
    versionNumber: 1,
    label: "Transcript v1",
    status: "transcribing",
    createdAt: options.now,
    updatedAt: options.now,
    requestedLanguage: options.requestedLanguage,
    subtitles: [],
  };

  const newProject: HistoryItem = {
    id: options.projectId,
    mediaId: options.projectId,
    filename: options.fileName,
    createdAt: options.now,
    updatedAt: options.now,
    timestamp: options.now,
    activeTranscriptVersionId: options.transcriptVersionId,
    transcripts: [firstTranscript],
  };

  return [newProject, ...next];
}

