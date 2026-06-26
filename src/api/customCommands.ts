import { cmd } from './client';

export interface CustomCommand {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomCommandInput {
  name: string;
  description?: string;
  icon?: string;
  content: string;
  sortOrder?: number;
}

export interface UpdateCustomCommandInput {
  name?: string;
  description?: string;
  icon?: string;
  content?: string;
  sortOrder?: number;
}

export const customCommandsApi = {
  list: () => cmd<CustomCommand[]>('custom_commands_list'),
  create: (data: CreateCustomCommandInput) =>
    cmd<CustomCommand>('custom_commands_create', { data }),
  update: (id: string, data: UpdateCustomCommandInput) =>
    cmd<CustomCommand>('custom_commands_update', { id, data }),
  delete: (id: string) => cmd<void>('custom_commands_delete', { id }),
};
