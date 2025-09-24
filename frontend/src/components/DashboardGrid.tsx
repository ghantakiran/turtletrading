import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useUIStore } from '../stores';
import PortfolioWidget from './widgets/PortfolioWidget';
import MarketWidget from './widgets/MarketWidget';
import AlertsWidget from './widgets/AlertsWidget';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface WidgetConfig {
  id: string;
  title: string;
  component: React.ComponentType;
  minW: number;
  minH: number;
  defaultLayout: {
    w: number;
    h: number;
    x: number;
    y: number;
  };
}

interface DashboardGridProps {
  editMode?: boolean;
  onEditModeChange?: (editMode: boolean) => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  editMode = false,
  onEditModeChange
}) => {
  const { dashboardLayout, updateDashboardLayout, saveDashboardLayout } = useUIStore();

  // Available widgets configuration
  const availableWidgets: WidgetConfig[] = [
    {
      id: 'portfolio',
      title: 'Portfolio',
      component: PortfolioWidget,
      minW: 2,
      minH: 3,
      defaultLayout: { w: 4, h: 4, x: 0, y: 0 }
    },
    {
      id: 'market',
      title: 'Market Overview',
      component: MarketWidget,
      minW: 4,
      minH: 4,
      defaultLayout: { w: 8, h: 6, x: 4, y: 0 }
    },
    {
      id: 'alerts',
      title: 'Alerts',
      component: AlertsWidget,
      minW: 3,
      minH: 4,
      defaultLayout: { w: 4, h: 5, x: 0, y: 4 }
    }
  ];

  const [layouts, setLayouts] = useState<{ [key: string]: Layout[] }>({});
  const [isClient, setIsClient] = useState(false);

  // Initialize client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load saved layout or use defaults
  useEffect(() => {
    if (dashboardLayout && Object.keys(dashboardLayout).length > 0) {
      setLayouts(dashboardLayout);
    } else {
      // Create default layouts for different breakpoints
      const defaultLayouts: { [key: string]: Layout[] } = {
        lg: availableWidgets.map(widget => ({
          i: widget.id,
          ...widget.defaultLayout
        })),
        md: availableWidgets.map(widget => ({
          i: widget.id,
          w: Math.min(widget.defaultLayout.w, 6),
          h: widget.defaultLayout.h,
          x: widget.id === 'portfolio' ? 0 : widget.id === 'market' ? 0 : 0,
          y: widget.id === 'portfolio' ? 0 : widget.id === 'market' ? 4 : 10
        })),
        sm: availableWidgets.map((widget, index) => ({
          i: widget.id,
          w: 4,
          h: widget.defaultLayout.h,
          x: 0,
          y: index * 5
        })),
        xs: availableWidgets.map((widget, index) => ({
          i: widget.id,
          w: 2,
          h: widget.defaultLayout.h,
          x: 0,
          y: index * 5
        }))
      };
      setLayouts(defaultLayouts);
    }
  }, [dashboardLayout]);

  // Handle layout change
  const handleLayoutChange = useCallback((currentLayout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    setLayouts(allLayouts);
    updateDashboardLayout(allLayouts);
  }, [updateDashboardLayout]);

  // Save layout to storage
  const handleSaveLayout = useCallback(() => {
    saveDashboardLayout();
    if (onEditModeChange) {
      onEditModeChange(false);
    }
  }, [saveDashboardLayout, onEditModeChange]);

  // Reset to default layout
  const handleResetLayout = useCallback(() => {
    const defaultLayouts: { [key: string]: Layout[] } = {
      lg: availableWidgets.map(widget => ({
        i: widget.id,
        ...widget.defaultLayout
      })),
      md: availableWidgets.map(widget => ({
        i: widget.id,
        w: Math.min(widget.defaultLayout.w, 6),
        h: widget.defaultLayout.h,
        x: widget.id === 'portfolio' ? 0 : widget.id === 'market' ? 0 : 0,
        y: widget.id === 'portfolio' ? 0 : widget.id === 'market' ? 4 : 10
      })),
      sm: availableWidgets.map((widget, index) => ({
        i: widget.id,
        w: 4,
        h: widget.defaultLayout.h,
        x: 0,
        y: index * 5
      })),
      xs: availableWidgets.map((widget, index) => ({
        i: widget.id,
        w: 2,
        h: widget.defaultLayout.h,
        x: 0,
        y: index * 5
      }))
    };
    setLayouts(defaultLayouts);
    updateDashboardLayout(defaultLayouts);
  }, [updateDashboardLayout]);

  // Render widget by ID
  const renderWidget = (widgetId: string) => {
    const widgetConfig = availableWidgets.find(w => w.id === widgetId);
    if (!widgetConfig) return null;

    const WidgetComponent = widgetConfig.component;

    return (
      <div
        key={widgetId}
        className={`relative ${editMode ? 'ring-2 ring-primary-500 ring-opacity-50' : ''}`}
        data-testid={`dashboard-widget-${widgetId}`}
      >
        {editMode && (
          <div className="absolute top-0 left-0 right-0 z-10 bg-primary-500 text-white text-xs px-2 py-1 flex items-center justify-between">
            <span>{widgetConfig.title}</span>
            <div className="flex items-center space-x-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
          </div>
        )}
        <div className={editMode ? 'mt-6' : ''}>
          <WidgetComponent />
        </div>
      </div>
    );
  };

  if (!isClient) {
    // Server-side rendering fallback
    return (
      <div className="space-y-6">
        <PortfolioWidget />
        <MarketWidget />
        <AlertsWidget />
      </div>
    );
  }

  return (
    <div className="relative" data-testid="dashboard-grid">
      {/* Edit Mode Controls */}
      {editMode && (
        <div className="mb-4 p-4 bg-background-secondary border border-primary-500 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-secondary-200">
              <svg className="inline h-4 w-4 mr-2 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Drag widgets to rearrange • Resize by dragging corners
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleResetLayout}
                className="px-3 py-1 text-xs bg-secondary-700 text-secondary-200 rounded hover:bg-secondary-600 transition-colors"
                data-testid="reset-layout-btn"
              >
                Reset
              </button>
              <button
                onClick={handleSaveLayout}
                className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
                data-testid="save-layout-btn"
              >
                Save Layout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid Layout */}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 8, sm: 4, xs: 2 }}
        rowHeight={60}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        useCSSTransforms={true}
        preventCollision={false}
        compactType="vertical"
        // Minimum sizes for widgets
        onResizeStart={(layout: Layout[], oldItem: Layout, newItem: Layout) => {
          const widgetConfig = availableWidgets.find(w => w.id === newItem.i);
          if (widgetConfig) {
            // Enforce minimum sizes
            newItem.minW = widgetConfig.minW;
            newItem.minH = widgetConfig.minH;
          }
        }}
      >
        {availableWidgets.map(widget => renderWidget(widget.id))}
      </ResponsiveGridLayout>

      {/* Edit Mode Toggle */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => onEditModeChange && onEditModeChange(!editMode)}
          className={`p-3 rounded-lg shadow-lg transition-colors ${
            editMode
              ? 'bg-primary-500 text-white hover:bg-primary-600'
              : 'bg-background-secondary text-secondary-300 hover:bg-secondary-700 border border-secondary-600'
          }`}
          data-testid="edit-mode-toggle"
          title={editMode ? 'Exit Edit Mode' : 'Customize Dashboard'}
        >
          {editMode ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default DashboardGrid;