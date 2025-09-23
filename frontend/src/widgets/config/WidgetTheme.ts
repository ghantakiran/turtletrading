/**
 * Widget Theming System
 * Comprehensive theming and styling for widgets with trading-specific themes
 */

export interface WidgetTheme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borders: ThemeBorders;
  shadows: ThemeShadows;
  animations: ThemeAnimations;
  chartTheme: ChartTheme;
}

export interface ThemeColors {
  // Base colors
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  warning: string;
  success: string;
  info: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  textInverse: string;

  // Trading-specific colors
  bull: string;
  bear: string;
  neutral: string;
  volume: string;
  support: string;
  resistance: string;

  // Interactive states
  hover: string;
  active: string;
  focus: string;
  disabled: string;

  // Border colors
  border: string;
  borderLight: string;
  borderFocus: string;
}

export interface ThemeTypography {
  fontFamily: string;
  monoFontFamily: string;
  sizes: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  weights: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
  };
  letterSpacing: {
    tight: string;
    normal: string;
    wide: string;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  '4xl': string;
}

export interface ThemeBorders {
  width: {
    thin: string;
    base: string;
    thick: string;
  };
  radius: {
    none: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    full: string;
  };
  style: {
    solid: string;
    dashed: string;
    dotted: string;
  };
}

export interface ThemeShadows {
  none: string;
  sm: string;
  base: string;
  lg: string;
  xl: string;
  inner: string;
  outline: string;
}

export interface ThemeAnimations {
  duration: {
    fast: string;
    base: string;
    slow: string;
  };
  easing: {
    linear: string;
    in: string;
    out: string;
    inOut: string;
  };
  scale: {
    hover: number;
    active: number;
  };
}

export interface ChartTheme {
  colors: {
    candle: {
      bull: string;
      bear: string;
      wick: string;
    };
    line: string[];
    area: {
      fill: string;
      stroke: string;
    };
    volume: {
      up: string;
      down: string;
    };
    indicators: string[];
  };
  grid: {
    color: string;
    style: string;
    width: string;
  };
  axis: {
    color: string;
    fontSize: string;
    fontWeight: number;
  };
  crosshair: {
    color: string;
    style: string;
    width: string;
  };
}

