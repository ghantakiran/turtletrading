/**
 * Dashboard Layout Engine
 * Advanced grid-based drag and drop layout system for widgets
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { WidgetInstance, WidgetPosition, WidgetSize } from '../sdk/WidgetSDK';

// Layout Types
export interface LayoutGrid {
  columns: number;
  rows: number;
  gap: number;
  cellWidth: number;
  cellHeight: number;
  padding: number;
}

export interface LayoutItem {
  id: string;
  widgetId: string;
  position: GridPosition;
  size: GridSize;
  minSize?: GridSize;
  maxSize?: GridSize;
  locked?: boolean;
  resizable?: boolean;
  draggable?: boolean;
  zIndex?: number;
}

export interface GridPosition {
  x: number;
  y: number;
}

export interface GridSize {
  width: number;
  height: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  grid: LayoutGrid;
  items: LayoutItem[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  isDefault?: boolean;
  shared?: boolean;
}

export interface DragState {
  isDragging: boolean;
  draggedItem?: LayoutItem;
  dragOffset: { x: number; y: number };
  ghostPosition?: GridPosition;
  validDropZones: GridPosition[];
}

export interface ResizeState {
  isResizing: boolean;
  resizedItem?: LayoutItem;
  resizeHandle: 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;
  startSize: GridSize;
  minSize: GridSize;
  maxSize: GridSize;
}

// Dashboard Layout Engine Component
interface DashboardLayoutEngineProps {
  layout: DashboardLayout;
  onLayoutChange: (layout: DashboardLayout) => void;
  onItemClick?: (item: LayoutItem) => void;
  onItemDoubleClick?: (item: LayoutItem) => void;
  renderWidget: (item: LayoutItem) => React.ReactNode;
  className?: string;
  editable?: boolean;
  snapToGrid?: boolean;
  showGrid?: boolean;
  collisionDetection?: boolean;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

export const DashboardLayoutEngine: React.FC<DashboardLayoutEngineProps> = ({
  layout,
  onLayoutChange,
  onItemClick,
  onItemDoubleClick,
  renderWidget,
  className = '',
  editable = true,
  snapToGrid = true,
  showGrid = false,
  collisionDetection = true,
  autoSave = true,
  autoSaveDelay = 1000
}) => {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
    validDropZones: []
  });

  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    resizeHandle: null,
    startSize: { width: 0, height: 0 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 12, height: 12 }
  });

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();

  // Calculate grid metrics
  const gridMetrics = useMemo(() => {
    if (!containerRef.current) return layout.grid;

    const container = containerRef.current;
    const availableWidth = container.offsetWidth - (layout.grid.padding * 2);
    const availableHeight = container.offsetHeight - (layout.grid.padding * 2);

    const cellWidth = (availableWidth - (layout.grid.gap * (layout.grid.columns - 1))) / layout.grid.columns;
    const cellHeight = (availableHeight - (layout.grid.gap * (layout.grid.rows - 1))) / layout.grid.rows;

    return {
      ...layout.grid,
      cellWidth: Math.max(cellWidth, 100),
      cellHeight: Math.max(cellHeight, 80)
    };
  }, [layout.grid, containerRef.current?.offsetWidth, containerRef.current?.offsetHeight]);

  // Auto-save functionality
  useEffect(() => {
    if (autoSave && autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = setTimeout(() => {
        onLayoutChange(layout);
      }, autoSaveDelay);
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [layout, autoSave, autoSaveDelay, onLayoutChange]);

  // Collision detection
  const checkCollision = useCallback((item: LayoutItem, position: GridPosition, size?: GridSize): boolean => {
    if (!collisionDetection) return false;

    const itemSize = size || item.size;
    const itemBounds = {
      left: position.x,
      top: position.y,
      right: position.x + itemSize.width,
      bottom: position.y + itemSize.height
    };

    return layout.items.some(otherItem => {
      if (otherItem.id === item.id) return false;

      const otherBounds = {
        left: otherItem.position.x,
        top: otherItem.position.y,
        right: otherItem.position.x + otherItem.size.width,
        bottom: otherItem.position.y + otherItem.size.height
      };

      return !(
        itemBounds.right <= otherBounds.left ||
        itemBounds.left >= otherBounds.right ||
        itemBounds.bottom <= otherBounds.top ||
        itemBounds.top >= otherBounds.bottom
      );
    });
  }, [layout.items, collisionDetection]);

  // Find valid drop zones
  const findValidDropZones = useCallback((item: LayoutItem, size?: GridSize): GridPosition[] => {
    const itemSize = size || item.size;
    const validZones: GridPosition[] = [];

    for (let x = 0; x <= gridMetrics.columns - itemSize.width; x++) {
      for (let y = 0; y <= gridMetrics.rows - itemSize.height; y++) {
        const position = { x, y };
        if (!checkCollision(item, position, itemSize)) {
          validZones.push(position);
        }
      }
    }

    return validZones;
  }, [gridMetrics, checkCollision]);

  // Convert pixel coordinates to grid position
  const pixelToGrid = useCallback((pixelX: number, pixelY: number): GridPosition => {
    const x = Math.round((pixelX - gridMetrics.padding) / (gridMetrics.cellWidth + gridMetrics.gap));
    const y = Math.round((pixelY - gridMetrics.padding) / (gridMetrics.cellHeight + gridMetrics.gap));

    return {
      x: Math.max(0, Math.min(x, gridMetrics.columns - 1)),
      y: Math.max(0, Math.min(y, gridMetrics.rows - 1))
    };
  }, [gridMetrics]);

  // Convert grid position to pixel coordinates
  const gridToPixel = useCallback((gridX: number, gridY: number) => {
    const x = gridMetrics.padding + (gridX * (gridMetrics.cellWidth + gridMetrics.gap));
    const y = gridMetrics.padding + (gridY * (gridMetrics.cellHeight + gridMetrics.gap));
    return { x, y };
  }, [gridMetrics]);

  // Handle drag start
  const handleDragStart = useCallback((item: LayoutItem, event: PointerEvent) => {
    if (!editable || !item.draggable) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    const validDropZones = findValidDropZones(item);

    setDragState({
      isDragging: true,
      draggedItem: item,
      dragOffset,
      validDropZones
    });

    setSelectedItems(new Set([item.id]));
  }, [editable, findValidDropZones]);

  // Handle drag move
  const handleDragMove = useCallback((event: PointerEvent) => {
    if (!dragState.isDragging || !dragState.draggedItem) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pixelX = event.clientX - rect.left - dragState.dragOffset.x;
    const pixelY = event.clientY - rect.top - dragState.dragOffset.y;

    const ghostPosition = snapToGrid ? pixelToGrid(pixelX, pixelY) : { x: pixelX, y: pixelY };

    setDragState(prev => ({
      ...prev,
      ghostPosition
    }));
  }, [dragState.isDragging, dragState.draggedItem, dragState.dragOffset, snapToGrid, pixelToGrid]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!dragState.isDragging || !dragState.draggedItem || !dragState.ghostPosition) {
      setDragState({
        isDragging: false,
        dragOffset: { x: 0, y: 0 },
        validDropZones: []
      });
      return;
    }

    const newPosition = dragState.ghostPosition;
    const item = dragState.draggedItem;

    // Check if position is valid
    if (!checkCollision(item, newPosition)) {
      // Update layout
      const updatedItems = layout.items.map(layoutItem =>
        layoutItem.id === item.id
          ? { ...layoutItem, position: newPosition }
          : layoutItem
      );

      onLayoutChange({
        ...layout,
        items: updatedItems,
        updatedAt: new Date()
      });
    }

    setDragState({
      isDragging: false,
      dragOffset: { x: 0, y: 0 },
      validDropZones: []
    });
  }, [dragState, layout, onLayoutChange, checkCollision]);

  // Handle resize start
  const handleResizeStart = useCallback((item: LayoutItem, handle: ResizeState['resizeHandle']) => {
    if (!editable || !item.resizable) return;

    setResizeState({
      isResizing: true,
      resizedItem: item,
      resizeHandle: handle,
      startSize: item.size,
      minSize: item.minSize || { width: 1, height: 1 },
      maxSize: item.maxSize || { width: gridMetrics.columns, height: gridMetrics.rows }
    });

    setSelectedItems(new Set([item.id]));
  }, [editable, gridMetrics]);

  // Handle resize move
  const handleResizeMove = useCallback((deltaX: number, deltaY: number) => {
    if (!resizeState.isResizing || !resizeState.resizedItem) return;

    const { resizeHandle, startSize, minSize, maxSize } = resizeState;
    let newSize = { ...startSize };

    const cellWidth = gridMetrics.cellWidth + gridMetrics.gap;
    const cellHeight = gridMetrics.cellHeight + gridMetrics.gap;

    const gridDeltaX = Math.round(deltaX / cellWidth);
    const gridDeltaY = Math.round(deltaY / cellHeight);

    switch (resizeHandle) {
      case 'se':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width + gridDeltaX));
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height + gridDeltaY));
        break;
      case 'sw':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width - gridDeltaX));
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height + gridDeltaY));
        break;
      case 'ne':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width + gridDeltaX));
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height - gridDeltaY));
        break;
      case 'nw':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width - gridDeltaX));
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height - gridDeltaY));
        break;
      case 'e':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width + gridDeltaX));
        break;
      case 'w':
        newSize.width = Math.max(minSize.width, Math.min(maxSize.width, startSize.width - gridDeltaX));
        break;
      case 's':
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height + gridDeltaY));
        break;
      case 'n':
        newSize.height = Math.max(minSize.height, Math.min(maxSize.height, startSize.height - gridDeltaY));
        break;
    }

    // Check for collisions with new size
    if (!checkCollision(resizeState.resizedItem, resizeState.resizedItem.position, newSize)) {
      const updatedItems = layout.items.map(item =>
        item.id === resizeState.resizedItem!.id
          ? { ...item, size: newSize }
          : item
      );

      onLayoutChange({
        ...layout,
        items: updatedItems,
        updatedAt: new Date()
      });
    }
  }, [resizeState, gridMetrics, layout, onLayoutChange, checkCollision]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setResizeState({
      isResizing: false,
      resizeHandle: null,
      startSize: { width: 0, height: 0 },
      minSize: { width: 1, height: 1 },
      maxSize: { width: 12, height: 12 }
    });
  }, []);

  // Handle item selection
  const handleItemSelect = useCallback((item: LayoutItem, multiSelect: boolean = false) => {
    if (multiSelect) {
      setSelectedItems(prev => {
        const newSelection = new Set(prev);
        if (newSelection.has(item.id)) {
          newSelection.delete(item.id);
        } else {
          newSelection.add(item.id);
        }
        return newSelection;
      });
    } else {
      setSelectedItems(new Set([item.id]));
    }

    onItemClick?.(item);
  }, [onItemClick]);

  // Render grid background
  const renderGridBackground = () => {
    if (!showGrid) return null;

    const gridLines = [];

    // Vertical lines
    for (let i = 0; i <= gridMetrics.columns; i++) {
      const x = gridMetrics.padding + (i * (gridMetrics.cellWidth + gridMetrics.gap)) - gridMetrics.gap / 2;
      gridLines.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={gridMetrics.padding}
          x2={x}
          y2="100%"
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      );
    }

    // Horizontal lines
    for (let i = 0; i <= gridMetrics.rows; i++) {
      const y = gridMetrics.padding + (i * (gridMetrics.cellHeight + gridMetrics.gap)) - gridMetrics.gap / 2;
      gridLines.push(
        <line
          key={`h-${i}`}
          x1={gridMetrics.padding}
          y1={y}
          x2="100%"
          y2={y}
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray="2,2"
        />
      );
    }

    return (
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {gridLines}
      </svg>
    );
  };

  // Render drop zones
  const renderDropZones = () => {
    if (!dragState.isDragging || !dragState.draggedItem) return null;

    return dragState.validDropZones.map(zone => {
      const pixel = gridToPixel(zone.x, zone.y);
      const size = dragState.draggedItem!.size;

      return (
        <div
          key={`drop-zone-${zone.x}-${zone.y}`}
          className="absolute bg-primary-100 border-2 border-dashed border-primary-300 rounded opacity-50"
          style={{
            left: pixel.x,
            top: pixel.y,
            width: size.width * gridMetrics.cellWidth + (size.width - 1) * gridMetrics.gap,
            height: size.height * gridMetrics.cellHeight + (size.height - 1) * gridMetrics.gap,
            zIndex: 10
          }}
        />
      );
    });
  };

  // Render layout item
  const renderLayoutItem = (item: LayoutItem) => {
    const pixel = gridToPixel(item.position.x, item.position.y);
    const width = item.size.width * gridMetrics.cellWidth + (item.size.width - 1) * gridMetrics.gap;
    const height = item.size.height * gridMetrics.cellHeight + (item.size.height - 1) * gridMetrics.gap;
    const isSelected = selectedItems.has(item.id);
    const isDragged = dragState.draggedItem?.id === item.id;
    const isResized = resizeState.resizedItem?.id === item.id;

    return (
      <LayoutItemComponent
        key={item.id}
        item={item}
        position={pixel}
        width={width}
        height={height}
        isSelected={isSelected}
        isDragged={isDragged}
        isResized={isResized}
        editable={editable}
        onDragStart={handleDragStart}
        onResizeStart={handleResizeStart}
        onSelect={handleItemSelect}
        onDoubleClick={onItemDoubleClick}
      >
        {renderWidget(item)}
      </LayoutItemComponent>
    );
  };

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (dragState.isDragging) {
        handleDragMove(event as any);
      }
    };

    const handleMouseUp = () => {
      if (dragState.isDragging) {
        handleDragEnd();
      }
      if (resizeState.isResizing) {
        handleResizeEnd();
      }
    };

    if (dragState.isDragging || resizeState.isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState.isDragging, resizeState.isResizing, handleDragMove, handleDragEnd, handleResizeEnd]);

  return (
    <div
      ref={containerRef}
      className={`dashboard-layout-engine relative overflow-hidden ${className}`}
      style={{
        minHeight: '100vh',
        userSelect: dragState.isDragging || resizeState.isResizing ? 'none' : 'auto'
      }}
      data-testid="dashboard-layout-engine"
    >
      {renderGridBackground()}
      {renderDropZones()}

      <AnimatePresence>
        {layout.items.map(renderLayoutItem)}
      </AnimatePresence>

      {/* Layout metadata */}
      <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 p-2 rounded shadow text-xs text-gray-600 dark:text-gray-400">
        <div>Grid: {gridMetrics.columns}×{gridMetrics.rows}</div>
        <div>Items: {layout.items.length}</div>
        {selectedItems.size > 0 && <div>Selected: {selectedItems.size}</div>}
      </div>
    </div>
  );
};

