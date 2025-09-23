/**
 * Widget Embed Code Generator
 * Generates secure, responsive embed codes for TurtleTrading widgets
 */

import { WidgetInstance, WidgetConfig, ContentSecurityPolicy } from '../sdk/WidgetSDK';

export interface EmbedConfig {
  instanceId: string;
  apiKey: string;
  theme?: 'light' | 'dark' | 'auto';
  responsive?: boolean;
  autoResize?: boolean;
  fallbackContent?: string;
  loadingContent?: string;
  errorContent?: string;
  onLoad?: string;
  onError?: string;
  onResize?: string;
  customCSS?: string;
  sandbox?: string[];
  allow?: string[];
  csp?: ContentSecurityPolicy;
}

export interface EmbedSnippet {
  html: string;
  javascript: string;
  css: string;
  documentation: string;
  preview: string;
}

export class EmbedGenerator {
  private baseUrl: string;
  private cdnUrl: string;

  constructor(baseUrl: string = '', cdnUrl: string = '/static/widgets') {
    this.baseUrl = baseUrl || window.location.origin;
    this.cdnUrl = cdnUrl;
  }

  /**
   * Generate complete embed snippet
   */
  public generateEmbedSnippet(config: EmbedConfig): EmbedSnippet {
    const html = this.generateHTML(config);
    const javascript = this.generateJavaScript(config);
    const css = this.generateCSS(config);
    const documentation = this.generateDocumentation(config);
    const preview = this.generatePreview(config);

    return {
      html,
      javascript,
      css,
      documentation,
      preview
    };
  }

  /**
   * Generate HTML embed code
   */
  private generateHTML(config: EmbedConfig): string {
    const containerId = `turtle-widget-${config.instanceId}`;
    const loadingContent = config.loadingContent || this.getDefaultLoadingContent();
    const errorContent = config.errorContent || this.getDefaultErrorContent();

    return `<!-- TurtleTrading Widget Embed -->
<div id="${containerId}"
     class="turtle-widget-container"
     data-widget-id="${config.instanceId}"
     data-api-key="${config.apiKey}"
     ${config.theme ? `data-theme="${config.theme}"` : ''}
     ${config.responsive ? 'data-responsive="true"' : ''}
     ${config.autoResize ? 'data-auto-resize="true"' : ''}>

  <!-- Loading State -->
  <div class="turtle-widget-loading" style="display: flex; align-items: center; justify-content: center; height: 100%; min-height: 200px;">
    ${loadingContent}
  </div>

  <!-- Error State (hidden by default) -->
  <div class="turtle-widget-error" style="display: none;">
    ${errorContent}
  </div>

  <!-- Fallback Content -->
  ${config.fallbackContent ? `<noscript>${config.fallbackContent}</noscript>` : ''}
</div>

<!-- Widget Loader Script -->
<script src="${this.cdnUrl}/loader.js"
        async
        data-container="${containerId}"></script>`;
  }