export class WidgetThemeManager {
  private themes: Map<string, WidgetTheme> = new Map();
  private currentTheme: string = 'trading-light';
  private customProperties: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultThemes();
  }

  /**
   * Register a new theme
   */
  public registerTheme(theme: WidgetTheme): void {
    this.themes.set(theme.id, theme);
  }

  /**
   * Get theme by ID
   */
  public getTheme(themeId: string): WidgetTheme | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Get all available themes
   */
  public getAllThemes(): WidgetTheme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Set current theme
   */
  public setCurrentTheme(themeId: string): void {
    if (this.themes.has(themeId)) {
      this.currentTheme = themeId;
      this.applyTheme(themeId);
    }
  }

  /**
   * Get current theme
   */
  public getCurrentTheme(): WidgetTheme {
    return this.themes.get(this.currentTheme)!;
  }

  /**
   * Apply theme to DOM
   */
  public applyTheme(themeId: string): void {
    const theme = this.themes.get(themeId);
    if (!theme) return;

    const root = document.documentElement;

    // Apply color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--widget-color-${key}`, value);
    });

    // Apply typography variables
    root.style.setProperty('--widget-font-family', theme.typography.fontFamily);
    root.style.setProperty('--widget-mono-font-family', theme.typography.monoFontFamily);

    Object.entries(theme.typography.sizes).forEach(([key, value]) => {
      root.style.setProperty(`--widget-text-${key}`, value);
    });

    Object.entries(theme.typography.weights).forEach(([key, value]) => {
      root.style.setProperty(`--widget-font-${key}`, value.toString());
    });

    // Apply spacing variables
    Object.entries(theme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--widget-spacing-${key}`, value);
    });

    // Apply border variables
    Object.entries(theme.borders.width).forEach(([key, value]) => {
      root.style.setProperty(`--widget-border-${key}`, value);
    });

    Object.entries(theme.borders.radius).forEach(([key, value]) => {
      root.style.setProperty(`--widget-radius-${key}`, value);
    });

    // Apply shadow variables
    Object.entries(theme.shadows).forEach(([key, value]) => {
      root.style.setProperty(`--widget-shadow-${key}`, value);
    });

    // Apply animation variables
    Object.entries(theme.animations.duration).forEach(([key, value]) => {
      root.style.setProperty(`--widget-duration-${key}`, value);
    });

    Object.entries(theme.animations.easing).forEach(([key, value]) => {
      root.style.setProperty(`--widget-easing-${key}`, value);
    });

    // Apply custom properties
    this.customProperties.forEach((value, key) => {
      root.style.setProperty(`--widget-custom-${key}`, value);
    });
  }

  /**
   * Create CSS variables object for widget
   */
  public createCSSVariables(themeId?: string): Record<string, string> {
    const theme = this.themes.get(themeId || this.currentTheme);
    if (!theme) return {};

    const variables: Record<string, string> = {};

    // Color variables
    Object.entries(theme.colors).forEach(([key, value]) => {
      variables[`--widget-color-${key}`] = value;
    });

    // Typography variables
    variables['--widget-font-family'] = theme.typography.fontFamily;
    variables['--widget-mono-font-family'] = theme.typography.monoFontFamily;

    Object.entries(theme.typography.sizes).forEach(([key, value]) => {
      variables[`--widget-text-${key}`] = value;
    });

    Object.entries(theme.typography.weights).forEach(([key, value]) => {
      variables[`--widget-font-${key}`] = value.toString();
    });

    // Spacing variables
    Object.entries(theme.spacing).forEach(([key, value]) => {
      variables[`--widget-spacing-${key}`] = value;
    });

    // Border variables
    Object.entries(theme.borders.width).forEach(([key, value]) => {
      variables[`--widget-border-${key}`] = value;
    });

    Object.entries(theme.borders.radius).forEach(([key, value]) => {
      variables[`--widget-radius-${key}`] = value;
    });

    // Shadow variables
    Object.entries(theme.shadows).forEach(([key, value]) => {
      variables[`--widget-shadow-${key}`] = value;
    });

    return variables;
  }

  /**
   * Set custom property
   */
  public setCustomProperty(key: string, value: string): void {
    this.customProperties.set(key, value);
    document.documentElement.style.setProperty(`--widget-custom-${key}`, value);
  }

  /**
   * Get custom property
   */
  public getCustomProperty(key: string): string | undefined {
    return this.customProperties.get(key);
  }

  /**
   * Create theme-aware CSS class
   */
  public createThemeClass(baseClass: string, variants: Record<string, string>): string {
    const theme = this.getCurrentTheme();
    const classes = [baseClass];

    Object.entries(variants).forEach(([property, value]) => {
      const themeValue = this.getThemeProperty(theme, property);
      if (themeValue) {
        classes.push(`${baseClass}--${property}-${value}`);
      }
    });

    return classes.join(' ');
  }

  /**
   * Get theme property by path
   */
  private getThemeProperty(theme: WidgetTheme, path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], theme);
  }

  /**
   * Initialize default themes
   */
  private initializeDefaultThemes(): void {
    // Trading Light Theme
    this.registerTheme({
      id: 'trading-light',
      name: 'Trading Light',
      description: 'Clean light theme optimized for trading data',
      colors: {
        primary: '#0ea5e9',
        secondary: '#64748b',
        background: '#ffffff',
        surface: '#f8fafc',
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#3b82f6',
        textPrimary: '#0f172a',
        textSecondary: '#475569',
        textDisabled: '#94a3b8',
        textInverse: '#ffffff',
        bull: '#22c55e',
        bear: '#ef4444',
        neutral: '#6b7280',
        volume: '#8b5cf6',
        support: '#06b6d4',
        resistance: '#f97316',
        hover: '#f1f5f9',
        active: '#e2e8f0',
        focus: '#0ea5e9',
        disabled: '#e2e8f0',
        border: '#e2e8f0',
        borderLight: '#f1f5f9',
        borderFocus: '#0ea5e9'
      },
      typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        monoFontFamily: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
        sizes: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        weights: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeights: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        },
        letterSpacing: {
          tight: '-0.025em',
          normal: '0em',
          wide: '0.025em'
        }
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
        '4xl': '6rem'
      },
      borders: {
        width: {
          thin: '1px',
          base: '2px',
          thick: '3px'
        },
        radius: {
          none: '0',
          sm: '0.25rem',
          base: '0.5rem',
          lg: '0.75rem',
          xl: '1rem',
          full: '9999px'
        },
        style: {
          solid: 'solid',
          dashed: 'dashed',
          dotted: 'dotted'
        }
      },
      shadows: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        outline: '0 0 0 3px rgba(14, 165, 233, 0.5)'
      },
      animations: {
        duration: {
          fast: '150ms',
          base: '250ms',
          slow: '500ms'
        },
        easing: {
          linear: 'linear',
          in: 'cubic-bezier(0.4, 0, 1, 1)',
          out: 'cubic-bezier(0, 0, 0.2, 1)',
          inOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
        },
        scale: {
          hover: 1.05,
          active: 0.95
        }
      },
      chartTheme: {
        colors: {
          candle: {
            bull: '#22c55e',
            bear: '#ef4444',
            wick: '#64748b'
          },
          line: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'],
          area: {
            fill: 'rgba(14, 165, 233, 0.1)',
            stroke: '#0ea5e9'
          },
          volume: {
            up: 'rgba(34, 197, 94, 0.6)',
            down: 'rgba(239, 68, 68, 0.6)'
          },
          indicators: ['#8b5cf6', '#f59e0b', '#06b6d4', '#f97316', '#ec4899']
        },
        grid: {
          color: '#f1f5f9',
          style: 'solid',
          width: '1px'
        },
        axis: {
          color: '#64748b',
          fontSize: '12px',
          fontWeight: 400
        },
        crosshair: {
          color: '#64748b',
          style: 'dashed',
          width: '1px'
        }
      }
    });

    // Trading Dark Theme
    this.registerTheme({
      id: 'trading-dark',
      name: 'Trading Dark',
      description: 'Professional dark theme for extended trading sessions',
      colors: {
        primary: '#0ea5e9',
        secondary: '#64748b',
        background: '#0f172a',
        surface: '#1e293b',
        error: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#3b82f6',
        textPrimary: '#f8fafc',
        textSecondary: '#cbd5e1',
        textDisabled: '#475569',
        textInverse: '#0f172a',
        bull: '#22c55e',
        bear: '#ef4444',
        neutral: '#94a3b8',
        volume: '#8b5cf6',
        support: '#06b6d4',
        resistance: '#f97316',
        hover: '#334155',
        active: '#475569',
        focus: '#0ea5e9',
        disabled: '#334155',
        border: '#334155',
        borderLight: '#475569',
        borderFocus: '#0ea5e9'
      },
      typography: {
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        monoFontFamily: '"JetBrains Mono", "Fira Code", "Monaco", monospace',
        sizes: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        weights: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeights: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        },
        letterSpacing: {
          tight: '-0.025em',
          normal: '0em',
          wide: '0.025em'
        }
      },
      spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
        '4xl': '6rem'
      },
      borders: {
        width: {
          thin: '1px',
          base: '2px',
          thick: '3px'
        },
        radius: {
          none: '0',
          sm: '0.25rem',
          base: '0.5rem',
          lg: '0.75rem',
          xl: '1rem',
          full: '9999px'
        },
        style: {
          solid: 'solid',
          dashed: 'dashed',
          dotted: 'dotted'
        }
      },
      shadows: {
        none: 'none',
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.2)',
        base: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.2)',
        outline: '0 0 0 3px rgba(14, 165, 233, 0.5)'
      },
      animations: {
        duration: {
          fast: '150ms',
          base: '250ms',
          slow: '500ms'
        },
        easing: {
          linear: 'linear',
          in: 'cubic-bezier(0.4, 0, 1, 1)',
          out: 'cubic-bezier(0, 0, 0.2, 1)',
          inOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
        },
        scale: {
          hover: 1.05,
          active: 0.95
        }
      },
      chartTheme: {
        colors: {
          candle: {
            bull: '#22c55e',
            bear: '#ef4444',
            wick: '#94a3b8'
          },
          line: ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'],
          area: {
            fill: 'rgba(14, 165, 233, 0.2)',
            stroke: '#0ea5e9'
          },
          volume: {
            up: 'rgba(34, 197, 94, 0.6)',
            down: 'rgba(239, 68, 68, 0.6)'
          },
          indicators: ['#8b5cf6', '#f59e0b', '#06b6d4', '#f97316', '#ec4899']
        },
        grid: {
          color: '#334155',
          style: 'solid',
          width: '1px'
        },
        axis: {
          color: '#94a3b8',
          fontSize: '12px',
          fontWeight: 400
        },
        crosshair: {
          color: '#94a3b8',
          style: 'dashed',
          width: '1px'
        }
      }
    });

    // Set default theme
    this.setCurrentTheme('trading-light');
  }
}

// Create global theme manager instance
export const themeManager = new WidgetThemeManager();

export default WidgetThemeManager;