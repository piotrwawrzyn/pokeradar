/**
 * Safely closes a resource with a timeout.
 * If close() hangs, the timeout resolves and cleanup continues.
 *
 * @param closeable - Object with a close() method
 * @param timeoutMs - Maximum time to wait for close (default: 5000ms)
 */
export async function safeClose(
  closeable: { close(): Promise<void> } | null | undefined,
  timeoutMs: number = 5000
): Promise<void> {
  if (!closeable) {
    return;
  }

  try {
    await Promise.race([
      closeable.close(),
      new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
    ]);
  } catch {
    // Swallow error - cleanup continues regardless
  }
}
