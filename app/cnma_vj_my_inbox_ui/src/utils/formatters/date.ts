export function formatDate(
  value?: string,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) return '-';

  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
  };

  return new Intl.DateTimeFormat(locale, options || defaultOptions).format(date);
}

/**
 * Formats a UTC date/time string to display in local timezone with both date and time.
 */
export function formatDateTime(
  value?: string,
  locale: string = 'en',
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) return '-';

  const date = new Date(value);
  if (isNaN(date.getTime())) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  };

  const resolvedLocale = locale || navigator.language || 'en';
  return new Intl.DateTimeFormat(resolvedLocale, options || defaultOptions).format(date);
}
