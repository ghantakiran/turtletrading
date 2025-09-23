/**
 * Layout Manager
 * Manages dashboard layouts, persistence, templates, and sharing
 */

import { DashboardLayout, LayoutItem, LayoutGrid } from './DashboardLayoutEngine';

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  category: 'trading' | 'analysis' | 'monitoring' | 'custom';
  thumbnail: string;
  layout: Omit<DashboardLayout, 'id' | 'createdAt' | 'updatedAt'>;
  tags: string[];
  featured: boolean;
  downloads: number;
  rating: number;
  author: {
    name: string;
    verified: boolean;
  };
}

export interface LayoutPreset {
  name: string;
  grid: LayoutGrid;
  defaultItems: Partial<LayoutItem>[];
}

export interface LayoutHistory {
  id: string;
  layoutId: string;
  snapshot: DashboardLayout;
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'restore';
  description: string;
}

export interface LayoutShare {
  id: string;
  layoutId: string;
  shareCode: string;
  permissions: 'view' | 'edit' | 'clone';
  expiresAt?: Date;
  password?: string;
  downloads: number;
  createdAt: Date;
}

export class LayoutManager {
  private static instance: LayoutManager;
  private layouts: Map<string, DashboardLayout> = new Map();
  private templates: Map<string, LayoutTemplate> = new Map();
  private history: Map<string, LayoutHistory[]> = new Map();
  private shares: Map<string, LayoutShare> = new Map();
  private presets: LayoutPreset[] = [];

  private constructor() {
    this.initializePresets();
    this.loadLayouts();
    this.loadTemplates();
  }

  public static getInstance(): LayoutManager {
    if (!LayoutManager.instance) {
      LayoutManager.instance = new LayoutManager();
    }
    return LayoutManager.instance;
  }

  /**
   * Initialize default layout presets
   */
  private initializePresets(): void {
    this.presets = [
      {
        name: 'Standard Grid',
        grid: {
          columns: 12,
          rows: 8,
          gap: 16,
          cellWidth: 100,
          cellHeight: 100,
          padding: 16
        },
        defaultItems: []
      },
      {
        name: 'Compact Grid',
        grid: {
          columns: 16,
          rows: 12,
          gap: 8,
          cellWidth: 80,
          cellHeight: 80,
          padding: 8
        },
        defaultItems: []
      },
      {
        name: 'Large Widgets',
        grid: {
          columns: 8,
          rows: 6,
          gap: 24,
          cellWidth: 150,
          cellHeight: 120,
          padding: 24
        },
        defaultItems: []
      },
      {
        name: 'Trading Focus',
        grid: {
          columns: 12,
          rows: 8,
          gap: 16,
          cellWidth: 100,
          cellHeight: 100,
          padding: 16
        },
        defaultItems: [
          {
            widgetId: 'market-overview',
            position: { x: 0, y: 0 },
            size: { width: 6, height: 3 }
          },
          {
            widgetId: 'watchlist',
            position: { x: 6, y: 0 },
            size: { width: 3, height: 6 }
          },
          {
            widgetId: 'stock-chart',
            position: { x: 0, y: 3 },
            size: { width: 6, height: 4 }
          },
          {
            widgetId: 'portfolio-summary',
            position: { x: 9, y: 0 },
            size: { width: 3, height: 3 }
          }
        ]
      }
    ];
  }

