import { cmd } from './client';
import type { PersonalNote, CreateNoteInput } from '../types';

export const notesApi = {
  list: (projectId?: string): Promise<PersonalNote[]> =>
    cmd('notes_list', { projectId: projectId ?? null }),

  create: (data: CreateNoteInput): Promise<PersonalNote> =>
    cmd('notes_create', { data }),

  update: (data: { id: string; title?: string; content?: string; tags?: string }): Promise<PersonalNote> =>
    cmd('notes_update', { data }),

  delete: (id: string): Promise<void> =>
    cmd('notes_delete', { id }),

  pin: (id: string): Promise<PersonalNote> =>
    cmd('notes_pin', { id }),
};
