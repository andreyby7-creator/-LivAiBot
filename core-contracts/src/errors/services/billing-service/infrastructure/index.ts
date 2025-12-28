// ==================== INFRASTRUCTURE ERRORS ====================

// WebPay API Errors
export * from './WebPayAPIError.js';

// BePaid API Errors
export * from './BePaidAPIError.js';

// Payment Gateway Unavailable Error (system-level)
export * from './PaymentGatewayUnavailableError.js';

// Generic API Error (fallback for unknown responses)
export * from './GenericAPIError.js';

// Future infrastructure errors will be added here:
// export * from './BankAPIError.js';
