/**
 * useTaskSelection — manages multi-select state for the task list.
 *
 * Owns:
 *   - selection mode toggle
 *   - selected task IDs
 *   - select all / toggle individual / clear
 *
 * Supports both controlled (external) and uncontrolled (internal) modes.
 */
import { useState, useCallback, useRef } from 'react';
import type { InboxTask } from '@/services/inbox/inbox.types';

interface UseTaskSelectionOptions {
    /** External selection mode (controlled) */
    selectionMode?: boolean;
    /** External selected IDs (controlled) */
    selectedIds?: Set<string>;
    /** Callback when selection mode changes */
    onSelectionModeChange?: (mode: boolean) => void;
    /** Callback when selected IDs change */
    onSelectedIdsChange?: (ids: Set<string>) => void;
}

export function useTaskSelection(options: UseTaskSelectionOptions = {}) {
    const [_internalMode, _setInternalMode] = useState(false);
    const [_internalIds, _setInternalIds] = useState<Set<string>>(new Set());

    const selectionMode =
        options.selectionMode !== undefined ? options.selectionMode : _internalMode;
    const selectedIds =
        options.selectedIds !== undefined ? options.selectedIds : _internalIds;

    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;

    const setSelectionMode = useCallback(
        (mode: boolean) => {
            _setInternalMode(mode);
            options.onSelectionModeChange?.(mode);
        },
        [options.onSelectionModeChange]
    );

    const updateSelectedIds = useCallback(
        (newIds: Set<string>) => {
            _setInternalIds(newIds);
            options.onSelectedIdsChange?.(newIds);
        },
        [options.onSelectedIdsChange]
    );

    const toggleSelection = useCallback(
        (taskId: string) => {
            const prev = selectedIdsRef.current;
            const next = new Set(prev);
            if (next.has(taskId)) {
                next.delete(taskId);
            } else {
                next.add(taskId);
            }
            updateSelectedIds(next);
        },
        [updateSelectedIds]
    );

    const toggleSelectAll = useCallback(
        (tasks: InboxTask[]) => {
            const prev = selectedIdsRef.current;
            if (prev.size === tasks.length) {
                updateSelectedIds(new Set<string>());
            } else {
                updateSelectedIds(new Set(tasks.map((t) => t.instanceId)));
            }
        },
        [updateSelectedIds]
    );

    const exitSelectionMode = useCallback(() => {
        setSelectionMode(false);
        updateSelectedIds(new Set<string>());
    }, [setSelectionMode, updateSelectedIds]);

    return {
        selectionMode,
        selectedIds,
        setSelectionMode,
        toggleSelection,
        toggleSelectAll,
        exitSelectionMode,
    };
}
