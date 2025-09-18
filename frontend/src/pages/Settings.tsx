import React, { useState } from 'react';

interface UserSettings {
  notifications: {
    priceAlerts: boolean;
    newsAlerts: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    currency: 'USD' | 'EUR' | 'GBP';
    timeZone: string;
    refreshRate: number;
  };
  trading: {
    defaultPortfolioSize: number;
    riskTolerance: 'low' | 'medium' | 'high';
    autoRebalance: boolean;
    stopLossPercent: number;
  };
}

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      priceAlerts: true,
      newsAlerts: true,
      emailNotifications: false,
      pushNotifications: true,
    },
    display: {
      theme: 'auto',
      currency: 'USD',
      timeZone: 'America/New_York',
      refreshRate: 5,
    },
    trading: {
      defaultPortfolioSize: 10000,
      riskTolerance: 'medium',
      autoRebalance: false,
      stopLossPercent: 5,
    },
  });

  const [activeTab, setActiveTab] = useState<'notifications' | 'display' | 'trading'>('notifications');
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      // TODO: Implement API call to save settings
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const updateSetting = (section: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize your TurtleTrading experience
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`btn ${
            saved ? 'btn-bull' : 'btn-primary'
          } transition-all duration-200`}
        >
          {saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'notifications', label: '🔔 Notifications' },
            { id: 'display', label: '🎨 Display' },
            { id: 'trading', label: '📊 Trading' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="p-6">
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Price Alerts
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get notified when stocks hit your target prices
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.priceAlerts}
                    onChange={(e) => updateSetting('notifications', 'priceAlerts', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      News Alerts
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Breaking financial news and market updates
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.newsAlerts}
                    onChange={(e) => updateSetting('notifications', 'newsAlerts', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Email Notifications
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Daily market summaries and weekly reports
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.emailNotifications}
                    onChange={(e) => updateSetting('notifications', 'emailNotifications', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Push Notifications
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Real-time browser notifications
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications.pushNotifications}
                    onChange={(e) => updateSetting('notifications', 'pushNotifications', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Display Settings</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Theme
                  </label>
                  <select
                    value={settings.display.theme}
                    onChange={(e) => updateSetting('display', 'theme', e.target.value)}
                    className="input w-full max-w-xs"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Currency
                  </label>
                  <select
                    value={settings.display.currency}
                    onChange={(e) => updateSetting('display', 'currency', e.target.value)}
                    className="input w-full max-w-xs"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Time Zone
                  </label>
                  <select
                    value={settings.display.timeZone}
                    onChange={(e) => updateSetting('display', 'timeZone', e.target.value)}
                    className="input w-full max-w-xs"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London Time</option>
                    <option value="Europe/Frankfurt">Frankfurt Time</option>
                    <option value="Asia/Tokyo">Tokyo Time</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Data Refresh Rate (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={settings.display.refreshRate}
                    onChange={(e) => updateSetting('display', 'refreshRate', parseInt(e.target.value))}
                    className="input w-full max-w-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trading' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Trading Preferences</h3>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Default Portfolio Size ($)
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={settings.trading.defaultPortfolioSize}
                    onChange={(e) => updateSetting('trading', 'defaultPortfolioSize', parseInt(e.target.value))}
                    className="input w-full max-w-xs"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Risk Tolerance
                  </label>
                  <select
                    value={settings.trading.riskTolerance}
                    onChange={(e) => updateSetting('trading', 'riskTolerance', e.target.value)}
                    className="input w-full max-w-xs"
                  >
                    <option value="low">Conservative (Low Risk)</option>
                    <option value="medium">Balanced (Medium Risk)</option>
                    <option value="high">Aggressive (High Risk)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Default Stop Loss (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="0.5"
                    value={settings.trading.stopLossPercent}
                    onChange={(e) => updateSetting('trading', 'stopLossPercent', parseFloat(e.target.value))}
                    className="input w-full max-w-xs"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Auto-Rebalancing
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Automatically rebalance portfolio based on AI recommendations
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.trading.autoRebalance}
                    onChange={(e) => updateSetting('trading', 'autoRebalance', e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="card">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Account Actions</h3>
          <div className="space-y-3">
            <button className="btn btn-secondary">
              Export Data
            </button>
            <button className="btn btn-warning">
              Reset to Defaults
            </button>
            <button className="btn btn-bear">
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;