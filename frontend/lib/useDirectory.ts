'use client';

import { useState } from 'react';
import { toQueryString } from './api';
import { DirectoryFilters, EmployeePage, SortField, SortState } from './types';
import { useApiData } from './useApiData';

export const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 180;
const EMPTY_FILTERS: DirectoryFilters = {
  search: '',
  country: '',
  department: '',
  level: '',
  currency: '',
  minSalary: '',
  maxSalary: '',
};

/** Directory state (filters, sort, page) and the server-paginated employee query it drives. */
export function useDirectory(onUnauthorized: () => void) {
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ by: 'fullName', order: 'asc' });
  const [page, setPage] = useState(1);

  // Salary bounds and salary sorting are only meaningful within one currency.
  const hasCurrency = Boolean(filters.currency);
  const filterParams = {
    ...filters,
    minSalary: hasCurrency ? filters.minSalary : '',
    maxSalary: hasCurrency ? filters.maxSalary : '',
  };
  const effectiveSort = sort.by === 'salary' && !hasCurrency ? { by: 'fullName' as const, order: 'asc' as const } : sort;
  const exportQuery = toQueryString({ ...filterParams, sortBy: effectiveSort.by, sortOrder: effectiveSort.order });
  const listQuery = toQueryString({ ...filterParams, sortBy: effectiveSort.by, sortOrder: effectiveSort.order, page, limit: PAGE_SIZE });

  const { data, error, loading, reload, clearError } = useApiData<EmployeePage>(`/employees?${listQuery}`, {
    onUnauthorized,
    fallbackMessage: 'Employee records could not be loaded.',
    debounceMs: SEARCH_DEBOUNCE_MS,
  });

  function setFilter(name: keyof DirectoryFilters, value: string) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  function toggleSort(field: SortField) {
    setSort((current) =>
      current.by === field ? { by: field, order: current.order === 'asc' ? 'desc' : 'asc' } : { by: field, order: 'asc' },
    );
    setPage(1);
  }

  return {
    filters,
    setFilter,
    sort: effectiveSort,
    toggleSort,
    page,
    setPage,
    hasCurrency,
    exportQuery,
    result: data,
    error,
    loading,
    reload,
    clearError,
  };
}