  /**
   * Create a new layout
   */
  public async createLayout(
    name: string,
    preset: string = 'Standard Grid',
    template?: string
  ): Promise<DashboardLayout> {
    const id = this.generateId();
    let layout: DashboardLayout;

    if (template) {
      // Create from template
      const templateData = this.templates.get(template);
      if (!templateData) {
        throw new Error(`Template ${template} not found`);
      }

      layout = {
        id,
        name,
        ...templateData.layout,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      // Create from preset
      const presetData = this.presets.find(p => p.name === preset);
      if (!presetData) {
        throw new Error(`Preset ${preset} not found`);
      }

      const items: LayoutItem[] = presetData.defaultItems.map((item, index) => ({
        id: this.generateId(),
        widgetId: item.widgetId || 'placeholder',
        position: item.position || { x: 0, y: 0 },
        size: item.size || { width: 2, height: 2 },
        minSize: item.minSize || { width: 1, height: 1 },
        maxSize: item.maxSize || { width: 12, height: 8 },
        locked: item.locked || false,
        resizable: item.resizable !== false,
        draggable: item.draggable !== false,
        zIndex: item.zIndex || index
      }));

      layout = {
        id,
        name,
        grid: presetData.grid,
        items,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
        isDefault: false,
        shared: false
      };
    }

    this.layouts.set(id, layout);
    await this.saveLayout(layout);
    this.addToHistory(layout, 'create', 'Layout created');

    return layout;
  }

  /**
   * Update an existing layout
   */
  public async updateLayout(layoutId: string, updates: Partial<DashboardLayout>): Promise<DashboardLayout> {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    const updatedLayout: DashboardLayout = {
      ...layout,
      ...updates,
      updatedAt: new Date()
    };

    this.layouts.set(layoutId, updatedLayout);
    await this.saveLayout(updatedLayout);
    this.addToHistory(updatedLayout, 'update', 'Layout updated');

    return updatedLayout;
  }

  /**
   * Delete a layout
   */
  public async deleteLayout(layoutId: string): Promise<void> {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    this.layouts.delete(layoutId);
    await this.removeLayoutFromStorage(layoutId);
    this.addToHistory(layout, 'delete', 'Layout deleted');
  }

  /**
   * Clone a layout
   */
  public async cloneLayout(layoutId: string, name: string): Promise<DashboardLayout> {
    const originalLayout = this.layouts.get(layoutId);
    if (!originalLayout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    const newId = this.generateId();
    const clonedLayout: DashboardLayout = {
      ...originalLayout,
      id: newId,
      name,
      items: originalLayout.items.map(item => ({
        ...item,
        id: this.generateId()
      })),
      createdAt: new Date(),
      updatedAt: new Date(),
      isDefault: false,
      shared: false
    };

    this.layouts.set(newId, clonedLayout);
    await this.saveLayout(clonedLayout);
    this.addToHistory(clonedLayout, 'create', `Cloned from ${originalLayout.name}`);

    return clonedLayout;
  }

  /**
   * Get layout by ID
   */
  public getLayout(layoutId: string): DashboardLayout | undefined {
    return this.layouts.get(layoutId);
  }

  /**
   * Get all layouts
   */
  public getAllLayouts(): DashboardLayout[] {
    return Array.from(this.layouts.values()).sort((a, b) =>
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * Get default layout
   */
  public getDefaultLayout(): DashboardLayout | undefined {
    return Array.from(this.layouts.values()).find(layout => layout.isDefault);
  }

  /**
   * Set default layout
   */
  public async setDefaultLayout(layoutId: string): Promise<void> {
    // Remove default flag from all layouts
    for (const layout of this.layouts.values()) {
      if (layout.isDefault) {
        await this.updateLayout(layout.id, { isDefault: false });
      }
    }

    // Set new default
    await this.updateLayout(layoutId, { isDefault: true });
  }

  /**
   * Add widget to layout
   */
  public async addWidget(
    layoutId: string,
    widgetId: string,
    position?: { x: number; y: number },
    size?: { width: number; height: number }
  ): Promise<LayoutItem> {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    // Find available position if not specified
    const finalPosition = position || this.findAvailablePosition(layout, size || { width: 2, height: 2 });
    const finalSize = size || { width: 2, height: 2 };

    const newItem: LayoutItem = {
      id: this.generateId(),
      widgetId,
      position: finalPosition,
      size: finalSize,
      minSize: { width: 1, height: 1 },
      maxSize: { width: layout.grid.columns, height: layout.grid.rows },
      locked: false,
      resizable: true,
      draggable: true,
      zIndex: layout.items.length
    };

    const updatedLayout = {
      ...layout,
      items: [...layout.items, newItem],
      updatedAt: new Date()
    };

    await this.updateLayout(layoutId, updatedLayout);
    return newItem;
  }

  /**
   * Remove widget from layout
   */
  public async removeWidget(layoutId: string, itemId: string): Promise<void> {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    const updatedItems = layout.items.filter(item => item.id !== itemId);
    await this.updateLayout(layoutId, { items: updatedItems });
  }

  /**
   * Find available position for new widget
   */
  private findAvailablePosition(
    layout: DashboardLayout,
    size: { width: number; height: number }
  ): { x: number; y: number } {
    const { grid, items } = layout;

    // Create occupancy matrix
    const occupied: boolean[][] = Array(grid.rows)
      .fill(null)
      .map(() => Array(grid.columns).fill(false));

    // Mark occupied cells
    items.forEach(item => {
      for (let y = item.position.y; y < item.position.y + item.size.height; y++) {
        for (let x = item.position.x; x < item.position.x + item.size.width; x++) {
          if (y < grid.rows && x < grid.columns) {
            occupied[y][x] = true;
          }
        }
      }
    });

    // Find first available position
    for (let y = 0; y <= grid.rows - size.height; y++) {
      for (let x = 0; x <= grid.columns - size.width; x++) {
        let fits = true;

        // Check if widget fits at this position
        for (let dy = 0; dy < size.height && fits; dy++) {
          for (let dx = 0; dx < size.width && fits; dx++) {
            if (occupied[y + dy][x + dx]) {
              fits = false;
            }
          }
        }

        if (fits) {
          return { x, y };
        }
      }
    }

    // If no space found, place at the end
    return { x: 0, y: grid.rows };
  }

  /**
   * Layout history management
   */
  public getLayoutHistory(layoutId: string): LayoutHistory[] {
    return this.history.get(layoutId) || [];
  }

  public async restoreFromHistory(historyId: string): Promise<DashboardLayout> {
    for (const [layoutId, entries] of this.history.entries()) {
      const entry = entries.find(e => e.id === historyId);
      if (entry) {
        const restoredLayout = {
          ...entry.snapshot,
          updatedAt: new Date()
        };

        await this.updateLayout(layoutId, restoredLayout);
        this.addToHistory(restoredLayout, 'restore', `Restored from ${entry.timestamp.toLocaleString()}`);
        return restoredLayout;
      }
    }

    throw new Error(`History entry ${historyId} not found`);
  }

  private addToHistory(layout: DashboardLayout, action: LayoutHistory['action'], description: string): void {
    const historyEntry: LayoutHistory = {
      id: this.generateId(),
      layoutId: layout.id,
      snapshot: { ...layout },
      timestamp: new Date(),
      action,
      description
    };

    const entries = this.history.get(layout.id) || [];
    entries.push(historyEntry);

    // Keep only last 50 entries
    if (entries.length > 50) {
      entries.splice(0, entries.length - 50);
    }

    this.history.set(layout.id, entries);
    this.saveHistory(layout.id, entries);
  }

  /**
   * Layout sharing
   */
  public async shareLayout(layoutId: string, permissions: LayoutShare['permissions'] = 'view'): Promise<string> {
    const layout = this.layouts.get(layoutId);
    if (!layout) {
      throw new Error(`Layout ${layoutId} not found`);
    }

    const shareCode = this.generateShareCode();
    const share: LayoutShare = {
      id: this.generateId(),
      layoutId,
      shareCode,
      permissions,
      downloads: 0,
      createdAt: new Date()
    };

    this.shares.set(shareCode, share);
    await this.saveShare(share);

    return shareCode;
  }

  public async getSharedLayout(shareCode: string): Promise<DashboardLayout> {
    const share = this.shares.get(shareCode);
    if (!share) {
      throw new Error(`Share code ${shareCode} not found`);
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new Error('Share code has expired');
    }

    const layout = this.layouts.get(share.layoutId);
    if (!layout) {
      throw new Error('Shared layout not found');
    }

    // Increment download count
    share.downloads++;
    await this.saveShare(share);

    return layout;
  }

  /**
   * Templates management
   */
  public getTemplates(): LayoutTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return b.downloads - a.downloads;
    });
  }

  public getTemplate(templateId: string): LayoutTemplate | undefined {
    return this.templates.get(templateId);
  }

  public async createLayoutFromTemplate(templateId: string, name: string): Promise<DashboardLayout> {
    return this.createLayout(name, '', templateId);
  }

  /**
   * Persistence methods
   */
  private async saveLayout(layout: DashboardLayout): Promise<void> {
    try {
      localStorage.setItem(`layout_${layout.id}`, JSON.stringify(layout));

      // Also save to server if available
      await this.saveToServer('layouts', layout.id, layout);
    } catch (error) {
      console.error('Failed to save layout:', error);
    }
  }

  private async removeLayoutFromStorage(layoutId: string): Promise<void> {
    try {
      localStorage.removeItem(`layout_${layoutId}`);

      // Also remove from server if available
      await this.deleteFromServer('layouts', layoutId);
    } catch (error) {
      console.error('Failed to remove layout:', error);
    }
  }

  private loadLayouts(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('layout_'));

      keys.forEach(key => {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            const layout: DashboardLayout = JSON.parse(data);
            layout.createdAt = new Date(layout.createdAt);
            layout.updatedAt = new Date(layout.updatedAt);
            this.layouts.set(layout.id, layout);
          }
        } catch (error) {
          console.error(`Failed to load layout from ${key}:`, error);
        }
      });

      // If no layouts exist, create a default one
      if (this.layouts.size === 0) {
        this.createDefaultLayout();
      }
    } catch (error) {
      console.error('Failed to load layouts:', error);
      this.createDefaultLayout();
    }
  }

  private async createDefaultLayout(): Promise<void> {
    const defaultLayout = await this.createLayout('My Dashboard', 'Trading Focus');
    await this.setDefaultLayout(defaultLayout.id);
  }

  private loadTemplates(): void {
    // Load built-in templates
    this.templates.set('trading-pro', {
      id: 'trading-pro',
      name: 'Trading Pro',
      description: 'Professional trading layout with advanced charts and analysis tools',
      category: 'trading',
      thumbnail: '/templates/trading-pro.png',
      layout: {
        name: 'Trading Pro',
        grid: {
          columns: 12,
          rows: 8,
          gap: 16,
          cellWidth: 100,
          cellHeight: 100,
          padding: 16
        },
        items: [
          {
            id: 'market-overview',
            widgetId: 'market-overview',
            position: { x: 0, y: 0 },
            size: { width: 4, height: 2 },
            minSize: { width: 3, height: 2 },
            maxSize: { width: 6, height: 3 },
            locked: false,
            resizable: true,
            draggable: true,
            zIndex: 0
          },
          {
            id: 'main-chart',
            widgetId: 'advanced-chart',
            position: { x: 0, y: 2 },
            size: { width: 8, height: 5 },
            minSize: { width: 6, height: 4 },
            maxSize: { width: 12, height: 8 },
            locked: false,
            resizable: true,
            draggable: true,
            zIndex: 1
          },
          {
            id: 'watchlist',
            widgetId: 'watchlist',
            position: { x: 8, y: 0 },
            size: { width: 4, height: 7 },
            minSize: { width: 3, height: 5 },
            maxSize: { width: 6, height: 8 },
            locked: false,
            resizable: true,
            draggable: true,
            zIndex: 2
          }
        ],
        version: '1.0.0',
        isDefault: false,
        shared: false
      },
      tags: ['professional', 'charts', 'analysis'],
      featured: true,
      downloads: 1250,
      rating: 4.8,
      author: {
        name: 'TurtleTrading',
        verified: true
      }
    });

    // Additional templates would be loaded here...
  }

  private async saveHistory(layoutId: string, entries: LayoutHistory[]): Promise<void> {
    try {
      localStorage.setItem(`history_${layoutId}`, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  private async saveShare(share: LayoutShare): Promise<void> {
    try {
      localStorage.setItem(`share_${share.shareCode}`, JSON.stringify(share));

      // Also save to server if available
      await this.saveToServer('shares', share.shareCode, share);
    } catch (error) {
      console.error('Failed to save share:', error);
    }
  }

  private async saveToServer(endpoint: string, id: string, data: any): Promise<void> {
    try {
      const response = await fetch(`/api/v1/layouts/${endpoint}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Server save failed: ${response.statusText}`);
      }
    } catch (error) {
      // Fail silently for offline mode
      console.warn('Server save failed, using local storage only:', error);
    }
  }

  private async deleteFromServer(endpoint: string, id: string): Promise<void> {
    try {
      const response = await fetch(`/api/v1/layouts/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`Server delete failed: ${response.statusText}`);
      }
    } catch (error) {
      // Fail silently for offline mode
      console.warn('Server delete failed:', error);
    }
  }

  private getAuthToken(): string {
    return localStorage.getItem('auth-token') || '';
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateShareCode(): string {
    return Math.random().toString(36).substr(2, 12).toUpperCase();
  }
}

export default LayoutManager;