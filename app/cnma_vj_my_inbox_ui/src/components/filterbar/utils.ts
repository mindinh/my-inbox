import type { FilterFieldConfig, FilterValues } from './types';

/**
 * Initializes empty filter values from filter configuration
 */
export function initializeFilterValues(config: FilterFieldConfig[]): FilterValues {
    const initialValues: FilterValues = {};

    config.forEach((field) => {
        switch (field.type) {
            case 'text':
                initialValues[field.key] = '';
                break;
            case 'multiselect':
                initialValues[field.key] = [];
                break;
            case 'dateRange':
                initialValues[field.key] = { from: undefined, to: undefined };
                break;
            case 'select':
                initialValues[field.key] = undefined;
                break;
            default:
                initialValues[(field as any).key] = undefined;
        }
    });

    return initialValues;
}
