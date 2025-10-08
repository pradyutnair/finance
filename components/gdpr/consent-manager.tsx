"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Database, BarChart3, Mail, Users, Settings } from "lucide-react";

interface ConsentPreferences {
  dataProcessing: boolean;
  bankAccountLinking: boolean;
  analytics: boolean;
  marketing: boolean;
  dataSharing: boolean;
  aiProcessing: boolean;
}

interface ConsentManagerProps {
  userId: string;
  onConsentUpdate?: (preferences: ConsentPreferences) => void;
}

export function ConsentManager({ userId, onConsentUpdate }: ConsentManagerProps) {
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    dataProcessing: false,
    bankAccountLinking: false,
    analytics: false,
    marketing: false,
    dataSharing: false,
    aiProcessing: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConsentPreferences();
  }, [userId]);

  const loadConsentPreferences = async () => {
    try {
      const response = await fetch('/api/gdpr/consent', {
        headers: { Authorization: `Bearer ${await getAuthToken()}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {
          dataProcessing: false,
          bankAccountLinking: false,
          analytics: false,
          marketing: false,
          dataSharing: false,
          aiProcessing: false,
        });
      }
    } catch (error) {
      console.error('Failed to load consent preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    // This would integrate with your existing auth system
    const { account } = await import('@/lib/appwrite');
    const jwt = await account.createJWT();
    return (jwt as any).jwt || (jwt as any).token;
  };

  const handlePreferenceChange = (key: keyof ConsentPreferences, value: boolean) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/gdpr/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ preferences })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Consent preferences updated successfully' });
        onConsentUpdate?.(preferences);
      } else {
        setMessage({ type: 'error', text: 'Failed to update consent preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update consent preferences' });
    } finally {
      setSaving(false);
    }
  };

  const consentOptions = [
    {
      key: 'dataProcessing' as keyof ConsentPreferences,
      title: 'Essential Data Processing',
      description: 'Process your financial data to provide core banking services',
      icon: Database,
      required: true,
      disabled: true
    },
    {
      key: 'bankAccountLinking' as keyof ConsentPreferences,
      title: 'Bank Account Linking',
      description: 'Connect your bank accounts to sync transactions and balances',
      icon: Shield,
      required: false,
      disabled: false
    },
    {
      key: 'analytics' as keyof ConsentPreferences,
      title: 'Analytics & Insights',
      description: 'Analyze your spending patterns to provide financial insights',
      icon: BarChart3,
      required: false,
      disabled: false
    },
    {
      key: 'aiProcessing' as keyof ConsentPreferences,
      title: 'AI-Powered Features',
      description: 'Use AI to categorize transactions and provide financial advice',
      icon: Settings,
      required: false,
      disabled: false
    },
    {
      key: 'marketing' as keyof ConsentPreferences,
      title: 'Marketing Communications',
      description: 'Send you promotional emails and product updates',
      icon: Mail,
      required: false,
      disabled: false
    },
    {
      key: 'dataSharing' as keyof ConsentPreferences,
      title: 'Data Sharing with Partners',
      description: 'Share anonymized data with financial service partners',
      icon: Users,
      required: false,
      disabled: false
    }
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading consent preferences...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Data Processing Consent
          </CardTitle>
          <CardDescription>
            Manage your consent preferences for how we process your personal data. 
            You can withdraw consent at any time, though some features may become unavailable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {consentOptions.map((option, index) => {
            const Icon = option.icon;
            const isEnabled = preferences[option.key];
            
            return (
              <div key={option.key} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={option.key} className="font-medium">
                          {option.title}
                        </Label>
                        {option.required && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id={option.key}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handlePreferenceChange(option.key, checked)}
                      disabled={option.disabled}
                    />
                  </div>
                </div>
                {index < consentOptions.length - 1 && <Separator />}
              </div>
            );
          })}

          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full"
            >
              {saving ? 'Saving...' : 'Save Consent Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Rights</CardTitle>
          <CardDescription>
            Under GDPR, you have the following rights regarding your personal data:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 text-sm">
            <div>
              <strong>Right to Access:</strong> Request a copy of all your personal data
            </div>
            <div>
              <strong>Right to Rectification:</strong> Correct any inaccurate personal data
            </div>
            <div>
              <strong>Right to Erasure:</strong> Request deletion of your personal data
            </div>
            <div>
              <strong>Right to Data Portability:</strong> Export your data in a machine-readable format
            </div>
            <div>
              <strong>Right to Restrict Processing:</strong> Limit how we process your data
            </div>
            <div>
              <strong>Right to Object:</strong> Object to processing for specific purposes
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
