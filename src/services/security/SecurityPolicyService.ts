export interface CSPDirective {
  name: string;
  values: string[];
}

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
}

export interface SecurityPolicyConfig {
  csp: {
    enabled: boolean;
    reportOnly: boolean;
    directives: CSPDirective[];
  };
  headers: SecurityHeaders;
  trustedDomains: string[];
  allowedFileTypes: string[];
  maxFileSize: number;
}

class SecurityPolicyService {
  private config: SecurityPolicyConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): SecurityPolicyConfig {
    return {
      csp: {
        enabled: true,
        reportOnly: false,
        directives: [
          {
            name: 'default-src',
            values: ["'self'"]
          },
          {
            name: 'script-src',
            values: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net']
          },
          {
            name: 'style-src',
            values: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']
          },
          {
            name: 'font-src',
            values: ["'self'", 'https://fonts.gstatic.com']
          },
          {
            name: 'img-src',
            values: ["'self'", 'data:', 'https:']
          },
          {
            name: 'connect-src',
            values: ["'self'", 'https://*.servicebus.windows.net', 'https://*.azure.com']
          },
          {
            name: 'worker-src',
            values: ["'self'", 'blob:']
          },
          {
            name: 'object-src',
            values: ["'none'"]
          },
          {
            name: 'base-uri',
            values: ["'self'"]
          },
          {
            name: 'form-action',
            values: ["'self'"]
          },
          {
            name: 'frame-ancestors',
            values: ["'none'"]
          }
        ]
      },
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      },
      trustedDomains: [
        'servicebus.windows.net',
        'azure.com',
        'microsoft.com',
        'login.microsoftonline.com'
      ],
      allowedFileTypes: [
        'json', 'csv', 'txt', 'xml', 'yaml', 'yml'
      ],
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };
  }

  public updateConfig(newConfig: Partial<SecurityPolicyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): SecurityPolicyConfig {
    return { ...this.config };
  }

  public generateCSPHeader(): string {
    if (!this.config.csp.enabled) {
      return '';
    }

    const directives = this.config.csp.directives
      .map(directive => `${directive.name} ${directive.values.join(' ')}`)
      .join('; ');

    return directives;
  }

  public applyCSP(): void {
    if (!this.config.csp.enabled) {
      return;
    }

    const cspHeader = this.generateCSPHeader();
    const headerName = this.config.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only' 
      : 'Content-Security-Policy';

    // Apply CSP via meta tag (for client-side applications)
    const existingMeta = document.querySelector(`meta[http-equiv="${headerName}"]`);
    if (existingMeta) {
      existingMeta.setAttribute('content', cspHeader);
    } else {
      const meta = document.createElement('meta');
      meta.setAttribute('http-equiv', headerName);
      meta.setAttribute('content', cspHeader);
      document.head.appendChild(meta);
    }
  }

  public validateUrl(url: string): { isValid: boolean; reason?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check if domain is in trusted domains
      const domain = urlObj.hostname;
      const isTrusted = this.config.trustedDomains.some(trustedDomain => 
        domain === trustedDomain || domain.endsWith(`.${trustedDomain}`)
      );

      if (!isTrusted) {
        return {
          isValid: false,
          reason: `Domain ${domain} is not in the trusted domains list`
        };
      }

      // Ensure HTTPS for external domains
      if (urlObj.protocol !== 'https:' && urlObj.hostname !== 'localhost') {
        return {
          isValid: false,
          reason: 'External URLs must use HTTPS'
        };
      }

      return { isValid: true };
    } catch {
      return {
        isValid: false,
        reason: 'Invalid URL format'
      };
    }
  }

  public validateFileUpload(file: File): { isValid: boolean; reason?: string } {
    // Check file size
    if (file.size > this.config.maxFileSize) {
      return {
        isValid: false,
        reason: `File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`
      };
    }

    // Check file type
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !this.config.allowedFileTypes.includes(extension)) {
      return {
        isValid: false,
        reason: `File type .${extension} is not allowed. Allowed types: ${this.config.allowedFileTypes.join(', ')}`
      };
    }

    // Check MIME type matches extension
    const expectedMimeTypes: Record<string, string[]> = {
      'json': ['application/json', 'text/json'],
      'csv': ['text/csv', 'application/csv'],
      'txt': ['text/plain'],
      'xml': ['application/xml', 'text/xml'],
      'yaml': ['application/yaml', 'text/yaml'],
      'yml': ['application/yaml', 'text/yaml']
    };

    const allowedMimeTypes = expectedMimeTypes[extension] || [];
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
      return {
        isValid: false,
        reason: `MIME type ${file.type} does not match file extension .${extension}`
      };
    }

    return { isValid: true };
  }

  public sanitizeFilename(filename: string): string {
    // Remove or replace dangerous characters
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Replace dangerous characters
      .replace(/\.\./g, '_') // Remove directory traversal
      .replace(/^\./, '_') // Remove leading dot
      .substring(0, 255); // Limit length
  }

  public addTrustedDomain(domain: string): void {
    if (!this.config.trustedDomains.includes(domain)) {
      this.config.trustedDomains.push(domain);
    }
  }

  public removeTrustedDomain(domain: string): void {
    this.config.trustedDomains = this.config.trustedDomains.filter(d => d !== domain);
  }

  public addCSPDirective(name: string, values: string[]): void {
    const existingIndex = this.config.csp.directives.findIndex(d => d.name === name);
    if (existingIndex >= 0) {
      this.config.csp.directives[existingIndex]!.values = values;
    } else {
      this.config.csp.directives.push({ name, values });
    }
  }

  public removeCSPDirective(name: string): void {
    this.config.csp.directives = this.config.csp.directives.filter(d => d.name !== name);
  }

  public checkSecurityHeaders(): {
    missing: string[];
    present: string[];
    recommendations: string[];
  } {
    const missing: string[] = [];
    const present: string[] = [];
    const recommendations: string[] = [];

    // Check for security headers in the current page
    const headers = this.config.headers;
    
    for (const [headerName, expectedValue] of Object.entries(headers)) {
      // For client-side, we can only check meta tags
      const metaSelector = `meta[http-equiv="${headerName}"]`;
      const metaTag = document.querySelector(metaSelector);
      
      if (metaTag) {
        present.push(headerName);
        const content = metaTag.getAttribute('content');
        if (content !== expectedValue) {
          recommendations.push(`${headerName} value should be "${expectedValue}" but found "${content}"`);
        }
      } else {
        missing.push(headerName);
      }
    }

    // Check CSP
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta && this.config.csp.enabled) {
      missing.push('Content-Security-Policy');
      recommendations.push('Content Security Policy should be implemented to prevent XSS attacks');
    }

    return { missing, present, recommendations };
  }

  public generateSecurityReport(): {
    timestamp: number;
    cspStatus: {
      enabled: boolean;
      reportOnly: boolean;
      directivesCount: number;
      header: string;
    };
    trustedDomains: string[];
    securityHeaders: {
      missing: string[];
      present: string[];
      recommendations: string[];
    };
    fileUploadPolicy: {
      allowedTypes: string[];
      maxSize: string;
    };
  } {
    const headerCheck = this.checkSecurityHeaders();
    
    return {
      timestamp: Date.now(),
      cspStatus: {
        enabled: this.config.csp.enabled,
        reportOnly: this.config.csp.reportOnly,
        directivesCount: this.config.csp.directives.length,
        header: this.generateCSPHeader()
      },
      trustedDomains: [...this.config.trustedDomains],
      securityHeaders: headerCheck,
      fileUploadPolicy: {
        allowedTypes: [...this.config.allowedFileTypes],
        maxSize: this.formatBytes(this.config.maxFileSize)
      }
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  public importConfig(configJson: string): void {
    try {
      const config = JSON.parse(configJson);
      this.validateConfig(config);
      this.config = config;
    } catch (error) {
      throw new Error(`Invalid security configuration: ${error}`);
    }
  }

  private validateConfig(config: unknown): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    const cfg = config as any;

    if (!cfg.csp || typeof cfg.csp !== 'object') {
      throw new Error('CSP configuration is required');
    }

    if (!Array.isArray(cfg.csp.directives)) {
      throw new Error('CSP directives must be an array');
    }

    if (!Array.isArray(cfg.trustedDomains)) {
      throw new Error('Trusted domains must be an array');
    }

    if (!Array.isArray(cfg.allowedFileTypes)) {
      throw new Error('Allowed file types must be an array');
    }

    if (typeof cfg.maxFileSize !== 'number' || cfg.maxFileSize <= 0) {
      throw new Error('Max file size must be a positive number');
    }
  }

  // Initialize security policies on service creation
  public initialize(): void {
    this.applyCSP();
    
    // Set up periodic cleanup of any security-related caches
    setInterval(() => {
      // Cleanup can be extended as needed
    }, 60000); // Every minute
  }
}

export const securityPolicyService = new SecurityPolicyService();