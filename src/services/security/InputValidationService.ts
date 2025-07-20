export interface ValidationRule {
  name: string;
  validator: (value: unknown) => boolean;
  message: string;
  sanitizer?: (value: string) => string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedValue?: unknown;
}

export interface ValidationSchema {
  [field: string]: ValidationRule[];
}

export class InputValidationService {
  private readonly commonRules: Record<string, ValidationRule> = {
    required: {
      name: 'required',
      validator: (value) => value !== null && value !== undefined && value !== '',
      message: 'This field is required'
    },
    
    email: {
      name: 'email',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      },
      message: 'Please enter a valid email address'
    },
    
    url: {
      name: 'url',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Please enter a valid URL'
    },
    
    connectionString: {
      name: 'connectionString',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        // Basic Azure Service Bus connection string validation
        return value.includes('Endpoint=') && 
               (value.includes('SharedAccessKeyName=') || value.includes('SharedAccessSignature='));
      },
      message: 'Please enter a valid Azure Service Bus connection string'
    },
    
    noScript: {
      name: 'noScript',
      validator: (value) => {
        if (typeof value !== 'string') return true;
        const scriptRegex = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        return !scriptRegex.test(value);
      },
      message: 'Script tags are not allowed',
      sanitizer: (value: string) => value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    },
    
    noHtml: {
      name: 'noHtml',
      validator: (value) => {
        if (typeof value !== 'string') return true;
        const htmlRegex = /<[^>]*>/g;
        return !htmlRegex.test(value);
      },
      message: 'HTML tags are not allowed',
      sanitizer: (value: string) => value.replace(/<[^>]*>/g, '')
    },
    
    alphanumeric: {
      name: 'alphanumeric',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        return /^[a-zA-Z0-9]+$/.test(value);
      },
      message: 'Only alphanumeric characters are allowed'
    }
  };

  // Factory methods for parameterized rules
  public minLength(min: number): ValidationRule {
    return {
      name: 'minLength',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        return value.length >= min;
      },
      message: `Minimum length is ${min} characters`
    };
  }

  public maxLength(max: number): ValidationRule {
    return {
      name: 'maxLength',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        return value.length <= max;
      },
      message: `Maximum length is ${max} characters`
    };
  }

  public pattern(regex: RegExp, message: string): ValidationRule {
    return {
      name: 'pattern',
      validator: (value) => {
        if (typeof value !== 'string') return false;
        return regex.test(value);
      },
      message
    };
  }

  public validateField(value: unknown, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    let sanitizedValue = value;

    for (const rule of rules) {
      if (!rule.validator(value)) {
        errors.push(rule.message);
      } else if (rule.sanitizer && typeof value === 'string') {
        sanitizedValue = rule.sanitizer(value);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedValue: errors.length === 0 ? sanitizedValue : undefined
    };
  }

  public validateObject(data: Record<string, unknown>, schema: ValidationSchema): {
    isValid: boolean;
    errors: Record<string, string[]>;
    sanitizedData: Record<string, unknown>;
  } {
    const errors: Record<string, string[]> = {};
    const sanitizedData: Record<string, unknown> = {};

    for (const [field, rules] of Object.entries(schema)) {
      const result = this.validateField(data[field], rules);
      
      if (!result.isValid) {
        errors[field] = result.errors;
      } else {
        sanitizedData[field] = result.sanitizedValue;
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      sanitizedData
    };
  }

  public sanitizeHtml(input: string): string {
    // Basic HTML sanitization - remove potentially dangerous elements
    const dangerousElements = [
      'script', 'object', 'embed', 'link', 'style', 'iframe', 'frame', 'frameset',
      'applet', 'meta', 'form', 'input', 'button', 'textarea', 'select', 'option'
    ];
    
    let sanitized = input;
    
    dangerousElements.forEach(element => {
      const regex = new RegExp(`<${element}\\b[^<]*(?:(?!<\\/${element}>)<[^<]*)*<\\/${element}>`, 'gi');
      sanitized = sanitized.replace(regex, '');
      
      // Also remove self-closing tags
      const selfClosingRegex = new RegExp(`<${element}\\b[^>]*\\/?>`, 'gi');
      sanitized = sanitized.replace(selfClosingRegex, '');
    });

    // Remove javascript: and data: URLs
    sanitized = sanitized.replace(/javascript:/gi, '');
    sanitized = sanitized.replace(/data:/gi, '');
    
    // Remove on* event handlers - more comprehensive pattern
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^>\s]*/gi, '');
    
    return sanitized;
  }

  public sanitizeJson(input: unknown): unknown {
    if (typeof input === 'string') {
      return this.sanitizeHtml(input);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeJson(item));
    }
    
    if (input && typeof input === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(input)) {
        // Sanitize both key and value
        const sanitizedKey = this.sanitizeHtml(key);
        sanitized[sanitizedKey] = this.sanitizeJson(value);
      }
      return sanitized;
    }
    
    return input;
  }

  public validateConnectionString(connectionString: string): {
    isValid: boolean;
    errors: string[];
    components?: {
      endpoint?: string;
      sharedAccessKeyName?: string;
      sharedAccessKey?: string;
      entityPath?: string;
    };
  } {
    const errors: string[] = [];
    const components: Record<string, string> = {};

    if (!connectionString || typeof connectionString !== 'string') {
      errors.push('Connection string is required');
      return { isValid: false, errors };
    }

    // Parse connection string components
    const parts = connectionString.split(';').filter(part => part.trim());
    
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      if (key && valueParts.length > 0) {
        components[key.trim()] = valueParts.join('=').trim();
      }
    }

    // Validate required components
    if (!components.Endpoint) {
      errors.push('Endpoint is required in connection string');
    } else {
      try {
        new URL(components.Endpoint);
      } catch {
        errors.push('Endpoint must be a valid URL');
      }
    }

    if (!components.SharedAccessKeyName && !components.SharedAccessSignature) {
      errors.push('Either SharedAccessKeyName or SharedAccessSignature is required');
    }

    if (components.SharedAccessKeyName && !components.SharedAccessKey) {
      errors.push('SharedAccessKey is required when using SharedAccessKeyName');
    }

    // Validate endpoint is Azure Service Bus
    if (components.Endpoint && !components.Endpoint.includes('servicebus.windows.net')) {
      errors.push('Endpoint must be an Azure Service Bus endpoint');
    }

    if (errors.length === 0) {
      return {
        isValid: true,
        errors: [],
        components: {
          endpoint: components.Endpoint || undefined,
          sharedAccessKeyName: components.SharedAccessKeyName || undefined,
          sharedAccessKey: components.SharedAccessKey || undefined,
          entityPath: components.EntityPath || undefined
        }
      };
    } else {
      return {
        isValid: false,
        errors
      };
    }
  }

  public createSchema(rules: Record<string, (ValidationRule | string)[]>): ValidationSchema {
    const schema: ValidationSchema = {};
    
    for (const [field, fieldRules] of Object.entries(rules)) {
      schema[field] = fieldRules.map(rule => {
        if (typeof rule === 'string') {
          const commonRule = this.commonRules[rule];
          if (!commonRule) {
            throw new Error(`Unknown validation rule: ${rule}`);
          }
          return commonRule;
        }
        return rule;
      });
    }
    
    return schema;
  }

  public getCommonRule(name: string): ValidationRule | undefined {
    return this.commonRules[name];
  }

  public addCustomRule(name: string, rule: ValidationRule): void {
    this.commonRules[name] = rule;
  }

  // Rate limiting helpers
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  public checkRateLimit(identifier: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const key = identifier;
    const current = this.rateLimitStore.get(key);

    if (!current || now > current.resetTime) {
      // New window or expired window
      const resetTime = now + windowMs;
      this.rateLimitStore.set(key, { count: 1, resetTime });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime
      };
    }

    if (current.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: current.resetTime
      };
    }

    current.count++;
    this.rateLimitStore.set(key, current);

    return {
      allowed: true,
      remaining: maxRequests - current.count,
      resetTime: current.resetTime
    };
  }

  public clearRateLimit(identifier: string): void {
    this.rateLimitStore.delete(identifier);
  }

  public cleanupExpiredRateLimits(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitStore.entries()) {
      if (now > value.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  public sanitizeInput(input: unknown): string {
    if (input === null || input === undefined) {
      return '';
    }
    if (typeof input !== 'string') {
      input = String(input);
    }
    return this.sanitizeHtml(input as string);
  }

  public validateJSON(jsonString: string): ValidationResult & { parsed: unknown } {
    if (!jsonString || jsonString.trim() === '') {
      return {
        isValid: false,
        errors: ['Empty JSON string'],
        parsed: null
      };
    }

    try {
      const parsed = JSON.parse(jsonString);
      return {
        isValid: true,
        errors: [],
        parsed
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
        parsed: null
      };
    }
  }

  public validateEmail(email: string): ValidationResult {
    const emailRule = this.commonRules.email;
    if (!emailRule) {
      return { isValid: false, errors: ['Email validation rule not found'] };
    }
    return this.validateField(email, [emailRule]);
  }

  public validateURL(url: string): ValidationResult {
    const urlRule = this.commonRules.url;
    if (!urlRule) {
      return { isValid: false, errors: ['URL validation rule not found'] };
    }
    const result = this.validateField(url, [urlRule]);
    
    if (result.isValid) {
      try {
        const urlObj = new URL(url);
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
          return {
            isValid: false,
            errors: ['Only HTTP and HTTPS URLs are allowed']
          };
        }
      } catch {
        return {
          isValid: false,
          errors: ['Invalid URL format']
        };
      }
    }
    
    return result;
  }

  public validateMessageFilter(filter: {
    dateRange?: { start: Date; end: Date };
    fieldFilters?: Array<{
      fieldPath: string;
      operator: 'equals' | 'contains' | 'regex' | 'gt' | 'lt';
      value: string;
    }>;
    messageTypes?: string[];
    textSearch?: string;
  }): ValidationResult {
    const errors: string[] = [];

    if (filter.dateRange) {
      if (filter.dateRange.start >= filter.dateRange.end) {
        errors.push('End date must be after start date');
      }
    }

    if (filter.fieldFilters) {
      for (const fieldFilter of filter.fieldFilters) {
        if (!fieldFilter.fieldPath || fieldFilter.fieldPath.trim() === '') {
          errors.push('Field path cannot be empty');
        }

        if (fieldFilter.operator === 'regex') {
          try {
            new RegExp(fieldFilter.value);
          } catch {
            errors.push(`Invalid regex pattern: ${fieldFilter.value}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const inputValidationService = new InputValidationService();