// Layout Item Component
interface LayoutItemComponentProps {
  item: LayoutItem;
  position: { x: number; y: number };
  width: number;
  height: number;
  isSelected: boolean;
  isDragged: boolean;
  isResized: boolean;
  editable: boolean;
  onDragStart: (item: LayoutItem, event: PointerEvent) => void;
  onResizeStart: (item: LayoutItem, handle: ResizeState['resizeHandle']) => void;
  onSelect: (item: LayoutItem, multiSelect: boolean) => void;
  onDoubleClick?: (item: LayoutItem) => void;
  children: React.ReactNode;
}

const LayoutItemComponent: React.FC<LayoutItemComponentProps> = ({
  item,
  position,
  width,
  height,
  isSelected,
  isDragged,
  isResized,
  editable,
  onDragStart,
  onResizeStart,
  onSelect,
  onDoubleClick,
  children
}) => {
  const dragControls = useDragControls();

  const resizeHandles = [
    { position: 'nw', cursor: 'nw-resize', style: { top: -4, left: -4 } },
    { position: 'ne', cursor: 'ne-resize', style: { top: -4, right: -4 } },
    { position: 'sw', cursor: 'sw-resize', style: { bottom: -4, left: -4 } },
    { position: 'se', cursor: 'se-resize', style: { bottom: -4, right: -4 } },
    { position: 'n', cursor: 'n-resize', style: { top: -4, left: '50%', transform: 'translateX(-50%)' } },
    { position: 's', cursor: 's-resize', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)' } },
    { position: 'w', cursor: 'w-resize', style: { left: -4, top: '50%', transform: 'translateY(-50%)' } },
    { position: 'e', cursor: 'e-resize', style: { right: -4, top: '50%', transform: 'translateY(-50%)' } }
  ];

  return (
    <motion.div
      className={`absolute bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 transition-all duration-200 ${
        isSelected
          ? 'border-primary-500 shadow-lg'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      } ${isDragged ? 'z-50' : 'z-10'} ${item.locked ? 'cursor-not-allowed' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
        opacity: isDragged ? 0.8 : 1
      }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: isDragged ? 0.8 : 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      onPointerDown={(event) => {
        if (!item.locked && editable && item.draggable) {
          onSelect(item, event.ctrlKey || event.metaKey);
        }
      }}
      onDoubleClick={() => onDoubleClick?.(item)}
      data-testid={`layout-item-${item.id}`}
    >
      {/* Drag handle */}
      {editable && item.draggable && !item.locked && (
        <div
          className="absolute top-2 right-2 cursor-move p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          onPointerDown={(event) => {
            event.preventDefault();
            onDragStart(item, event.nativeEvent);
          }}
          data-testid="drag-handle"
        >
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>
      )}

      {/* Widget content */}
      <div className="p-4 h-full overflow-hidden">
        {children}
      </div>

      {/* Resize handles */}
      {editable && item.resizable && !item.locked && isSelected && (
        <>
          {resizeHandles.map(handle => (
            <div
              key={handle.position}
              className="absolute w-3 h-3 bg-primary-500 rounded-sm cursor-pointer hover:bg-primary-600"
              style={{
                ...handle.style,
                cursor: handle.cursor
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onResizeStart(item, handle.position as ResizeState['resizeHandle']);
              }}
              data-testid={`resize-handle-${handle.position}`}
            />
          ))}
        </>
      )}

      {/* Lock indicator */}
      {item.locked && (
        <div className="absolute top-2 left-2 text-gray-400">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </motion.div>
  );
};

export default DashboardLayoutEngine;