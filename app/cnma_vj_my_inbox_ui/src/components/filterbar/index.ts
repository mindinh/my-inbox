/**
 * FilterBar System
 *
 * A configuration-driven filter bar following SAP UI5 patterns.
 */

// Main component
export { FilterBar } from './FilterBar';
export { FilterBarField } from './FilterBarField';
export { FilterSettingsDialog } from './FilterSettingsDialog';

// Utilities
export { initializeFilterValues } from './utils';

// Types
export type {
    FilterBarProps,
    FilterFieldConfig,
    FilterValues,
    FilterComponentProps,
    TextFilterConfig,
    SelectFilterConfig,
    MultiSelectFilterConfig,
    DateRangeFilterConfig,
    DateRange,
    SelectOption,
    FilterSettingItem,
} from './types';
