export interface BundleStats {
  totalSize: number;
  gzippedSize: number;
  chunks: ChunkInfo[];
  assets: AssetInfo[];
  modules: ModuleInfo[];
  timestamp: number;
}

export interface ChunkInfo {
  name: string;
  size: number;
  files: string[];
  modules: string[];
}

export interface AssetInfo {
  name: string;
  size: number;
  type: 'js' | 'css' | 'html' | 'image' | 'font' | 'other';
  cached: boolean;
}

export interface ModuleInfo {
  name: string;
  size: number;
  chunks: string[];
  reasons: string[];
}

export interface BundleBudget {
  name: string;
  type: 'bundle' | 'initial' | 'allScript' | 'all' | 'anyComponentStyle' | 'any';
  maximumWarning: number;
  maximumError: number;
}

export interface BudgetResult {
  budget: BundleBudget;
  size: number;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

class BundleAnalyzer {
  private readonly DEFAULT_BUDGETS: BundleBudget[] = [
    {
      name: 'bundle',
      type: 'bundle',
      maximumWarning: 500 * 1024, // 500KB
      maximumError: 1024 * 1024   // 1MB
    },
    {
      name: 'initial',
      type: 'initial',
      maximumWarning: 200 * 1024, // 200KB
      maximumError: 500 * 1024    // 500KB
    },
    {
      name: 'allScript',
      type: 'allScript',
      maximumWarning: 300 * 1024, // 300KB
      maximumError: 600 * 1024    // 600KB
    }
  ];

  private budgets: BundleBudget[] = [...this.DEFAULT_BUDGETS];

  public setBudgets(budgets: BundleBudget[]): void {
    this.budgets = budgets;
  }

  public getBudgets(): BundleBudget[] {
    return [...this.budgets];
  }

  public async analyzeBundleFromStats(statsPath: string): Promise<BundleStats> {
    try {
      const response = await fetch(statsPath);
      const stats = await response.json();
      return this.parseWebpackStats(stats);
    } catch (error) {
      console.error('Failed to load bundle stats:', error);
      throw new Error('Could not analyze bundle stats');
    }
  }

  public analyzeCurrentBundle(): BundleStats {
    // Analyze currently loaded resources
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    const assets: AssetInfo[] = resources.map(resource => ({
      name: this.getResourceName(resource.name),
      size: resource.transferSize || 0,
      type: this.getResourceType(resource.name),
      cached: resource.transferSize === 0 && resource.decodedBodySize > 0
    }));

    // Add the main document
    if (navigation) {
      assets.unshift({
        name: 'index.html',
        size: navigation.transferSize || 0,
        type: 'html',
        cached: false
      });
    }

    const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);

    return {
      totalSize,
      gzippedSize: totalSize, // Approximation
      chunks: this.groupAssetsIntoChunks(assets),
      assets,
      modules: [], // Not available from runtime analysis
      timestamp: Date.now()
    };
  }

  private parseWebpackStats(stats: any): BundleStats {
    const assets: AssetInfo[] = stats.assets?.map((asset: any) => ({
      name: asset.name,
      size: asset.size,
      type: this.getResourceType(asset.name),
      cached: false
    })) || [];

    const chunks: ChunkInfo[] = stats.chunks?.map((chunk: any) => ({
      name: chunk.names?.[0] || `chunk-${chunk.id}`,
      size: chunk.size,
      files: chunk.files || [],
      modules: chunk.modules?.map((m: any) => m.name) || []
    })) || [];

    const modules: ModuleInfo[] = stats.modules?.map((module: any) => ({
      name: module.name,
      size: module.size,
      chunks: module.chunks || [],
      reasons: module.reasons?.map((r: any) => r.moduleName) || []
    })) || [];

    return {
      totalSize: assets.reduce((sum, asset) => sum + asset.size, 0),
      gzippedSize: stats.assets?.reduce((sum: number, asset: any) => sum + (asset.gzipSize || asset.size), 0) || 0,
      chunks,
      assets,
      modules,
      timestamp: Date.now()
    };
  }

