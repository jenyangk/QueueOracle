export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  algorithm: 'lz-string' | 'json-pack' | 'gzip-simulation';
}

export interface CompressionConfig {
  algorithm: 'auto' | 'lz-string' | 'json-pack' | 'gzip-simulation';
  threshold: number; // Minimum size in bytes to compress
  maxSize: number; // Maximum size to attempt compression
}

class DataCompressionService {
  private config: CompressionConfig = {
    algorithm: 'auto',
    threshold: 1024, // 1KB
    maxSize: 10 * 1024 * 1024 // 10MB
  };

  public setConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public compress(data: unknown): CompressionResult {
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    // Skip compression for small data
    if (originalSize < this.config.threshold) {
      return {
        compressed: jsonString,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        algorithm: 'json-pack' // No compression applied
      };
    }

    // Skip compression for very large data
    if (originalSize > this.config.maxSize) {
      throw new Error(`Data size ${originalSize} exceeds maximum compression size ${this.config.maxSize}`);
    }

    const algorithm = this.config.algorithm === 'auto' 
      ? this.selectBestAlgorithm(jsonString)
      : this.config.algorithm;

    switch (algorithm) {
      case 'lz-string':
        return this.compressWithLZString(jsonString, originalSize);
      case 'json-pack':
        return this.compressWithJsonPack(data, originalSize);
      case 'gzip-simulation':
        return this.compressWithGzipSimulation(jsonString, originalSize);
      default:
        return this.compressWithJsonPack(data, originalSize);
    }
  }

  public decompress(result: CompressionResult): unknown {
    switch (result.algorithm) {
      case 'lz-string':
        return this.decompressLZString(result.compressed);
      case 'json-pack':
        return this.decompressJsonPack(result.compressed);
      case 'gzip-simulation':
        return this.decompressGzipSimulation(result.compressed);
      default:
        return JSON.parse(result.compressed);
    }
  }

  private selectBestAlgorithm(jsonString: string): 'lz-string' | 'json-pack' | 'gzip-simulation' {
    // For JSON data with repetitive structures, JSON pack works well
    if (this.hasRepetitiveStructure(jsonString)) {
      return 'json-pack';
    }

    // For text-heavy data, LZ-string compression works well
    if (this.isTextHeavy(jsonString)) {
      return 'lz-string';
    }

    // Default to gzip simulation for general purpose
    return 'gzip-simulation';
  }

