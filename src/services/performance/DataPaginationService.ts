export interface PaginationConfig {
  pageSize: number;
  maxCachedPages: number;
  preloadPages: number;
  virtualScrollThreshold: number;
}

export interface PaginatedData<T> {
  items: T[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
}

export interface DataProvider<T> {
  getTotalCount(): Promise<number>;
  getPage(page: number, pageSize: number): Promise<T[]>;
  getItemById?(id: string): Promise<T | null>;
}

export interface CachedPage<T> {
  pageNumber: number;
  data: T[];
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

class DataPaginationService<T> {
  private cache = new Map<number, CachedPage<T>>();
  private config: PaginationConfig;
  private dataProvider: DataProvider<T>;
  private totalCount = 0;
  private loadingPages = new Set<number>();

  constructor(dataProvider: DataProvider<T>, config: Partial<PaginationConfig> = {}) {
    this.dataProvider = dataProvider;
    this.config = {
      pageSize: 50,
      maxCachedPages: 10,
      preloadPages: 2,
      virtualScrollThreshold: 1000,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    this.totalCount = await this.dataProvider.getTotalCount();
  }

  public async getPage(pageNumber: number): Promise<PaginatedData<T>> {
    // Check cache first
    const cachedPage = this.cache.get(pageNumber);
    if (cachedPage) {
      this.updateCacheAccess(cachedPage);
      return this.createPaginatedData(cachedPage.data, pageNumber);
    }

    // Load page if not in cache
    const items = await this.loadPage(pageNumber);
    
    // Preload adjacent pages
    this.preloadAdjacentPages(pageNumber);

    return this.createPaginatedData(items, pageNumber);
  }

  private async loadPage(pageNumber: number): Promise<T[]> {
    if (this.loadingPages.has(pageNumber)) {
      // Wait for existing load to complete
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const cached = this.cache.get(pageNumber);
          if (cached && !this.loadingPages.has(pageNumber)) {
            clearInterval(checkInterval);
            resolve(cached.data);
          }
        }, 10);
      });
    }

    this.loadingPages.add(pageNumber);

