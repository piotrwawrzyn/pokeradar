import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExpandedRows } from '@/hooks/use-expanded-rows';

describe('useExpandedRows', () => {
  it('starts with no expanded rows', () => {
    const { result } = renderHook(() => useExpandedRows());
    expect(result.current.isExpanded('row-1')).toBe(false);
  });

  it('expands a row when toggled', () => {
    const { result } = renderHook(() => useExpandedRows());
    act(() => result.current.toggleRow('row-1'));
    expect(result.current.isExpanded('row-1')).toBe(true);
  });

  it('collapses a row when toggled twice', () => {
    const { result } = renderHook(() => useExpandedRows());
    act(() => result.current.toggleRow('row-1'));
    act(() => result.current.toggleRow('row-1'));
    expect(result.current.isExpanded('row-1')).toBe(false);
  });

  it('handles multiple rows independently', () => {
    const { result } = renderHook(() => useExpandedRows());
    act(() => result.current.toggleRow('row-1'));
    expect(result.current.isExpanded('row-1')).toBe(true);
    expect(result.current.isExpanded('row-2')).toBe(false);
  });
});
