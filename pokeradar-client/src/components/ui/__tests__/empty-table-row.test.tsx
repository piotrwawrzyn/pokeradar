import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyTableRow } from '../empty-table-row';

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <table>
      <tbody>{children}</tbody>
    </table>
  );
}

describe('EmptyTableRow', () => {
  it('renders the message', () => {
    render(
      <TableWrapper>
        <EmptyTableRow colSpan={3} message="No data" />
      </TableWrapper>,
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('sets colSpan on the cell', () => {
    render(
      <TableWrapper>
        <EmptyTableRow colSpan={5} message="Empty" />
      </TableWrapper>,
    );
    const cell = screen.getByText('Empty').closest('td');
    expect(cell).toHaveAttribute('colspan', '5');
  });
});