  /**
   * Generate JavaScript embed code
   */
  private generateJavaScript(config: EmbedConfig): string {
    const securityConfig = this.generateSecurityConfig(config);
    const callbacks = this.generateCallbacks(config);

    return `(function() {
  'use strict';

  // Configuration
  const config = ${JSON.stringify({
    instanceId: config.instanceId,
    apiKey: config.apiKey,
    theme: config.theme || 'auto',
    responsive: config.responsive || false,
    autoResize: config.autoResize || false,
    baseUrl: this.baseUrl,
    cdnUrl: this.cdnUrl
  }, null, 2)};

  // Security configuration
  const security = ${JSON.stringify(securityConfig, null, 2)};

  // Widget loader class
  class TurtleWidgetLoader {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      this.iframe = null;
      this.isLoaded = false;
      this.retryCount = 0;
      this.maxRetries = 3;

      if (!this.container) {
        console.error('TurtleTrading Widget: Container not found');
        return;
      }

      this.init();
    }

    init() {
      // Create iframe
      this.iframe = document.createElement('iframe');
      this.setupIframe();
      this.setupEventListeners();
      this.loadWidget();
    }

    setupIframe() {
      const iframe = this.iframe;

      // Basic attributes
      iframe.src = this.generateWidgetUrl();
      iframe.frameBorder = '0';
      iframe.scrolling = 'no';
      iframe.loading = 'lazy';

      // Security attributes
      iframe.sandbox = security.sandbox.join(' ');
      if (security.allow.length > 0) {
        iframe.allow = security.allow.join('; ');
      }

      // Styling
      iframe.style.cssText = \`
        width: 100%;
        height: 100%;
        border: none;
        display: block;
        background: transparent;
      \`;

      // Accessibility
      iframe.title = 'TurtleTrading Widget';
      iframe.setAttribute('aria-label', 'Interactive trading widget');
    }

    setupEventListeners() {
      // Iframe load events
      this.iframe.addEventListener('load', () => {
        this.onWidgetLoaded();
      });

      this.iframe.addEventListener('error', () => {
        this.onWidgetError();
      });

      // Responsive handling
      if (config.responsive) {
        window.addEventListener('resize', () => {
          this.handleResize();
        });
      }

      // Message handling for postMessage API
      window.addEventListener('message', (event) => {
        this.handleMessage(event);
      });

      // Intersection observer for lazy loading
      if ('IntersectionObserver' in window) {
        this.setupLazyLoading();
      }
    }

    generateWidgetUrl() {
      const params = new URLSearchParams({
        instance: config.instanceId,
        theme: this.detectTheme(),
        version: '1.0.0',
        referrer: window.location.hostname,
        timestamp: Date.now().toString()
      });

      return \`\${config.baseUrl}/embed/widget?\${params.toString()}\`;
    }

    detectTheme() {
      if (config.theme === 'auto') {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          return 'dark';
        }
        return 'light';
      }
      return config.theme;
    }

    loadWidget() {
      const loadingElement = this.container.querySelector('.turtle-widget-loading');

      // Hide loading after timeout
      setTimeout(() => {
        if (!this.isLoaded && loadingElement) {
          loadingElement.style.display = 'none';
        }
      }, 10000);

      // Replace loading content with iframe
      if (loadingElement) {
        loadingElement.style.display = 'none';
      }

      this.container.appendChild(this.iframe);
    }

    onWidgetLoaded() {
      this.isLoaded = true;
      this.hideLoadingState();
      this.showWidget();

      ${callbacks.onLoad || '// Widget loaded successfully'}

      // Trigger custom load event
      this.container.dispatchEvent(new CustomEvent('turtle:widget:loaded', {
        detail: { instanceId: config.instanceId }
      }));
    }

    onWidgetError() {
      this.hideLoadingState();
      this.showErrorState();

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(() => {
          this.retry();
        }, 2000 * this.retryCount);
      }

      ${callbacks.onError || '// Widget error occurred'}

      // Trigger custom error event
      this.container.dispatchEvent(new CustomEvent('turtle:widget:error', {
        detail: { instanceId: config.instanceId, retryCount: this.retryCount }
      }));
    }

    retry() {
      this.hideErrorState();
      this.showLoadingState();
      this.iframe.src = this.generateWidgetUrl();
    }

    handleMessage(event) {
      // Verify origin for security
      if (event.origin !== config.baseUrl) {
        return;
      }

      const data = event.data;
      if (data.type === 'turtle:widget:resize' && config.autoResize) {
        this.resizeWidget(data.width, data.height);
      }
    }

    handleResize() {
      ${callbacks.onResize || '// Handle container resize'}

      // Notify widget of container size change
      if (this.iframe && this.iframe.contentWindow) {
        this.iframe.contentWindow.postMessage({
          type: 'turtle:container:resize',
          width: this.container.offsetWidth,
          height: this.container.offsetHeight
        }, config.baseUrl);
      }
    }

    resizeWidget(width, height) {
      if (this.iframe) {
        this.iframe.style.width = width + 'px';
        this.iframe.style.height = height + 'px';
      }
    }

    hideLoadingState() {
      const loading = this.container.querySelector('.turtle-widget-loading');
      if (loading) loading.style.display = 'none';
    }

    showLoadingState() {
      const loading = this.container.querySelector('.turtle-widget-loading');
      if (loading) loading.style.display = 'flex';
    }

    showErrorState() {
      const error = this.container.querySelector('.turtle-widget-error');
      if (error) error.style.display = 'block';
    }

    hideErrorState() {
      const error = this.container.querySelector('.turtle-widget-error');
      if (error) error.style.display = 'none';
    }

    showWidget() {
      if (this.iframe) {
        this.iframe.style.opacity = '1';
      }
    }

    setupLazyLoading() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !this.isLoaded) {
            observer.unobserve(entry.target);
            // Widget will load when visible
          }
        });
      });

      observer.observe(this.container);
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new TurtleWidgetLoader('${config.instanceId}');
    });
  } else {
    new TurtleWidgetLoader('${config.instanceId}');
  }

  // Expose loader for manual control
  window.TurtleWidgetLoader = TurtleWidgetLoader;

})();`;
  }

