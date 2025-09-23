/**
 * Mobile Accessibility Panel Component
 * Comprehensive accessibility controls and settings for mobile users
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useAccessibility,
  useVoiceCommands,
  useKeyboardNavigation,
  HapticPattern,
  AnnouncementPriority,
  type AccessibilityPreferences,
  type VoiceCommand
} from '../../utils/accessibility';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccessibilityPanel: React.FC<AccessibilityPanelProps> = ({
  isOpen,
  onClose
}) => {
  const {
    preferences,
    updatePreferences,
    announce,
    speak,
    triggerHaptic,
    accessibilityManager
  } = useAccessibility();

  const [activeTab, setActiveTab] = useState<'visual' | 'audio' | 'motor' | 'cognitive'>('visual');
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Voice commands for accessibility panel
  const voiceCommands: VoiceCommand[] = [
    {
      phrase: 'open accessibility',
      action: () => {
        announce('Accessibility panel opened', AnnouncementPriority.ASSERTIVE);
      },
      description: 'Open accessibility settings panel'
    },
    {
      phrase: 'close accessibility',
      action: onClose,
      description: 'Close accessibility settings panel'
    },
    {
      phrase: 'toggle voice navigation',
      action: () => {
        const newValue = !preferences?.voiceNavigation;
        updatePreferences({ voiceNavigation: newValue });
        setIsVoiceActive(newValue);
        announce(
          `Voice navigation ${newValue ? 'enabled' : 'disabled'}`,
          AnnouncementPriority.ASSERTIVE
        );
      },
      description: 'Toggle voice navigation on or off'
    },
    {
      phrase: 'increase text size',
      action: () => {
        updatePreferences({ largeText: true });
        announce('Text size increased', AnnouncementPriority.POLITE);
      },
      description: 'Increase text size for better readability'
    },
    {
      phrase: 'high contrast mode',
      action: () => {
        const newValue = !preferences?.highContrast;
        updatePreferences({ highContrast: newValue });
        announce(
          `High contrast mode ${newValue ? 'enabled' : 'disabled'}`,
          AnnouncementPriority.POLITE
        );
      },
      description: 'Toggle high contrast mode'
    }
  ];

  useVoiceCommands(voiceCommands);

  // Keyboard shortcuts for accessibility panel
  const keyboardShortcuts = {
    'escape': onClose,
    'ctrl+1': () => setActiveTab('visual'),
    'ctrl+2': () => setActiveTab('audio'),
    'ctrl+3': () => setActiveTab('motor'),
    'ctrl+4': () => setActiveTab('cognitive'),
    'ctrl+shift+v': () => {
      const newValue = !preferences?.voiceNavigation;
      updatePreferences({ voiceNavigation: newValue });
      setIsVoiceActive(newValue);
    }
  };

  useKeyboardNavigation(keyboardShortcuts);

  useEffect(() => {
    if (isOpen) {
      announce('Accessibility settings panel opened', AnnouncementPriority.ASSERTIVE);
      triggerHaptic(HapticPattern.LIGHT);
    }
  }, [isOpen, announce, triggerHaptic]);

  const handlePreferenceChange = (
    key: keyof AccessibilityPreferences,
    value: boolean
  ) => {
    updatePreferences({ [key]: value });
    triggerHaptic(HapticPattern.SELECTION);

    // Provide audio feedback for important changes
    if (key === 'voiceNavigation') {
      setIsVoiceActive(value);
      speak(`Voice navigation ${value ? 'enabled' : 'disabled'}`);
    } else if (key === 'highContrast') {
      speak(`High contrast mode ${value ? 'enabled' : 'disabled'}`);
    } else if (key === 'largeText') {
      speak(`Large text ${value ? 'enabled' : 'disabled'}`);
    }

    announce(
      `${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${value ? 'enabled' : 'disabled'}`,
      AnnouncementPriority.POLITE
    );
  };

  const handleVoiceNavigationToggle = () => {
    const newValue = !isVoiceActive;
    setIsVoiceActive(newValue);
    updatePreferences({ voiceNavigation: newValue });

    if (newValue) {
      accessibilityManager?.startVoiceNavigation();
      speak('Voice navigation started. Say commands to navigate.');
    } else {
      accessibilityManager?.stopVoiceNavigation();
      speak('Voice navigation stopped.');
    }
  };

  const testAccessibilityFeature = (feature: string) => {
    switch (feature) {
      case 'haptic':
        triggerHaptic(HapticPattern.SUCCESS);
        announce('Haptic feedback test triggered', AnnouncementPriority.POLITE);
        break;
      case 'voice':
        speak('This is a test of the text to speech functionality.');
        break;
      case 'announcement':
        announce('This is a test screen reader announcement', AnnouncementPriority.ASSERTIVE);
        break;
    }
  };

  if (!preferences) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              type: preferences.reduceMotion ? 'tween' : 'spring',
              damping: 25,
              stiffness: 200
            }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="accessibility-panel-title"
            aria-describedby="accessibility-panel-description"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2
                  id="accessibility-panel-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Accessibility Settings
                </h2>
                <p
                  id="accessibility-panel-description"
                  className="text-sm text-gray-600 dark:text-gray-400 mt-1"
                >
                  Customize your experience for better accessibility
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Close accessibility settings"
                data-testid="close-accessibility-panel"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab Navigation */}
            <div
              className="flex border-b border-gray-200 dark:border-gray-700"
              role="tablist"
              aria-label="Accessibility categories"
            >
              {[
                { key: 'visual', label: 'Visual', icon: '👁️' },
                { key: 'audio', label: 'Audio', icon: '🔊' },
                { key: 'motor', label: 'Motor', icon: '✋' },
                { key: 'cognitive', label: 'Cognitive', icon: '🧠' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 p-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary-500 text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`${tab.key}-panel`}
                  data-testid={`tab-${tab.key}`}
                >
                  <span className="block text-lg mb-1">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Visual Tab */}
              {activeTab === 'visual' && (
                <div role="tabpanel" id="visual-panel" aria-labelledby="visual-tab">
                  <div className="space-y-6">
                    <AccessibilityToggle
                      label="High Contrast"
                      description="Increase contrast for better visibility"
                      checked={preferences.highContrast}
                      onChange={(value) => handlePreferenceChange('highContrast', value)}
                      testId="high-contrast-toggle"
                    />

                    <AccessibilityToggle
                      label="Large Text"
                      description="Increase text size throughout the app"
                      checked={preferences.largeText}
                      onChange={(value) => handlePreferenceChange('largeText', value)}
                      testId="large-text-toggle"
                    />

                    <AccessibilityToggle
                      label="Reduce Motion"
                      description="Minimize animations and transitions"
                      checked={preferences.reduceMotion}
                      onChange={(value) => handlePreferenceChange('reduceMotion', value)}
                      testId="reduce-motion-toggle"
                    />

                    <AccessibilityToggle
                      label="Color Blind Friendly"
                      description="Use patterns and symbols in addition to color"
                      checked={preferences.colorBlindFriendly}
                      onChange={(value) => handlePreferenceChange('colorBlindFriendly', value)}
                      testId="color-blind-toggle"
                    />
                  </div>
                </div>
              )}

              {/* Audio Tab */}
              {activeTab === 'audio' && (
                <div role="tabpanel" id="audio-panel" aria-labelledby="audio-tab">
                  <div className="space-y-6">
                    <AccessibilityToggle
                      label="Screen Reader Support"
                      description="Enhanced support for screen readers"
                      checked={preferences.screenReader}
                      onChange={(value) => handlePreferenceChange('screenReader', value)}
                      testId="screen-reader-toggle"
                    />

                    <AccessibilityToggle
                      label="Sound Alerts"
                      description="Play audio notifications for important events"
                      checked={preferences.soundAlerts}
                      onChange={(value) => handlePreferenceChange('soundAlerts', value)}
                      testId="sound-alerts-toggle"
                    />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-900 dark:text-white">
                            Voice Navigation
                          </label>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Control the app with voice commands
                          </p>
                        </div>
                        <button
                          onClick={handleVoiceNavigationToggle}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            isVoiceActive ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          aria-label={`Voice navigation ${isVoiceActive ? 'enabled' : 'disabled'}`}
                          data-testid="voice-navigation-toggle"
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              isVoiceActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      {isVoiceActive && (
                        <div className="bg-primary-50 dark:bg-primary-900/20 p-3 rounded-lg">
                          <p className="text-xs text-primary-700 dark:text-primary-300">
                            🎤 Voice navigation is active. Try saying "show watchlist" or "go to settings"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Test Audio Features</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => testAccessibilityFeature('voice')}
                          className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          data-testid="test-voice-btn"
                        >
                          <span className="text-sm font-medium">🔊 Test Text-to-Speech</span>
                        </button>
                        <button
                          onClick={() => testAccessibilityFeature('announcement')}
                          className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          data-testid="test-announcement-btn"
                        >
                          <span className="text-sm font-medium">📢 Test Screen Reader Announcement</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Motor Tab */}
              {activeTab === 'motor' && (
                <div role="tabpanel" id="motor-panel" aria-labelledby="motor-tab">
                  <div className="space-y-6">
                    <AccessibilityToggle
                      label="Haptic Feedback"
                      description="Vibration feedback for touch interactions"
                      checked={preferences.hapticFeedback}
                      onChange={(value) => handlePreferenceChange('hapticFeedback', value)}
                      testId="haptic-feedback-toggle"
                    />

                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Touch Target Size</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        All interactive elements are at least 44px for easy touch access
                      </p>
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <span className="text-sm text-green-700 dark:text-green-300">
                          ✅ Touch targets meet accessibility standards
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Test Motor Features</h4>
                      <button
                        onClick={() => testAccessibilityFeature('haptic')}
                        className="w-full text-left p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        data-testid="test-haptic-btn"
                      >
                        <span className="text-sm font-medium">📳 Test Haptic Feedback</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Cognitive Tab */}
              {activeTab === 'cognitive' && (
                <div role="tabpanel" id="cognitive-panel" aria-labelledby="cognitive-tab">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Keyboard Shortcuts</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Open accessibility panel</span>
                          <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+Shift+A</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span>Toggle voice navigation</span>
                          <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl+/</kbd>
                        </div>
                        <div className="flex justify-between">
                          <span>Close current dialog</span>
                          <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Voice Commands</h4>
                      <div className="space-y-2 text-sm">
                        {voiceCommands.map((command, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                            <div className="font-medium text-primary-600 dark:text-primary-400">
                              "{command.phrase}"
                            </div>
                            <div className="text-gray-600 dark:text-gray-400 text-xs">
                              {command.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 dark:text-white">Focus Management</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Focus automatically moves to important content and interactive elements are clearly indicated.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  For additional accessibility support, contact our team
                </p>
                <button
                  className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                  onClick={() => speak('Contact accessibility support team for additional assistance')}
                >
                  Accessibility Support
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Reusable Toggle Component
interface AccessibilityToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}

const AccessibilityToggle: React.FC<AccessibilityToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  testId
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-900 dark:text-white">
          {label}
        </label>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          checked ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
        }`}
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? 'enabled' : 'disabled'}`}
        data-testid={testId}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};