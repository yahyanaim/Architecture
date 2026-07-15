// Centralized config for secrets and app-wide constants
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-12345678901234567890';
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';

export default { JWT_SECRET, JWT_EXPIRES_IN };