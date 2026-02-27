export interface ProgressItemLike {
  file: string;
}

export function upsertProgressItem<T extends ProgressItemLike>(items: T[], nextItem: T): T[] {
  const next = [...items];
  const idx = next.findIndex((item) => item.file === nextItem.file);
  if (idx >= 0) {
    next[idx] = nextItem;
  } else {
    next.push(nextItem);
  }
  return next;
}

