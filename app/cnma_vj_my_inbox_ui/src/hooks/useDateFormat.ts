import { useTranslation } from 'react-i18next';
import { formatDate, formatDateTime } from '@/utils/formatters/date';

export function useDateFormatter() {
  const { i18n } = useTranslation();

  return {
    formatDate: (value?: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const dateString = value instanceof Date ? value.toISOString() : value;
      return formatDate(dateString, i18n.language, options);
    },
    formatDateTime: (value?: string | Date, options?: Intl.DateTimeFormatOptions) => {
      const dateString = value instanceof Date ? value.toISOString() : value;
      return formatDateTime(dateString, i18n.language, options);
    },
  };
}
