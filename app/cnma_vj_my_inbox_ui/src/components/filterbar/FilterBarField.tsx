import { Input } from '@/components/ui/input';
import { MultiSelectFilter } from '@/components/ui/multi-select-filter';
import { DateRangeFilter } from '@/components/ui/date-range-filter';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { FilterFieldConfig } from './types';

interface FilterBarFieldProps {
    config: FilterFieldConfig;
    value: any;
    onChange: (value: any) => void;
}

export function FilterBarField({ config, value, onChange }: FilterBarFieldProps) {
    const label = config.label;
    const placeholder = config.placeholder || 'Select...';

    return (
        <div className="space-y-1.5 flex flex-col" style={{ width: config.width }}>
            <Label className="text-sm font-medium text-foreground mb-1 whitespace-normal break-words">
                {label} {config.required && <span className="text-destructive">*</span>}
            </Label>

            <div className="flex-1">
                {renderFilterControl(config, value, onChange, placeholder)}
            </div>
        </div>
    );
}

function renderFilterControl(
    config: FilterFieldConfig,
    value: any,
    onChange: (value: any) => void,
    placeholder: string
) {
    switch (config.type) {
        case 'text':
            return (
                <Input
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    maxLength={config.maxLength}
                    className="h-8 bg-background"
                />
            );

        case 'select':
            return (
                <Select value={value || ''} onValueChange={(v) => onChange(v === '__all__' ? undefined : v)}>
                    <SelectTrigger className="h-8 bg-background">
                        <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {config.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                    {opt.icon && <opt.icon className="w-4 h-4" />}
                                    <span>{opt.label}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            );

        case 'multiselect':
            return (
                <MultiSelectFilter
                    config={config}
                    value={value}
                    onChange={onChange}
                />
            );

        case 'dateRange':
            return (
                <DateRangeFilter
                    config={config}
                    value={value}
                    onChange={onChange}
                />
            );

        default:
            return null;
    }
}
