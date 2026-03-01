import { ProductResult } from '@pokeradar/shared';
import { ResultBuffer, IProductResultRepository } from '../result-buffer';

function makeResult(id: string): ProductResult {
  return {
    productId: id,
    shopId: 'shop-1',
    productUrl: `https://shop.com/${id}`,
    productTitle: id,
    price: 100,
    isAvailable: true,
    timestamp: new Date(),
  } as unknown as ProductResult;
}

function makeRepo(
  overrides?: Partial<IProductResultRepository>,
): jest.Mocked<IProductResultRepository> {
  return {
    upsertHourlyBatch: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<IProductResultRepository>;
}

describe('ResultBuffer', () => {
  describe('add() / size()', () => {
    it('starts empty', () => {
      expect(new ResultBuffer().size()).toBe(0);
    });

    it('increments size with each added result', () => {
      const buffer = new ResultBuffer();
      buffer.add(makeResult('p1'));
      buffer.add(makeResult('p2'));
      expect(buffer.size()).toBe(2);
    });
  });

  describe('clear()', () => {
    it('empties the buffer without writing to the database', () => {
      const repo = makeRepo();
      const buffer = new ResultBuffer(repo);
      buffer.add(makeResult('p1'));
      buffer.clear();
      expect(buffer.size()).toBe(0);
      expect(repo.upsertHourlyBatch).not.toHaveBeenCalled();
    });
  });

  describe('flush()', () => {
    it('calls upsertHourlyBatch with all buffered results', async () => {
      const repo = makeRepo();
      const buffer = new ResultBuffer(repo);
      const r1 = makeResult('p1');
      const r2 = makeResult('p2');
      buffer.add(r1);
      buffer.add(r2);

      await buffer.flush();

      expect(repo.upsertHourlyBatch).toHaveBeenCalledWith([r1, r2]);
    });

    it('clears the buffer after a successful flush', async () => {
      const repo = makeRepo();
      const buffer = new ResultBuffer(repo);
      buffer.add(makeResult('p1'));

      await buffer.flush();

      expect(buffer.size()).toBe(0);
    });

    it('is a no-op when the buffer is empty', async () => {
      const repo = makeRepo();
      const buffer = new ResultBuffer(repo);

      await buffer.flush();

      expect(repo.upsertHourlyBatch).not.toHaveBeenCalled();
    });

    it('is a no-op when no repository is configured', async () => {
      const buffer = new ResultBuffer();
      buffer.add(makeResult('p1'));
      await expect(buffer.flush()).resolves.toBeUndefined();
      // buffer is still cleared even without a repo
      expect(buffer.size()).toBe(0);
    });

    it('clears the buffer even when upsertHourlyBatch throws', async () => {
      const repo = makeRepo({
        upsertHourlyBatch: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const logger = { info: jest.fn(), error: jest.fn() };
      const buffer = new ResultBuffer(repo, logger);
      buffer.add(makeResult('p1'));

      await buffer.flush();

      expect(buffer.size()).toBe(0);
    });

    it('logs an error when upsertHourlyBatch throws', async () => {
      const repo = makeRepo({
        upsertHourlyBatch: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const logger = { info: jest.fn(), error: jest.fn() };
      const buffer = new ResultBuffer(repo, logger);
      buffer.add(makeResult('p1'));

      await buffer.flush();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to flush scan results',
        expect.objectContaining({ error: 'DB down' }),
      );
    });
  });
});
