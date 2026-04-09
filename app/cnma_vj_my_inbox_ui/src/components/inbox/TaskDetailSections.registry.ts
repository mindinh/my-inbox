import type { TaskDetail } from '@/services/inbox/inbox.types';
import type { BusinessSectionModel, TaskDetailRenderer } from './TaskDetailSections.types';
import { poTaskDetailRenderer } from './TaskDetailSections.renderer.po';
import { prTaskDetailRenderer } from './TaskDetailSections.renderer.pr';
import { defaultTaskDetailRenderer } from './TaskDetailSections.renderer.default';

const RENDERERS: TaskDetailRenderer[] = [
    poTaskDetailRenderer,
    prTaskDetailRenderer,
    defaultTaskDetailRenderer,
];

/**
 * Resolver for task object presentation.
 * To support new task object types, add a new renderer and register it here.
 */
export function resolveBusinessSectionModel(detail: TaskDetail): BusinessSectionModel {
    const renderer = RENDERERS.find((candidate) => candidate.matches(detail)) || defaultTaskDetailRenderer;
    return renderer.build(detail);
}
