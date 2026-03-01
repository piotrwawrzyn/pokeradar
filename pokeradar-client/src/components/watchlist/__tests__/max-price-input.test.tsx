import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/context/auth-context';
import { MaxPriceInput } from '@/components/watchlist/max-price-input';
import { mockUser } from '../../../__tests__/mocks/data';
import { server } from '../../../__tests__/mocks/server';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

const authValue = {
  token: 'test',
  user: mockUser,
  isAuthenticated: true,
  isLoading: false,
  login: () => {},
  logout: async () => {},
};

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

function renderInput(props?: Partial<Parameters<typeof MaxPriceInput>[0]>) {
  return render(
    <Wrapper>
      <MaxPriceInput entryId="watch-1" currentMaxPrice={200} currentBestPrice={150} {...props} />
    </Wrapper>,
  );
}

/**
 * Open the inline editor and set a new value, returning a fresh input reference.
 *
 * fireEvent.change is used because userEvent.type on number inputs in happy-dom
 * appends to the existing value rather than replacing it.
 * act() flushes React state so subsequent event handlers read the updated value.
 *
 * NOTE: the new value must be ≤ max (= max(currentBestPrice, currentMaxPrice))
 * because MaxPriceInput clamps the confirmed value with Math.min(parsed, max).
 */
async function openAndSetValue(fromPrice: number, toValue: string) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(String(fromPrice)) }));
  await act(async () => {
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: toValue } });
  });
  return screen.getByRole('spinbutton');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MaxPriceInput', () => {
  it('displays the current max price', () => {
    renderInput({ currentMaxPrice: 200 });
    expect(screen.getByRole('button', { name: /200/ })).toBeInTheDocument();
  });

  it('switches to an input field when the button is clicked', async () => {
    renderInput();

    await userEvent.click(screen.getByRole('button', { name: /200/ }));

    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /200/ })).not.toBeInTheDocument();
  });

  it('pre-fills the input with the current value when editing starts', async () => {
    renderInput({ currentMaxPrice: 200 });

    await userEvent.click(screen.getByRole('button', { name: /200/ }));

    expect(screen.getByRole('spinbutton')).toHaveValue(200);
  });

  it('reverts to display mode on Escape without changing the value', async () => {
    renderInput({ currentMaxPrice: 200 });

    const input = await openAndSetValue(200, '180');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByRole('button', { name: /200/ })).toBeInTheDocument();
  });

  it('confirms the new value on Enter and displays it immediately', async () => {
    // max = max(currentBestPrice=150, currentMaxPrice=200) = 200; new value 180 ≤ 200
    renderInput({ currentMaxPrice: 200, currentBestPrice: 150 });

    const input = await openAndSetValue(200, '180');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('button', { name: /180/ })).toBeInTheDocument();
  });

  it('sends PATCH after debounce when value is confirmed with Enter', async () => {
    let patchedValue: number | undefined;
    server.use(
      http.patch('http://localhost:3000/watchlist/watch-1', async ({ request }) => {
        const body = (await request.json()) as { maxPrice: number };
        patchedValue = body.maxPrice;
        return HttpResponse.json({ id: 'watch-1', maxPrice: body.maxPrice });
      }),
    );

    renderInput({ currentMaxPrice: 200, currentBestPrice: 150 });

    // Open editor with real timers (userEvent hangs with fake timers in happy-dom)
    const input = await openAndSetValue(200, '180');

    // Switch to fake timers before confirming so we can skip the 500ms debounce.
    // Restore real timers before waitFor — waitFor uses setTimeout internally.
    vi.useFakeTimers();
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    await waitFor(() => expect(patchedValue).toBe(180));
  });

  it('confirms the new value on blur and sends PATCH after debounce', async () => {
    let patchedValue: number | undefined;
    server.use(
      http.patch('http://localhost:3000/watchlist/watch-1', async ({ request }) => {
        const body = (await request.json()) as { maxPrice: number };
        patchedValue = body.maxPrice;
        return HttpResponse.json({ id: 'watch-1', maxPrice: body.maxPrice });
      }),
    );

    renderInput({ currentMaxPrice: 200, currentBestPrice: 150 });

    const input = await openAndSetValue(200, '180');

    vi.useFakeTimers();
    fireEvent.blur(input);
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    vi.useRealTimers();

    expect(screen.getByRole('button', { name: /180/ })).toBeInTheDocument();
    await waitFor(() => expect(patchedValue).toBe(180));
  });

  it('does not reset the displayed value when the prop briefly reverts to the old pending value (regression)', async () => {
    // Bug: after confirming 180, if an in-flight old mutation causes currentMaxPrice
    // to briefly come back as 200, the display must NOT flash back.
    const { rerender } = render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={200} currentBestPrice={150} />
      </Wrapper>,
    );

    const input = await openAndSetValue(200, '180');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('button', { name: /180/ })).toBeInTheDocument();

    // Simulate the prop briefly coming back as 200 (old mutation refetch)
    rerender(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={200} currentBestPrice={150} />
      </Wrapper>,
    );

    // Must still show 180, not flash back to 200
    expect(screen.getByRole('button', { name: /180/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /200/ })).not.toBeInTheDocument();
  });

  it('resets the value when currentMaxPrice changes externally to something never sent', () => {
    const { rerender } = render(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={200} currentBestPrice={150} />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: /200/ })).toBeInTheDocument();

    rerender(
      <Wrapper>
        <MaxPriceInput entryId="watch-1" currentMaxPrice={300} currentBestPrice={150} />
      </Wrapper>,
    );

    expect(screen.getByRole('button', { name: /300/ })).toBeInTheDocument();
  });

  it('is disabled when the disabled prop is true', () => {
    renderInput({ disabled: true });
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not enter edit mode when disabled', async () => {
    renderInput({ disabled: true });

    await userEvent.click(screen.getByRole('button'));

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('renders the slider when currentBestPrice is provided', () => {
    renderInput({ currentBestPrice: 150 });
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });
});
