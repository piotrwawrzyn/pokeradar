import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepNumber } from '@/components/notifications/step-number';

describe('StepNumber', () => {
  it('renders the step number', () => {
    render(<StepNumber number={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
