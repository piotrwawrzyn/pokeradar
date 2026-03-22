import { withTimeout, TaskTimeoutError } from '../scan-cycle-runner';

describe('withTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves with the value when promise settles before timeout', async () => {
    const promise = withTimeout(Promise.resolve('ok'), 1000);
    await expect(promise).resolves.toBe('ok');
  });

  it('rejects with the original error when promise rejects before timeout', async () => {
    const error = new Error('boom');
    const promise = withTimeout(Promise.reject(error), 1000);
    await expect(promise).rejects.toBe(error);
  });

  it('rejects with TaskTimeoutError when promise does not settle in time', async () => {
    const neverResolves = new Promise<string>(() => {});
    const promise = withTimeout(neverResolves, 5000);

    jest.advanceTimersByTime(5000);

    await expect(promise).rejects.toThrow(TaskTimeoutError);
    await expect(promise).rejects.toThrow('Task timed out after 5000ms');
  });

  it('clears the timer when promise resolves before timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const promise = withTimeout(Promise.resolve(42), 10000);
    await expect(promise).resolves.toBe(42);

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('clears the timer when promise rejects before timeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const promise = withTimeout(Promise.reject(new Error('fail')), 10000);
    await expect(promise).rejects.toThrow('fail');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});

describe('TaskTimeoutError', () => {
  it('has the correct name and message', () => {
    const error = new TaskTimeoutError(3000);
    expect(error.name).toBe('TaskTimeoutError');
    expect(error.message).toBe('Task timed out after 3000ms');
    expect(error).toBeInstanceOf(Error);
  });
});