  /**
   * Generate CSS for widget container
   */
  private generateCSS(config: EmbedConfig): string {
    return `/* TurtleTrading Widget Styles */
.turtle-widget-container {
  position: relative;
  width: 100%;
  min-height: 200px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.turtle-widget-container[data-theme="dark"] {
  background: #1f2937;
  border-color: #374151;
  color: #ffffff;
}

.turtle-widget-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
  color: #6b7280;
  font-size: 14px;
}

.turtle-widget-loading .spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #e5e7eb;
  border-top: 2px solid #3b82f6;
  border-radius: 50%;
  margin-right: 8px;
  animation: turtle-spin 1s linear infinite;
}

.turtle-widget-error {
  padding: 20px;
  text-align: center;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  margin: 16px;
}

.turtle-widget-error h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.turtle-widget-error p {
  margin: 0 0 12px 0;
  font-size: 14px;
  line-height: 1.5;
}

.turtle-widget-error button {
  background: #dc2626;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.turtle-widget-error button:hover {
  background: #b91c1c;
}

/* Responsive styles */
.turtle-widget-container[data-responsive="true"] {
  max-width: 100%;
  height: auto;
}

.turtle-widget-container iframe {
  transition: opacity 0.3s ease;
  opacity: 0;
}

.turtle-widget-container.loaded iframe {
  opacity: 1;
}

/* Animation keyframes */
@keyframes turtle-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Print styles */
@media print {
  .turtle-widget-container {
    display: none;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .turtle-widget-container {
    border-width: 2px;
    border-color: #000000;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .turtle-widget-loading .spinner {
    animation: none;
  }

  .turtle-widget-container iframe {
    transition: none;
  }
}

${config.customCSS || ''}`;
  }

