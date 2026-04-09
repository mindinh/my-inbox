import { useState, useCallback, useMemo } from 'react';
import { SlidersHorizontal, Loader2, X, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBarField } from './FilterBarField';
import { FilterSettingsDialog } from './FilterSettingsDialog';
import type { FilterBarProps, FilterValues, FilterSettingItem } from './types';

/**
 * FilterBar (SAP UI5 Style)
 *
 * Configuration-driven filter bar with:
 * - Go button to apply filters
 * - Hide/Show toggle for filter area
 * - Adapt Filter dialog to choose visible filter fields and reorder them
 * - Clear button to reset all filters
 * - Responsive grid layout for filter fields
 */
export function FilterBar({
    config,
    values,
    onChange,
    onApply,
    onClear,
    isLoading = false,
    defaultExpanded = false,
    className = '',
    headerLeft,
    allFilterConfig,
    onAdaptFilter,
    isMobile,
}: FilterBarProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [showFilterSettings, setShowFilterSettings] = useState(false);

    // Build filter settings items for the dialog from allFilterConfig
    const allFilters = allFilterConfig ?? config;
    const visibleKeys = useMemo(() => new Set(config.map(f => f.key)), [config]);
    const filterSettingsItems: FilterSettingItem[] = useMemo(() => {
        return allFilters.map(f => ({
            name: f.key,
            label: f.label,
            visible: visibleKeys.has(f.key),
        }));
    }, [allFilters, visibleKeys]);

    // Handle individual field change
    const handleFieldChange = useCallback((key: string, value: any) => {
        onChange({
            ...values,
            [key]: value,
        });
    }, [values, onChange]);

    // Handle apply (Go button)
    const handleApply = useCallback(() => {
        onApply(values);
    }, [values, onApply]);

    // Handle clear all filters
    const handleClear = useCallback(() => {
        const clearedValues: FilterValues = {};
        config.forEach((field) => {
            switch (field.type) {
                case 'text':
                    clearedValues[field.key] = '';
                    break;
                case 'multiselect':
                    clearedValues[field.key] = [];
                    break;
                case 'dateRange':
                    clearedValues[field.key] = { from: undefined, to: undefined };
                    break;
                default:
                    clearedValues[field.key] = undefined;
            }
        });
        onChange(clearedValues);
        onClear?.();
    }, [config, onChange, onClear]);

    // Get visible filters (respect visible property, default to true)
    const visibleFilters = config.filter((f) => f.visible !== false);

    // Handle Enter key to trigger Go
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.defaultPrevented) {
            e.preventDefault();
            handleApply();
        }
    }, [handleApply]);

    // Handle filter settings apply from dialog
    const handleFilterSettingsApply = useCallback((filters: FilterSettingItem[]) => {
        onAdaptFilter?.(filters);
    }, [onAdaptFilter]);

    if (isMobile) {
        return (
            <div className={`flex flex-col h-full bg-white ${className}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h3 className="font-semibold text-lg">Filters</h3>
                    {onAdaptFilter && (
                        <Button variant="ghost" size="sm" onClick={() => setShowFilterSettings(true)} className="text-primary hover:bg-primary/5">
                            <ListFilter className="w-4 h-4 mr-2" />
                            Adapt Filter
                        </Button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                    {visibleFilters.map((fieldConfig) => (
                        <FilterBarField
                            key={fieldConfig.key}
                            config={fieldConfig}
                            value={values[fieldConfig.key]}
                            onChange={(value) => handleFieldChange(fieldConfig.key, value)}
                        />
                    ))}
                </div>
                <div className="p-4 border-t grid grid-cols-3 gap-3 bg-slate-50">
                    <Button variant="outline" onClick={handleClear} className="col-span-1 h-11 rounded-xl">
                        Clear
                    </Button>
                    <Button variant="default" onClick={handleApply} className="col-span-2 h-11 rounded-xl shadow-sm">
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Apply'}
                    </Button>
                </div>
                {onAdaptFilter && (
                    <FilterSettingsDialog
                        open={showFilterSettings}
                        onOpenChange={setShowFilterSettings}
                        filters={filterSettingsItems}
                        onApply={handleFilterSettingsApply}
                    />
                )}
            </div>
        );
    }

    return (
        <>
            <div
                className={`bg-white rounded-xl border border-slate-200 hover:border-primary/40 transition-all shadow-sm ${className}`}
                onKeyDown={handleKeyDown}
            >
                {/* Header row with Go button and toggle */}
                <div className={`flex items-center gap-2 sm:gap-3 px-4 py-2 ${isExpanded ? 'border-b border-border/60' : ''}`}>
                    {/* Left slot (e.g. title) */}
                    {headerLeft && <div className="mr-auto">{headerLeft}</div>}

                    {/* Right-aligned actions */}
                    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${!headerLeft ? 'ml-auto' : ''}`}>
                        {/* Go Button */}
                        <Button
                            onClick={handleApply}
                            variant="default"
                            className="min-w-0 sm:min-w-[60px] px-2.5 sm:px-3"
                        >
                            Go
                        </Button>

                        {/* Adapt Filter Button */}
                        {onAdaptFilter && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary hover:bg-primary/5 sm:w-auto px-2 sm:px-3"
                                title="Adapt Filter"
                                onClick={() => setShowFilterSettings(true)}
                            >
                                <ListFilter className="w-4 h-4" />
                            </Button>
                        )}

                        {/* Hide/Show Filter Bar Toggle */}
                        <Button
                            onClick={() => setIsExpanded(!isExpanded)}
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/5 sm:w-auto px-2 sm:px-3"
                            title={isExpanded ? 'Hide Filter' : 'Show Filter'}
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                        </Button>

                        {/* Clear Filters */}
                        <Button
                            onClick={handleClear}
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/5 sm:w-auto px-2 sm:px-3"
                            title="Clear Filters"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Filter Fields Area (Collapsible) */}
                {isExpanded && (
                    <div className="px-4 py-4">
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-6 gap-y-4">
                            {visibleFilters.map((fieldConfig) => (
                                <FilterBarField
                                    key={fieldConfig.key}
                                    config={fieldConfig}
                                    value={values[fieldConfig.key]}
                                    onChange={(value) => handleFieldChange(fieldConfig.key, value)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Filter Settings Dialog */}
            {onAdaptFilter && (
                <FilterSettingsDialog
                    open={showFilterSettings}
                    onOpenChange={setShowFilterSettings}
                    filters={filterSettingsItems}
                    onApply={handleFilterSettingsApply}
                />
            )}
        </>
    );
}
