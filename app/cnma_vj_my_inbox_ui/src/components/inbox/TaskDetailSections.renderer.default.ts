import type { TaskDetailRenderer } from './TaskDetailSections.types';
import { buildDefaultBusinessModel } from './TaskDetailSections.shared';

export const defaultTaskDetailRenderer: TaskDetailRenderer = {
    id: 'default',
    matches: () => true,
    build: (detail) => buildDefaultBusinessModel(detail),
};
