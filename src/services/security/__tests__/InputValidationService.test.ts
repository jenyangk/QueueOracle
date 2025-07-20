/**
 * Unit tests for InputValidationService
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidationService } from '../InputValidationService';

describe('InputValidationService', () => {
  let validationService: InputValidationService;

  beforeEach(() => {
    validationService = new InputValidationService();
  });

  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World';
      const sanitized = validationService.sanitizeInput(maliciousInput);
      
      expect(sanitized).toBe('Hello World');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove event handlers', () => {
      const maliciousInput = '<div onclick="alert(\'xss\')">Click me</div>';
      const sanitized = validationService.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('Click me');
    });

    it('should remove javascript: URLs', () => {
      const maliciousInput = '<a href="javascript:alert(\'xss\')">Link</a>';
      const sanitized = validationService.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('javascript:');
      expect(sanitized).toContain('Link');
    });

    it('should preserve safe HTML', () => {
      const safeInput = '<p>This is <strong>safe</strong> content</p>';
      const sanitized = validationService.sanitizeInput(safeInput);
      
      expect(sanitized).toContain('<p>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('safe');
    });

    it('should handle empty input', () => {
      const sanitized = validationService.sanitizeInput('');
      expect(sanitized).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(validationService.sanitizeInput(null as any)).toBe('');
      expect(validationService.sanitizeInput(undefined as any)).toBe('');
    });
  });

  describe('validateConnectionString', () => {
    it('should validate valid Service Bus connection string', () => {
      const validConnectionString = 'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test123=';
      const result = validationService.validateConnectionString(validConnectionString);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject connection string without endpoint', () => {
      const invalidConnectionString = 'SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test123=';
      const result = validationService.validateConnectionString(invalidConnectionString);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing Endpoint');
    });

    it('should reject connection string without SharedAccessKeyName', () => {
      const invalidConnectionString = 'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKey=test123=';
      const result = validationService.validateConnectionString(invalidConnectionString);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing SharedAccessKeyName');
    });

    it('should reject connection string without SharedAccessKey', () => {
      const invalidConnectionString = 'Endpoint=sb://test.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey';
      const result = validationService.validateConnectionString(invalidConnectionString);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing SharedAccessKey');
    });

    it('should reject malformed endpoint URL', () => {
      const invalidConnectionString = 'Endpoint=invalid-url;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=test123=';
      const result = validationService.validateConnectionString(invalidConnectionString);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid Endpoint URL format');
    });

    it('should handle empty connection string', () => {
      const result = validationService.validateConnectionString('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateJSON', () => {
    it('should validate valid JSON', () => {
      const validJSON = '{"name": "test", "value": 123}';
      const result = validationService.validateJSON(validJSON);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual({ name: 'test', value: 123 });
    });

    it('should reject invalid JSON syntax', () => {
      const invalidJSON = '{"name": "test", "value": }';
      const result = validationService.validateJSON(invalidJSON);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.parsed).toBeNull();
    });

    it('should handle empty JSON string', () => {
      const result = validationService.validateJSON('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Empty JSON string');
    });

    it('should validate nested JSON objects', () => {
      const nestedJSON = '{"user": {"name": "test", "settings": {"theme": "dark"}}}';
      const result = validationService.validateJSON(nestedJSON);
      
      expect(result.isValid).toBe(true);
      expect((result.parsed as any)?.user?.settings?.theme).toBe('dark');
    });

    it('should validate JSON arrays', () => {
      const jsonArray = '[{"id": 1}, {"id": 2}]';
      const result = validationService.validateJSON(jsonArray);
      
      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.parsed)).toBe(true);
      expect(result.parsed).toHaveLength(2);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@.com',
        'user@domain.',
        '',
      ];

      invalidEmails.forEach(email => {
        const result = validationService.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateURL', () => {
    it('should validate correct URLs', () => {
      const validURLs = [
        'https://example.com',
        'http://test.org',
        'https://sub.domain.com/path?query=value',
        'https://localhost:3000',
        'https://192.168.1.1:8080',
      ];

      validURLs.forEach(url => {
        const result = validationService.validateURL(url);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid URLs', () => {
      const invalidURLs = [
        'not-a-url',
        'ftp://example.com', // Only http/https allowed
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        '',
        'http://',
        'https://',
      ];

      invalidURLs.forEach(url => {
        const result = validationService.validateURL(url);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateMessageFilter', () => {
    it('should validate valid message filter', () => {
      const validFilter = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        fieldFilters: [
          {
            fieldPath: 'user.id',
            operator: 'equals' as const,
            value: '123',
          },
        ],
        messageTypes: ['order', 'payment'],
        textSearch: 'test search',
      };

      const result = validationService.validateMessageFilter(validFilter);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject filter with invalid date range', () => {
      const invalidFilter = {
        dateRange: {
          start: new Date('2023-12-31'),
          end: new Date('2023-01-01'), // End before start
        },
        fieldFilters: [],
        messageTypes: [],
        textSearch: '',
      };

      const result = validationService.validateMessageFilter(invalidFilter);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date must be after start date');
    });

    it('should reject filter with invalid field path', () => {
      const invalidFilter = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        fieldFilters: [
          {
            fieldPath: '', // Empty field path
            operator: 'equals' as const,
            value: '123',
          },
        ],
        messageTypes: [],
        textSearch: '',
      };

      const result = validationService.validateMessageFilter(invalidFilter);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Field path cannot be empty');
    });

    it('should reject filter with invalid regex', () => {
      const invalidFilter = {
        dateRange: {
          start: new Date('2023-01-01'),
          end: new Date('2023-12-31'),
        },
        fieldFilters: [
          {
            fieldPath: 'test.field',
            operator: 'regex' as const,
            value: '[invalid-regex', // Invalid regex pattern
          },
        ],
        messageTypes: [],
        textSearch: '',
      };

      const result = validationService.validateMessageFilter(invalidFilter);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Invalid regex pattern'))).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('should track validation attempts', () => {
      const input = 'test input';
      
      // Make multiple validation calls
      for (let i = 0; i < 5; i++) {
        validationService.sanitizeInput(input);
      }

      // Should not throw or fail - just tracking for now
      expect(() => validationService.sanitizeInput(input)).not.toThrow();
    });

    it('should handle high frequency validation requests', () => {
      const inputs = Array.from({ length: 100 }, (_, i) => `test input ${i}`);
      
      expect(() => {
        inputs.forEach(input => validationService.sanitizeInput(input));
      }).not.toThrow();
    });
  });

  describe('security patterns', () => {
    it('should detect SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users --",
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const sanitized = validationService.sanitizeInput(attempt);
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('UNION SELECT');
        expect(sanitized).not.toContain("'--");
      });
    });

    it('should detect XSS attempts', () => {
      const xssAttempts = [
        '<img src="x" onerror="alert(1)">',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<object data="javascript:alert(1)">',
      ];

      xssAttempts.forEach(attempt => {
        const sanitized = validationService.sanitizeInput(attempt);
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onload');
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should handle encoded malicious content', () => {
      const encodedXSS = '&lt;script&gt;alert(1)&lt;/script&gt;';
      const sanitized = validationService.sanitizeInput(encodedXSS);
      
      // Should decode and then sanitize
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('alert');
    });
  });
});