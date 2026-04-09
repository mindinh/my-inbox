
type SortDirection = 'asc' | 'desc';

interface QueryParams {
  $top?: number;
  $skip?: number;
  $filter?: string;
  $select?: string;
  $expand?: string;
  $orderby?: string;
  $count?: boolean;
  $search?: string;
  [key: string]: string | number | boolean | undefined;
}

export class ODataQueryBuilder {
  private params: QueryParams = {};

  top(value: number): this {
    this.params.$top = value;
    return this;
  }

  skip(value: number): this {
    this.params.$skip = value;
    return this;
  }

  filter(condition: string): this {
    this.params.$filter = condition;
    return this;
  }

  select(fields: string | string[]): this {
    this.params.$select = Array.isArray(fields) ? fields.join(',') : fields;
    return this;
  }

  expand(navigation: string): this {
    this.params.$expand = navigation;
    return this;
  }

  orderBy(field: string, direction: SortDirection = 'asc'): this {
    this.params.$orderby = `${field} ${direction}`;
    return this;
  }

  count(value: boolean = true): this {
    this.params.$count = value;
    return this;
  }

  search(term: string): this {
    this.params.$search = term;
    return this;
  }

  build(): string {
    return Object.entries(this.params)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
      .join('&');
  }

  reset(): this {
    this.params = {};
    return this;
  }

  getParams(): QueryParams {
    return { ...this.params };
  }
}

function formatValue(value: string | number | boolean | Date): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

export const ODataFilter = {
  eq: (field: string, value: string | number | boolean | Date): string =>
    `${field} eq ${formatValue(value)}`,

  ne: (field: string, value: string | number | boolean | Date): string =>
    `${field} ne ${formatValue(value)}`,

  gt: (field: string, value: string | number | Date): string =>
    `${field} gt ${formatValue(value)}`,

  ge: (field: string, value: string | number | Date): string =>
    `${field} ge ${formatValue(value)}`,

  lt: (field: string, value: string | number | Date): string =>
    `${field} lt ${formatValue(value)}`,

  le: (field: string, value: string | number | Date): string =>
    `${field} le ${formatValue(value)}`,

  contains: (field: string, value: string): string =>
    `contains(${field},${formatValue(value)})`,

  containsIgnoreCase: (field: string, value: string): string =>
    `contains(tolower(${field}),tolower(${formatValue(value)}))`,

  startsWith: (field: string, value: string): string =>
    `startswith(${field},${formatValue(value)})`,

  endsWith: (field: string, value: string): string =>
    `endswith(${field},${formatValue(value)})`,

  and: (...conditions: string[]): string =>
    `(${conditions.join(' and ')})`,

  or: (...conditions: string[]): string =>
    `(${conditions.join(' or ')})`,

  not: (condition: string): string =>
    `not (${condition})`,

  in: (field: string, values: (string | number)[]): string =>
    `${field} in (${values.map(v => formatValue(v as any)).join(',')})`,
};
