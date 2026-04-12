export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
}

export type NewTask = Pick<Task, 'title' | 'description'>;

export type UpdateTask = Partial<Omit<Task, 'id'>>;

export type PartialTask = Partial<Omit<Task, 'id'>>;

export interface Error {
  message: string;
}