  private hasRepetitiveStructure(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data) && data.length > 10) {
        // Check if array elements have similar structure
        const firstItem = data[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          const firstKeys = Object.keys(firstItem).sort();
          const similarStructureCount = data.slice(1, 10).filter(item => {
            if (typeof item !== 'object' || item === null) return false;
            const keys = Object.keys(item).sort();
            return JSON.stringify(keys) === JSON.stringify(firstKeys);
          }).length;
          
          return similarStructureCount >= 7; // 70% similarity
        }
      }
    } catch {
      // Ignore parsing errors
    }
    return false;
  }

  private isTextHeavy(jsonString: string): boolean {
    // Count string values vs other types
    const stringMatches = jsonString.match(/"[^"]*"/g) || [];
    const totalStringLength = stringMatches.reduce((sum, match) => sum + match.length, 0);
    return totalStringLength / jsonString.length > 0.6; // 60% strings
  }

  private compressWithLZString(jsonString: string, originalSize: number): CompressionResult {
    // Simple LZ77-like compression simulation
    const compressed = this.simpleLZCompress(jsonString);
    const compressedSize = new Blob([compressed]).size;

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      algorithm: 'lz-string'
    };
  }

  private simpleLZCompress(input: string): string {
    const dictionary: Record<string, number> = {};
    let dictSize = 256;
    let result = '';
    let w = '';

    // Initialize dictionary with single characters
    for (let i = 0; i < 256; i++) {
      dictionary[String.fromCharCode(i)] = i;
    }

    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      const wc = w + c;

      if (dictionary[wc] !== undefined) {
        w = wc;
      } else {
        result += String.fromCharCode(dictionary[w]!);
        dictionary[wc] = dictSize++;
        w = c!;
      }
    }

    if (w) {
      result += String.fromCharCode(dictionary[w]!);
    }

    return btoa(result); // Base64 encode for storage
  }

  private decompressLZString(compressed: string): unknown {
    const decoded = atob(compressed);
    const dictionary: Record<number, string> = {};
    let dictSize = 256;
    let result = '';
    let w = '';

    // Initialize dictionary
    for (let i = 0; i < 256; i++) {
      dictionary[i] = String.fromCharCode(i);
    }

    if (decoded.length > 0) {
      w = decoded[0]!;
      result = w;

      for (let i = 1; i < decoded.length; i++) {
        const k = decoded.charCodeAt(i);
        let entry = '';

        if (dictionary[k] !== undefined) {
          entry = dictionary[k];
        } else if (k === dictSize) {
          entry = w + w[0];
        } else {
          throw new Error('Invalid compressed data');
        }

        result += entry;
        dictionary[dictSize++] = w + entry[0];
        w = entry;
      }
    }

    return JSON.parse(result);
  }

  private compressWithJsonPack(data: unknown, originalSize: number): CompressionResult {
    // JSON pack compression - removes redundant keys in arrays of objects
    const packed = this.packJson(data);
    const compressed = JSON.stringify(packed);
    const compressedSize = new Blob([compressed]).size;

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      algorithm: 'json-pack'
    };
  }

  private packJson(data: unknown): unknown {
    if (Array.isArray(data) && data.length > 0) {
      // Check if all items are objects with similar structure
      const firstItem = data[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        const allHaveSameKeys = data.every(item => 
          typeof item === 'object' && 
          item !== null && 
          JSON.stringify(Object.keys(item).sort()) === JSON.stringify(keys.sort())
        );

        if (allHaveSameKeys && keys.length > 2) {
          // Pack as [keys, ...values]
          return {
            __packed: true,
            keys,
            values: data.map(item => keys.map(key => (item as any)[key]))
          };
        }
      }
    }

    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.packJson(value);
      }
      return result;
    }

    return data;
  }

  private decompressJsonPack(compressed: string): unknown {
    const data = JSON.parse(compressed);
    return this.unpackJson(data);
  }

  private unpackJson(data: unknown): unknown {
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const obj = data as any;
      if (obj.__packed === true && obj.keys && obj.values) {
        // Unpack array of objects
        return obj.values.map((values: unknown[]) => {
          const item: any = {};
          obj.keys.forEach((key: string, index: number) => {
            item[key] = values[index];
          });
          return item;
        });
      } else {
        // Recursively unpack object properties
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = this.unpackJson(value);
        }
        return result;
      }
    }

    return data;
  }

  private compressWithGzipSimulation(jsonString: string, originalSize: number): CompressionResult {
    // Simple run-length encoding + dictionary compression
    const compressed = this.simpleGzipCompress(jsonString);
    const compressedSize = new Blob([compressed]).size;

    return {
      compressed,
      originalSize,
      compressedSize,
      compressionRatio: originalSize / compressedSize,
      algorithm: 'gzip-simulation'
    };
  }

  private simpleGzipCompress(input: string): string {
    // Step 1: Run-length encoding for repeated characters
    let rleCompressed = '';
    let i = 0;
    
    while (i < input.length) {
      let count = 1;
      const char = input[i];
      
      while (i + count < input.length && input[i + count] === char && count < 255) {
        count++;
      }
      
      if (count > 3) {
        rleCompressed += `~${count}${char}`;
      } else {
        rleCompressed += char!.repeat(count);
      }
      
      i += count;
    }

    // Step 2: Simple dictionary compression for common patterns
    const patterns = [
      '","', '":', '{"', '"}', '[{', '}]', ',"', '",'
    ];
    
    let dictCompressed = rleCompressed;
    patterns.forEach((pattern, index) => {
      const replacement = String.fromCharCode(1 + index); // Use control characters
      dictCompressed = dictCompressed.split(pattern).join(replacement);
    });

    // Store patterns for decompression
    const result = {
      data: dictCompressed,
      patterns
    };

    return btoa(JSON.stringify(result));
  }

  private decompressGzipSimulation(compressed: string): unknown {
    const decoded = JSON.parse(atob(compressed));
    let result = decoded.data;

    // Restore dictionary patterns
    decoded.patterns.forEach((pattern: string, index: number) => {
      const placeholder = String.fromCharCode(1 + index);
      result = result.split(placeholder).join(pattern);
    });

    // Decompress run-length encoding
    result = result.replace(/~(\d+)(.)/g, (_match: string, count: string, char: string) => {
      return char.repeat(parseInt(count, 10));
    });

    return JSON.parse(result);
  }

  public getCompressionStats(data: unknown[]): {
    totalOriginalSize: number;
    totalCompressedSize: number;
    averageCompressionRatio: number;
    bestAlgorithm: string;
    algorithmStats: Record<string, { count: number; avgRatio: number }>;
  } {
    const results = data.map(item => this.compress(item));
    
    const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
    const averageCompressionRatio = totalOriginalSize / totalCompressedSize;

    const algorithmStats: Record<string, { count: number; avgRatio: number }> = {};
    
    results.forEach(result => {
      if (!algorithmStats[result.algorithm]) {
        algorithmStats[result.algorithm] = { count: 0, avgRatio: 0 };
      }
      algorithmStats[result.algorithm]!.count++;
      algorithmStats[result.algorithm]!.avgRatio += result.compressionRatio;
    });

    // Calculate averages
    Object.keys(algorithmStats).forEach(algorithm => {
      algorithmStats[algorithm]!.avgRatio /= algorithmStats[algorithm]!.count;
    });

    const bestAlgorithm = Object.entries(algorithmStats)
      .sort(([,a], [,b]) => b.avgRatio - a.avgRatio)[0]?.[0] || 'json-pack';

    return {
      totalOriginalSize,
      totalCompressedSize,
      averageCompressionRatio,
      bestAlgorithm,
      algorithmStats
    };
  }
}

export const dataCompressionService = new DataCompressionService();