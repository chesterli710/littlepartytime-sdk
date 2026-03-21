import { describe, it, expect } from 'vitest';
import { getLanAddress } from '../server/lan-address';

describe('getLanAddress', () => {
  it('should return a string or null', () => {
    const result = getLanAddress();
    if (result !== null) {
      expect(result).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      expect(result).not.toBe('127.0.0.1');
    }
  });
});