  private getResourceName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.split('/').pop() || 'unknown';
    } catch {
      return url.split('/').pop() || 'unknown';
    }
  }

  private getResourceType(name: string): AssetInfo['type'] {
    const extension = name.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'js':
      case 'mjs':
        return 'js';
      case 'css':
        return 'css';
      case 'html':
      case 'htm':
        return 'html';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return 'image';
      case 'woff':
      case 'woff2':
      case 'ttf':
      case 'eot':
        return 'font';
      default:
        return 'other';
    }
  }

  private groupAssetsIntoChunks(assets: AssetInfo[]): ChunkInfo[] {
    const jsAssets = assets.filter(asset => asset.type === 'js');
    const cssAssets = assets.filter(asset => asset.type === 'css');

    const chunks: ChunkInfo[] = [];

    if (jsAssets.length > 0) {
      chunks.push({
        name: 'main',
        size: jsAssets.reduce((sum, asset) => sum + asset.size, 0),
        files: jsAssets.map(asset => asset.name),
        modules: []
      });
    }

    if (cssAssets.length > 0) {
      chunks.push({
        name: 'styles',
        size: cssAssets.reduce((sum, asset) => sum + asset.size, 0),
        files: cssAssets.map(asset => asset.name),
        modules: []
      });
    }

    return chunks;
  }

  public checkBudgets(stats: BundleStats): BudgetResult[] {
    return this.budgets.map(budget => {
      let size = 0;

      switch (budget.type) {
        case 'bundle':
          size = stats.totalSize;
          break;
        case 'initial':
          size = stats.chunks
            .filter(chunk => chunk.name === 'main' || chunk.name.includes('vendor'))
            .reduce((sum, chunk) => sum + chunk.size, 0);
          break;
        case 'allScript':
          size = stats.assets
            .filter(asset => asset.type === 'js')
            .reduce((sum, asset) => sum + asset.size, 0);
          break;
        case 'all':
          size = stats.totalSize;
          break;
        default:
          size = stats.totalSize;
      }

      let status: BudgetResult['status'] = 'ok';
      let message = `${budget.name}: ${this.formatBytes(size)} (within budget)`;

      if (size > budget.maximumError) {
        status = 'error';
        message = `${budget.name}: ${this.formatBytes(size)} exceeds error threshold of ${this.formatBytes(budget.maximumError)}`;
      } else if (size > budget.maximumWarning) {
        status = 'warning';
        message = `${budget.name}: ${this.formatBytes(size)} exceeds warning threshold of ${this.formatBytes(budget.maximumWarning)}`;
      }

      return {
        budget,
        size,
        status,
        message
      };
    });
  }

  public generateOptimizationSuggestions(stats: BundleStats): string[] {
    const suggestions: string[] = [];

    // Check for large assets
    const largeAssets = stats.assets.filter(asset => asset.size > 100 * 1024); // > 100KB
    if (largeAssets.length > 0) {
      suggestions.push(`Consider code splitting or lazy loading for large assets: ${largeAssets.map(a => a.name).join(', ')}`);
    }

    // Check for duplicate modules
    const moduleNames = stats.modules.map(m => m.name);
    const duplicates = moduleNames.filter((name, index) => moduleNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      suggestions.push(`Potential duplicate modules detected: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Check for unused chunks
    const unusedChunks = stats.chunks.filter(chunk => chunk.size < 1024); // < 1KB
    if (unusedChunks.length > 0) {
      suggestions.push(`Consider removing or merging small chunks: ${unusedChunks.map(c => c.name).join(', ')}`);
    }

    // Check total bundle size
    if (stats.totalSize > 1024 * 1024) { // > 1MB
      suggestions.push('Total bundle size is large. Consider implementing tree shaking and removing unused dependencies.');
    }

    return suggestions;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public exportAnalysis(stats: BundleStats): string {
    const budgetResults = this.checkBudgets(stats);
    const suggestions = this.generateOptimizationSuggestions(stats);

    const report = {
      timestamp: Date.now(),
      summary: {
        totalSize: this.formatBytes(stats.totalSize),
        gzippedSize: this.formatBytes(stats.gzippedSize),
        chunksCount: stats.chunks.length,
        assetsCount: stats.assets.length,
        modulesCount: stats.modules.length
      },
      budgetResults,
      suggestions,
      details: stats
    };

    return JSON.stringify(report, null, 2);
  }
}

export const bundleAnalyzer = new BundleAnalyzer();