  /**
   * Generate documentation for the embed
   */
  private generateDocumentation(config: EmbedConfig): string {
    return `# TurtleTrading Widget Embed Documentation

## Overview
This embed code creates a secure, responsive TurtleTrading widget on your website.

## Configuration
- **Widget ID**: ${config.instanceId}
- **Theme**: ${config.theme || 'auto'}
- **Responsive**: ${config.responsive ? 'Yes' : 'No'}
- **Auto Resize**: ${config.autoResize ? 'Yes' : 'No'}

## Security Features
- Content Security Policy (CSP) headers
- Sandboxed iframe execution
- Origin validation for postMessage
- HTTPS-only communication

## Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+
- Mobile browsers with iframe support

## Installation

### 1. Basic Installation
Copy and paste the HTML code into your webpage where you want the widget to appear.

### 2. Custom Styling
Add the CSS code to your stylesheet or in a <style> tag to customize the appearance.

### 3. Advanced Configuration
Use the JavaScript code for advanced customization and event handling.

## Events

### Widget Events
- \`turtle:widget:loaded\` - Fired when widget successfully loads
- \`turtle:widget:error\` - Fired when widget fails to load
- \`turtle:widget:resize\` - Fired when widget changes size

### Example Event Handling
\`\`\`javascript
document.getElementById('${config.instanceId}').addEventListener('turtle:widget:loaded', function(event) {
  console.log('Widget loaded:', event.detail.instanceId);
});
\`\`\`

## Customization Options

### Theme
Control the widget appearance with the \`data-theme\` attribute:
- \`light\` - Light theme
- \`dark\` - Dark theme
- \`auto\` - Automatic based on user preference

### Responsive Behavior
Enable responsive sizing with \`data-responsive="true"\`

### Auto Resize
Allow widget to resize based on content with \`data-auto-resize="true"\`

## Troubleshooting

### Widget Not Loading
1. Check that JavaScript is enabled
2. Verify the API key is correct
3. Ensure the domain is whitelisted
4. Check browser console for errors

### Performance Optimization
1. Load widgets below the fold with lazy loading
2. Use responsive images in fallback content
3. Minimize custom CSS complexity
4. Consider using multiple smaller widgets instead of one large widget

## Content Security Policy

Add the following CSP headers to your server response:

\`\`\`
Content-Security-Policy: frame-src ${this.baseUrl}; script-src ${this.cdnUrl};
\`\`\`

## Support

For technical support, contact:
- Email: widgets@turtletrading.com
- Documentation: ${this.baseUrl}/docs/widgets
- Status Page: ${this.baseUrl}/status`;
  }

  /**
   * Generate preview HTML
   */
  private generatePreview(config: EmbedConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TurtleTrading Widget Preview</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f9fafb;
    }
    .preview-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .preview-widget {
      width: 100%;
      height: 400px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="preview-container">
    <h1>Widget Preview</h1>
    <p>This is how your TurtleTrading widget will appear on your website.</p>

    <div class="preview-widget">
      ${this.generateHTML(config)}
    </div>

    <details>
      <summary>View Embed Code</summary>
      <pre><code>${this.escapeHtml(this.generateHTML(config))}</code></pre>
    </details>
  </div>

  <style>${this.generateCSS(config)}</style>
  <script>${this.generateJavaScript(config)}</script>
</body>
</html>`;
  }

  /**
   * Generate security configuration
   */
  private generateSecurityConfig(config: EmbedConfig): any {
    const defaultSandbox = [
      'allow-scripts',
      'allow-same-origin',
      'allow-popups',
      'allow-forms'
    ];

    const defaultAllow = [
      'clipboard-read',
      'clipboard-write'
    ];

    return {
      sandbox: config.sandbox || defaultSandbox,
      allow: config.allow || defaultAllow,
      csp: config.csp || null
    };
  }

  /**
   * Generate callback functions
   */
  private generateCallbacks(config: EmbedConfig): any {
    return {
      onLoad: config.onLoad,
      onError: config.onError,
      onResize: config.onResize
    };
  }

  /**
   * Get default loading content
   */
  private getDefaultLoadingContent(): string {
    return `
    <div class="spinner"></div>
    <span>Loading TurtleTrading Widget...</span>
    `;
  }

  /**
   * Get default error content
   */
  private getDefaultErrorContent(): string {
    return `
    <h3>Widget Failed to Load</h3>
    <p>We're sorry, but the TurtleTrading widget couldn't be loaded at this time.</p>
    <button onclick="location.reload()">Retry</button>
    `;
  }

  /**
   * Escape HTML for safe display
   */
  private escapeHtml(html: string): string {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}

export default EmbedGenerator;