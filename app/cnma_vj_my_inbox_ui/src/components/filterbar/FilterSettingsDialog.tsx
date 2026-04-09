/**
 * FilterSettingsDialog — Adapt Filter dialog (SAP UI5 style)
 * Simplified version without @dnd-kit drag-and-drop; uses button reordering.
 */

import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronsUp, ChevronUp, ChevronDown, ChevronsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { FilterSettingItem } from './types';

interface FilterSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    filters: FilterSettingItem[];
    onApply: (filters: FilterSettingItem[]) => void;
}

export function FilterSettingsDialog({
    open,
    onOpenChange,
    filters,
    onApply,
}: FilterSettingsDialogProps) {
    const [localFilters, setLocalFilters] = useState<FilterSettingItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [showUnselected, setShowUnselected] = useState(false);

    // Initialize on open
    useEffect(() => {
        if (open) {
            setLocalFilters([...filters]);
            setSearchQuery('');
            setSelectedIndex(null);
            setShowUnselected(false);
        }
    }, [open, filters]);

    const filteredList = useMemo(() => {
        let result = localFilters;
        if (searchQuery) {
            result = result.filter(f =>
                f.label.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        if (showUnselected) {
            result = result.filter(f => f.visible);
        }
        return result;
    }, [localFilters, searchQuery, showUnselected]);

    const visibleCount = localFilters.filter(f => f.visible).length;

    const toggleVisibility = (name: string) => {
        setLocalFilters(prev =>
            prev.map(f => (f.name === name ? { ...f, visible: !f.visible } : f))
        );
    };

    const moveFilter = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= localFilters.length) return;
        setLocalFilters(prev => {
            const next = [...prev];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item);
            return next;
        });
        setSelectedIndex(toIndex);
    };

    const getRealIndex = (name: string): number => {
        return localFilters.findIndex(f => f.name === name);
    };

    const handleApply = () => {
        onApply(localFilters);
        onOpenChange(false);
    };

    const searchActive = !!searchQuery || showUnselected;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Adapt Filter</DialogTitle>
                </DialogHeader>

                {/* Search bar */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search"
                        className="pl-9"
                    />
                </div>

                {/* Toggle unselected */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Field ({visibleCount}/{localFilters.length})</span>
                    <Button
                        variant="link"
                        onClick={() => setShowUnselected(!showUnselected)}
                        className="text-primary h-auto p-0 text-xs"
                    >
                        {showUnselected ? 'Show All' : 'Hide Unselected'}
                    </Button>
                </div>

                {/* Filter list */}
                <div className="flex-1 min-h-0 overflow-y-auto border rounded-md divide-y">
                    {filteredList.map(filter => {
                        const realIdx = getRealIndex(filter.name);
                        const isSelected = selectedIndex === realIdx;
                        return (
                            <div
                                key={filter.name}
                                onClick={() => setSelectedIndex(realIdx)}
                                className={`flex items-center gap-2 px-2 py-2.5 cursor-pointer transition-colors ${
                                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                                }`}
                            >
                                <Checkbox
                                    checked={filter.visible}
                                    onCheckedChange={() => toggleVisibility(filter.name)}
                                    onClick={e => e.stopPropagation()}
                                />
                                <span className="text-sm flex-1">{filter.label}</span>
                                {isSelected && !searchActive && (
                                    <div className="flex items-center gap-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => { e.stopPropagation(); moveFilter(realIdx, 0); }}
                                            className="p-0.5 h-auto w-auto"
                                            title="Move to top"
                                            disabled={realIdx === 0}
                                        >
                                            <ChevronsUp className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => { e.stopPropagation(); moveFilter(realIdx, realIdx - 1); }}
                                            className="p-0.5 h-auto w-auto"
                                            title="Move up"
                                            disabled={realIdx === 0}
                                        >
                                            <ChevronUp className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => { e.stopPropagation(); moveFilter(realIdx, realIdx + 1); }}
                                            className="p-0.5 h-auto w-auto"
                                            title="Move down"
                                            disabled={realIdx === localFilters.length - 1}
                                        >
                                            <ChevronDown className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={e => { e.stopPropagation(); moveFilter(realIdx, localFilters.length - 1); }}
                                            className="p-0.5 h-auto w-auto"
                                            title="Move to bottom"
                                            disabled={realIdx === localFilters.length - 1}
                                        >
                                            <ChevronsDown className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleApply}>OK</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
