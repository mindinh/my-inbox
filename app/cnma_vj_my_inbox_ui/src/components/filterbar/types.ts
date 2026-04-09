import type { LucideIcon } from 'lucide-react';

// ============================================
// Filter Value Types
// ============================================

export interface DateRange {
    from: Date | undefined;
    to: Date | undefined;
}

export interface SelectOption {
    value: string;
    label: string;
    icon?: LucideIcon;
}

// ============================================
// Filter Field Configuration Types
// ============================================

interface BaseFilterConfig {
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    visible?: boolean;
    width?: string;
}

export interface TextFilterConfig extends BaseFilterConfig {
    type: 'text';
    maxLength?: number;
}

export interface SelectFilterConfig extends BaseFilterConfig {
    type: 'select';
    options?: SelectOption[];
}

export interface MultiSelectFilterConfig extends BaseFilterConfig {
    type: 'multiselect';
    options?: SelectOption[];
    optionsLoader?: () => Promise<SelectOption[]>;
    showSelectAll?: boolean;
}

export interface DateRangeFilterConfig extends BaseFilterConfig {
    type: 'dateRange';
    numberOfMonths?: 1 | 2;
}

export type FilterFieldConfig =
    | TextFilterConfig
    | SelectFilterConfig
    | MultiSelectFilterConfig
    | DateRangeFilterConfig;

// ============================================
// Filter Values Type
// ============================================

export type FilterValues = Record<string, any>;

// ============================================
// FilterBar Component Props
// ============================================

export interface FilterBarProps {
    config: FilterFieldConfig[];
    values: FilterValues;
    onChange: (values: FilterValues) => void;
    onApply: (values: FilterValues) => void;
    onClear?: () => void;
    isLoading?: boolean;
    defaultExpanded?: boolean;
    className?: string;
    headerLeft?: React.ReactNode;
    allFilterConfig?: FilterFieldConfig[];
    onAdaptFilter?: (filters: FilterSettingItem[]) => void;
    isMobile?: boolean;
}

export interface FilterSettingItem {
    name: string;
    label: string;
    visible: boolean;
}

// ============================================
// Individual Filter Component Props
// ============================================

export interface FilterComponentProps<T = any> {
    config: T;
    value: any;
    onChange: (value: any) => void;
}
