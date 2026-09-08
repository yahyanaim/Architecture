import { describe, it, expect } from 'vitest';
import { isUpgradeRequired } from './billingApi';

// The global plan-gate redirect hinges on this predicate: 403 +
// code 'upgrade_required' routes to pricing, everything else surfaces normally.
function axiosLike(status?: number, code?: string) {
  return {
    isAxiosError: true,
    response: status === undefined ? undefined : { status, data: code === undefined ? {} : { code } },
  };
}

describe('isUpgradeRequired', () => {
  it('detects plan-gate rejections', () => {
    expect(isUpgradeRequired(axiosLike(403, 'upgrade_required'))).toBe(true);
  });

  it('ignores other 403s, statuses, and non-axios errors', () => {
    expect(isUpgradeRequired(axiosLike(403, 'other'))).toBe(false);
    expect(isUpgradeRequired(axiosLike(403))).toBe(false);
    expect(isUpgradeRequired(axiosLike(401, 'upgrade_required'))).toBe(false);
    expect(isUpgradeRequired(axiosLike())).toBe(false);
    expect(isUpgradeRequired(new Error('boom'))).toBe(false);
    expect(isUpgradeRequired(null)).toBe(false);
  });
});