    try {
      const items = await this.dataProvider.getPage(pageNumber, this.config.pageSize);
      
      // Cache the page
      this.cachePage(pageNumber, items);
      
      return items;
    } finally {
      this.loadingPages.delete(pageNumber);
    }
  }

  private cachePage(pageNumber: number, data: T[]): void {
    const cachedPage: CachedPage<T> = {
      pageNumber,
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now()
    };

    this.cache.set(pageNumber, cachedPage);
    this.evictOldPages();
  }

  private updateCacheAccess(cachedPage: CachedPage<T>): void {
    cachedPage.accessCount++;
    cachedPage.lastAccessed = Date.now();
  }

  private evictOldPages(): void {
    if (this.cache.size <= this.config.maxCachedPages) {
      return;
    }

    // Sort pages by access frequency and recency
    const pages = Array.from(this.cache.values()).sort((a, b) => {
      // Prioritize recently accessed and frequently accessed pages
      const scoreA = a.accessCount * 0.7 + (Date.now() - a.lastAccessed) * -0.3;
      const scoreB = b.accessCount * 0.7 + (Date.now() - b.lastAccessed) * -0.3;
      return scoreA - scoreB;
    });

    // Remove least valuable pages
    const pagesToRemove = pages.slice(0, this.cache.size - this.config.maxCachedPages);
    pagesToRemove.forEach(page => {
      this.cache.delete(page.pageNumber);
    });
  }

  private preloadAdjacentPages(currentPage: number): void {
    const totalPages = Math.ceil(this.totalCount / this.config.pageSize);
    
    for (let i = 1; i <= this.config.preloadPages; i++) {
      // Preload next pages
      const nextPage = currentPage + i;
      if (nextPage <= totalPages && !this.cache.has(nextPage) && !this.loadingPages.has(nextPage)) {
        this.loadPage(nextPage).catch(() => {
          // Ignore preload errors
        });
      }

      // Preload previous pages
      const prevPage = currentPage - i;
      if (prevPage >= 1 && !this.cache.has(prevPage) && !this.loadingPages.has(prevPage)) {
        this.loadPage(prevPage).catch(() => {
          // Ignore preload errors
        });
      }
    }
  }

  private createPaginatedData(items: T[], currentPage: number): PaginatedData<T> {
    const totalPages = Math.ceil(this.totalCount / this.config.pageSize);
    
    return {
      items,
      totalCount: this.totalCount,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      isLoading: this.loadingPages.has(currentPage)
    };
  }

  public async getItemRange(startIndex: number, endIndex: number): Promise<T[]> {
    const startPage = Math.floor(startIndex / this.config.pageSize) + 1;
    const endPage = Math.floor(endIndex / this.config.pageSize) + 1;
    
    const items: T[] = [];
    
    for (let page = startPage; page <= endPage; page++) {
      const pageData = await this.getPage(page);
      const pageStartIndex = (page - 1) * this.config.pageSize;
      // const pageEndIndex = pageStartIndex + this.config.pageSize - 1;
      
      const itemStartIndex = Math.max(0, startIndex - pageStartIndex);
      const itemEndIndex = Math.min(pageData.items.length - 1, endIndex - pageStartIndex);
      
      if (itemStartIndex <= itemEndIndex) {
        items.push(...pageData.items.slice(itemStartIndex, itemEndIndex + 1));
      }
    }
    
    return items;
  }

  public async searchItems(
    searchFn: (item: T) => boolean,
    maxResults = 100
  ): Promise<{ items: T[]; hasMore: boolean }> {
    const results: T[] = [];
    const totalPages = Math.ceil(this.totalCount / this.config.pageSize);
    
    for (let page = 1; page <= totalPages && results.length < maxResults; page++) {
      const pageData = await this.getPage(page);
      const matchingItems = pageData.items.filter(searchFn);
      
      results.push(...matchingItems.slice(0, maxResults - results.length));
    }
    
    return {
      items: results,
      hasMore: results.length === maxResults
    };
  }

  public getCacheStats(): {
    cachedPages: number;
    totalCacheSize: number;
    hitRate: number;
    mostAccessedPages: Array<{ page: number; accessCount: number }>;
  } {
    const pages = Array.from(this.cache.values());
    const totalAccesses = pages.reduce((sum, page) => sum + page.accessCount, 0);
    const cacheHits = pages.filter(page => page.accessCount > 1).length;
    
    return {
      cachedPages: this.cache.size,
      totalCacheSize: pages.reduce((sum, page) => sum + page.data.length, 0),
      hitRate: totalAccesses > 0 ? cacheHits / totalAccesses : 0,
      mostAccessedPages: pages
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 5)
        .map(page => ({ page: page.pageNumber, accessCount: page.accessCount }))
    };
  }

  public clearCache(): void {
    this.cache.clear();
    this.loadingPages.clear();
  }

  public prefetchPages(pageNumbers: number[]): Promise<void[]> {
    return Promise.all(
      pageNumbers.map(pageNumber => 
        this.loadPage(pageNumber).then(() => {}).catch(() => {
          // Ignore prefetch errors
        })
      )
    );
  }

  public updateConfig(newConfig: Partial<PaginationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Evict pages if cache size was reduced
    this.evictOldPages();
  }

  public getTotalCount(): number {
    return this.totalCount;
  }

  public getPageSize(): number {
    return this.config.pageSize;
  }

  public getTotalPages(): number {
    return Math.ceil(this.totalCount / this.config.pageSize);
  }

  public isPageCached(pageNumber: number): boolean {
    return this.cache.has(pageNumber);
  }

  public isPageLoading(pageNumber: number): boolean {
    return this.loadingPages.has(pageNumber);
  }

  // Memory cleanup
  public cleanup(): void {
    this.clearCache();
    this.totalCount = 0;
  }
}

export { DataPaginationService };