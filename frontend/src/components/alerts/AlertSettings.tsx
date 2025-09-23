import React, { useState, useEffect } from 'react';
import { Bell, Volume2, Mail, Monitor, Plus, Trash2, Edit3 } from 'lucide-react';
import { alertService, AlertSubscription, AlertPreferences } from '../../services/alertService';
import { useUIStore } from '../../stores/uiStore';

interface AlertSettingsProps {
  className?: string;
}

export const AlertSettings: React.FC<AlertSettingsProps> = ({ className = '' }) => {
  const { showNotification } = useUIStore();
  const [preferences, setPreferences] = useState<AlertPreferences>(alertService.getPreferences());
  const [subscriptions, setSubscriptions] = useState<AlertSubscription[]>(alertService.getSubscriptions());
  const [isConnected, setIsConnected] = useState(alertService.isConnected());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSubscription, setNewSubscription] = useState({
    symbol: '',
    alertTypes: [] as ('regime_change' | 'anomaly' | 'volatility_spike')[],
    minSeverity: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  });

  useEffect(() => {
    // Listen for connection changes
    const unsubscribe = alertService.onConnectionChange(setIsConnected);
    return unsubscribe;
  }, []);

  const handlePreferenceChange = (key: keyof AlertPreferences, value: any) => {
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);
    alertService.updatePreferences(updatedPreferences);
  };

  const handleAddSubscription = async () => {
    if (!newSubscription.symbol || newSubscription.alertTypes.length === 0) {
      showNotification({
        type: 'error',
        message: 'Please fill in all fields',
        duration: 3000
      });
      return;
    }

    try {
      const subscription = await alertService.addSubscription({
        symbol: newSubscription.symbol.toUpperCase(),
        alertTypes: newSubscription.alertTypes,
        minSeverity: newSubscription.minSeverity,
        enabled: true
      });

      setSubscriptions([...subscriptions, subscription]);
      setNewSubscription({
        symbol: '',
        alertTypes: [],
        minSeverity: 'medium'
      });
      setShowAddForm(false);

      showNotification({
        type: 'success',
        message: `Alert subscription added for ${subscription.symbol}`,
        duration: 3000
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to add subscription',
        duration: 3000
      });
    }
  };

  const handleRemoveSubscription = async (subscriptionId: string) => {
    try {
      await alertService.removeSubscription(subscriptionId);
      setSubscriptions(subscriptions.filter(sub => sub.id !== subscriptionId));

      showNotification({
        type: 'success',
        message: 'Subscription removed',
        duration: 3000
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to remove subscription',
        duration: 3000
      });
    }
  };

  const handleToggleSubscription = async (subscriptionId: string, enabled: boolean) => {
    try {
      const updatedSubscription = await alertService.updateSubscription(subscriptionId, { enabled });
      setSubscriptions(subscriptions.map(sub =>
        sub.id === subscriptionId ? updatedSubscription : sub
      ));

      showNotification({
        type: 'success',
        message: `Subscription ${enabled ? 'enabled' : 'disabled'}`,
        duration: 3000
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to update subscription',
        duration: 3000
      });
    }
  };

  const testAlert = async () => {
    try {
      await alertService.testAlert('AAPL', 'regime_change', 'medium');
      showNotification({
        type: 'info',
        message: 'Test alert sent',
        duration: 3000
      });
    } catch (error) {
      showNotification({
        type: 'error',
        message: 'Failed to send test alert',
        duration: 3000
      });
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Connection Status */}
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Alert Service: {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={testAlert}
            className="px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-800 rounded"
          >
            Test Alert
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Notification Preferences
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.enableSound}
                onChange={(e) => handlePreferenceChange('enableSound', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Volume2 className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Sound notifications</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.enablePush}
                onChange={(e) => handlePreferenceChange('enablePush', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Monitor className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Browser notifications</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.enableEmail}
                onChange={(e) => handlePreferenceChange('enableEmail', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Mail className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Email notifications</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={preferences.autoAcknowledge}
                onChange={(e) => handlePreferenceChange('autoAcknowledge', e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Bell className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Auto-acknowledge alerts</span>
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sound Volume
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={preferences.soundVolume}
                onChange={(e) => handlePreferenceChange('soundVolume', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="text-xs text-gray-500 mt-1">
                {Math.round(preferences.soundVolume * 100)}%
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Displayed Alerts
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={preferences.maxDisplayed}
                onChange={(e) => handlePreferenceChange('maxDisplayed', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Alert Subscriptions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Alert Subscriptions
          </h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-md"
          >
            <Plus className="h-4 w-4" />
            <span>Add Subscription</span>
          </button>
        </div>

        {/* Add Subscription Form */}
        {showAddForm && (
          <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Stock Symbol
                </label>
                <input
                  type="text"
                  value={newSubscription.symbol}
                  onChange={(e) => setNewSubscription({ ...newSubscription, symbol: e.target.value.toUpperCase() })}
                  placeholder="e.g., AAPL"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alert Types
                </label>
                <div className="space-y-2">
                  {['regime_change', 'anomaly', 'volatility_spike'].map(type => (
                    <label key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={newSubscription.alertTypes.includes(type as any)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewSubscription({
                              ...newSubscription,
                              alertTypes: [...newSubscription.alertTypes, type as any]
                            });
                          } else {
                            setNewSubscription({
                              ...newSubscription,
                              alertTypes: newSubscription.alertTypes.filter(t => t !== type)
                            });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minimum Severity
                </label>
                <select
                  value={newSubscription.minSeverity}
                  onChange={(e) => setNewSubscription({ ...newSubscription, minSeverity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={handleAddSubscription}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                >
                  Add Subscription
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Subscription List */}
        <div className="space-y-2">
          {subscriptions.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No alert subscriptions configured
              </p>
            </div>
          ) : (
            subscriptions.map((subscription) => (
              <div key={subscription.id} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={subscription.enabled}
                    onChange={(e) => handleToggleSubscription(subscription.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {subscription.symbol}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {subscription.alertTypes.join(', ')} • Min: {subscription.minSeverity}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveSubscription(subscription.id)}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  aria-label={`Remove subscription for ${subscription.symbol}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AlertSettings;