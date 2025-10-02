import { Metadata } from 'next'

// Force dynamic rendering for authentication-protected routes
export const dynamic = 'force-dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Settings, User, Bell, Shield, Key, Palette, Database } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account settings, preferences, and trading configuration.',
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your account settings, preferences, and trading configuration.
        </p>
      </div>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Account Settings</CardTitle>
          </div>
          <CardDescription>
            Manage your profile and account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Display Name</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">Trading User</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">user@example.com</span>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Account Status</label>
            <div className="mt-1">
              <Badge className="bg-green-600">Active</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Configure how you receive alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Price Alerts</div>
              <div className="text-sm text-muted-foreground">Get notified when stock prices hit your targets</div>
            </div>
            <Badge variant="outline">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">AI Predictions</div>
              <div className="text-sm text-muted-foreground">Receive AI-generated trading signals</div>
            </div>
            <Badge variant="outline">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Market News</div>
              <div className="text-sm text-muted-foreground">Daily market updates and news</div>
            </div>
            <Badge variant="outline">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Trade Confirmations</div>
              <div className="text-sm text-muted-foreground">Email confirmation for executed trades</div>
            </div>
            <Badge variant="outline">Enabled</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trading Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>Trading Configuration</CardTitle>
          </div>
          <CardDescription>
            Configure your trading preferences and risk management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Default Order Type</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">Market Order</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Risk Tolerance</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">Moderate</span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Stop Loss Default</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">5%</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Take Profit Default</label>
              <div className="mt-1 p-2 border rounded-md bg-muted">
                <span className="text-sm">15%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>API Keys</CardTitle>
          </div>
          <CardDescription>
            Manage your API keys for external integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Alpha Vantage API</div>
              <div className="text-sm text-muted-foreground">Market data provider</div>
            </div>
            <Badge className="bg-green-600">Connected</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Trading API</div>
              <div className="text-sm text-muted-foreground">For automated trading</div>
            </div>
            <Badge variant="outline">Not Configured</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>Appearance</CardTitle>
          </div>
          <CardDescription>
            Customize the look and feel of your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Theme</label>
            <div className="mt-1 p-2 border rounded-md bg-muted">
              <span className="text-sm">Dark Mode</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Compact View</div>
              <div className="text-sm text-muted-foreground">Show more data in less space</div>
            </div>
            <Badge variant="outline">Disabled</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Security</CardTitle>
          </div>
          <CardDescription>
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Two-Factor Authentication</div>
              <div className="text-sm text-muted-foreground">Add an extra layer of security</div>
            </div>
            <Badge variant="outline">Disabled</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Session Timeout</div>
              <div className="text-sm text-muted-foreground">Auto logout after inactivity</div>
            </div>
            <div className="text-sm font-medium">30 minutes</div>
          </div>
          <div>
            <div className="font-medium mb-2">Last Login</div>
            <div className="text-sm text-muted-foreground">Today at 10:23 AM from 192.168.1.1</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
