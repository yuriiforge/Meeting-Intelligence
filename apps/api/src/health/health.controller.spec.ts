import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ok status', () => {
    const result = new HealthController().check();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
