"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Cookie, 
  Settings, 
  Shield, 
  BarChart3, 
  Target,
  CheckCircle,
  X
} from "lucide-react";

interface CookiePreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookieConsentProps {
  onConsentChange?: (preferences: CookiePreferences) => void;
}

export function CookieConsent({ onConsentChange }: CookieConsentProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    analytics: false,
    marketing: false,
    functional: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user has already given consent
    const savedConsent = localStorage.getItem('nexpass-cookie-consent');
    if (!savedConsent) {
      setShowBanner(true);
    } else {
      const parsed = JSON.parse(savedConsent);
      setPreferences(parsed.preferences);
    }
  }, []);

  const handlePreferenceChange = (key: keyof CookiePreferences, value: boolean) => {
    // Essential cookies cannot be disabled
    if (key === 'essential') return;
    
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handleAcceptAll = async () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    
    await saveConsent(allAccepted);
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleAcceptSelected = async () => {
    await saveConsent(preferences);
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleRejectAll = async () => {
    const onlyEssential = {
      essential: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    
    await saveConsent(onlyEssential);
    setShowBanner(false);
    setShowSettings(false);
  };

  const saveConsent = async (consentPreferences: CookiePreferences) => {
    setLoading(true);
    
    try {
      const consentData = {
        preferences: consentPreferences,
        timestamp: new Date().toISOString(),
        version: 1
      };
      
      localStorage.setItem('nexpass-cookie-consent', JSON.stringify(consentData));
      
      // Send to server for audit logging
      try {
        await fetch('/api/gdpr/cookie-consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(consentData)
        });
      } catch (error) {
        console.warn('Failed to log cookie consent to server:', error);
      }
      
      onConsentChange?.(consentPreferences);
      
      // Apply consent preferences
      applyConsentPreferences(consentPreferences);
      
    } catch (error) {
      console.error('Failed to save cookie consent:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyConsentPreferences = (prefs: CookiePreferences) => {
    // Essential cookies are always enabled
    if (prefs.essential) {
      // Enable essential functionality
      console.log('Essential cookies enabled');
    }
    
    // Analytics cookies
    if (prefs.analytics) {
      // Enable analytics tracking
      console.log('Analytics cookies enabled');
      // Example: Initialize Google Analytics, etc.
    } else {
      // Disable analytics tracking
      console.log('Analytics cookies disabled');
    }
    
    // Marketing cookies
    if (prefs.marketing) {
      // Enable marketing tracking
      console.log('Marketing cookies enabled');
    } else {
      // Disable marketing tracking
      console.log('Marketing cookies disabled');
    }
    
    // Functional cookies
    if (prefs.functional) {
      // Enable functional features
      console.log('Functional cookies enabled');
    } else {
      // Disable functional features
      console.log('Functional cookies disabled');
    }
  };

  const cookieTypes = [
    {
      key: 'essential' as keyof CookiePreferences,
      title: 'Essential Cookies',
      description: 'Required for basic website functionality and security',
      icon: Shield,
      required: true,
      examples: ['Authentication', 'Security', 'Session management']
    },
    {
      key: 'analytics' as keyof CookiePreferences,
      title: 'Analytics Cookies',
      description: 'Help us understand how you use our website',
      icon: BarChart3,
      required: false,
      examples: ['Usage statistics', 'Performance monitoring', 'Error tracking']
    },
    {
      key: 'functional' as keyof CookiePreferences,
      title: 'Functional Cookies',
      description: 'Enable enhanced features and personalization',
      icon: Settings,
      required: false,
      examples: ['Preferences', 'Language settings', 'Theme selection']
    },
    {
      key: 'marketing' as keyof CookiePreferences,
      title: 'Marketing Cookies',
      description: 'Used to deliver relevant advertisements',
      icon: Target,
      required: false,
      examples: ['Ad targeting', 'Social media integration', 'Remarketing']
    }
  ];

  if (!showBanner && !showSettings) {
    return null;
  }

  return (
    <>
      {/* Cookie Banner - Beautiful Dialog */}
      <Dialog open={showBanner} onOpenChange={setShowBanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Cookie className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              We use cookies
            </DialogTitle>
            <DialogDescription>
              We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
              You can customize your preferences or accept all cookies.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Button 
              onClick={handleAcceptAll}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Saving...' : 'Accept All'}
            </Button>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowSettings(true)}
                variant="outline"
                disabled={loading}
                className="flex-1"
              >
                Customize
              </Button>
              <Button 
                onClick={handleRejectAll}
                variant="outline"
                disabled={loading}
                className="flex-1"
              >
                Reject All
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cookie Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5" />
              Cookie Preferences
            </DialogTitle>
            <DialogDescription>
              Manage your cookie preferences for this website
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                We respect your privacy. You can change your cookie preferences at any time. 
                Some features may not work if you disable certain cookies.
              </AlertDescription>
            </Alert>

            {cookieTypes.map((type, index) => {
              const Icon = type.icon;
              const isEnabled = preferences[type.key];
              
              return (
                <div key={type.key} className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={type.key} className="font-medium">
                            {type.title}
                          </Label>
                          {type.required && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          <strong>Examples:</strong> {type.examples.join(', ')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={type.key}
                        checked={isEnabled}
                        onCheckedChange={(checked) => handlePreferenceChange(type.key, checked)}
                        disabled={type.disabled}
                      />
                    </div>
                  </div>
                  {index < cookieTypes.length - 1 && <Separator />}
                </div>
              );
            })}

            <div className="flex flex-col gap-2 pt-4">
              <Button 
                onClick={handleAcceptSelected}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Saving...' : 'Save Preferences'}
              </Button>
              <div className="flex gap-2">
                <Button 
                  onClick={handleAcceptAll}
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  Accept All
                </Button>
                <Button 
                  onClick={handleRejectAll}
                  variant="outline"
                  disabled={loading}
                  className="flex-1"
                >
                  Reject All
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
