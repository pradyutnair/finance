"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  Download,
  Trash2,
  Edit,
  Settings,
  AlertTriangle,
  User,
  Mail,
  Calendar,
  Lock,
  BarChart3,
  FileText,
  Check,
  X
} from "lucide-react";
import { CurrencyPreferences } from "@/components/profile-page/currency-preferences";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import DangerZoneDeleteAccount from "@/components/profile-page/danger-zone";
import { toast } from "sonner";
interface UserData {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
  accountStatus: string;
  dataTypes: string[];
  lastExport?: string;
}

interface GDPRStatus {
  consentGiven: boolean;
  dataTypes: string[];
  lastExport?: string;
  accountCreated: string;
  dataRetention: {
    [key: string]: string;
  };
}

export function GDPRDashboard() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [currencyPreferences, setCurrencyPreferences] = useState<string[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
    weeklyReports: false,
    monthlyReports: false,
    aiAnalysisConsent: false,
    aiInsightsConsent: true
  });

  useEffect(() => {
    loadUserData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    try {
      const { account } = await import('@/lib/appwrite');
      const currentUser = await account.get();

      // Get user profile (this will create it if it doesn't exist)
      const { ProfileService } = await import('@/lib/profile-service');
      const profile = await ProfileService.getUserProfile(currentUser.$id);

      const userData: UserData = {
        id: currentUser.$id,
        name: profile?.name || currentUser.name || '',
        email: currentUser.email,
        createdAt: currentUser.$createdAt,
        lastLogin: currentUser.$updatedAt,
        accountStatus: 'Active',
        dataTypes: ['Personal Information', 'Account Data', 'Preferences'],
        lastExport: undefined
      };

      setUserData(userData);
      setEditValues({ name: userData.name, email: userData.email });

      // Load currency preferences
      const savedCurrencies = localStorage.getItem('nexpass-preferred-currencies');
      if (savedCurrencies) {
        setCurrencyPreferences(JSON.parse(savedCurrencies));
      }

      // Load notification preferences (this will return defaults if document doesn't exist)
      try {
        const notificationResponse = await fetch('/api/gdpr/notifications', {
          headers: { Authorization: `Bearer ${await getAuthToken()}` }
        });

        if (notificationResponse.ok) {
          const notificationData = await notificationResponse.json();
          setNotificationPreferences({
            emailNotifications: notificationData.emailNotifications ?? true,
            pushNotifications: notificationData.pushNotifications ?? false,
            marketingEmails: notificationData.marketingEmails ?? false,
            weeklyReports: notificationData.weeklyReports ?? false,
            monthlyReports: notificationData.monthlyReports ?? false,
            aiAnalysisConsent: notificationData.aiAnalysisConsent ?? false,
            aiInsightsConsent: notificationData.aiInsightsConsent ?? false
          });
        } else {
          // If API fails, use default values
          console.warn('Failed to fetch notification preferences, using defaults');
        }
      } catch (notificationError) {
        console.warn('Notification preferences API error, using defaults:', notificationError);
      }

    } catch (error) {
      console.error('Failed to load user data:', error);
      toast.error('Failed to load your data');
    } finally {
      setLoading(false);
    }
  };


  const getAuthToken = async (): Promise<string> => {
    const { account } = await import('@/lib/appwrite');
    const jwt = await account.createJWT();
    return (jwt as any).jwt || (jwt as any).token;
  };

  const handleSaveField = async (field: 'name' | 'email') => {
    if (!userData) return;
    setActionLoading(`edit-${field}`);
    try {
      const { account } = await import('@/lib/appwrite');

      if (field === 'name') {
        // Update name in the profile service (users_private collection)
        const { ProfileService } = await import('@/lib/profile-service');
        await ProfileService.updateName(userData.id, editValues.name);
        await loadUserData();
        setEditingField(null);
        toast.success('Name updated successfully');
      } else if (field === 'email') {
        // Update email through Appwrite account API
        await account.updateEmail(editValues.email);
        await loadUserData();
        setEditingField(null);
        toast.success('Email updated successfully');
      }
    } catch (error: any) {
      console.error(`Failed to update ${field}:`, error);
      toast.error(`Failed to update ${field}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingField(null);
    setEditValues({ name: userData?.name || '', email: userData?.email || '' });
  };

  const handleCurrencyPreferencesUpdate = (currencies: string[]) => {
    setCurrencyPreferences(currencies);
    localStorage.setItem('nexpass-preferred-currencies', JSON.stringify(currencies));
  };

  const handleNotificationPreferenceUpdate = async (key: string, value: boolean) => {
    setNotificationPreferences(prev => ({ ...prev, [key]: value }));
    try {
      const response = await fetch('/api/gdpr/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ [key]: value })
      });
      if (response.ok) {
        toast.success('Preferences updated');
      }
    } catch (error) {
      toast.error('Failed to update preferences');
    }
  };

  const handleDataExport = async (format: 'json' | 'csv') => {
    setActionLoading('export');
    try {
      const response = await fetch('/api/gdpr/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ format })
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nexpass-data-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`Data exported as ${format.toUpperCase()}`);
        await loadUserData();
      } else {
        toast.error('Failed to export data');
      }
    } catch (error) {
      toast.error('Failed to export data');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAccountDeletion = async () => {
    if (!confirm('Are you absolutely sure? This action cannot be undone and will permanently delete all your data.')) return;
    setActionLoading('delete');
    try {
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ 
          confirmDeletion: true,
          reason: 'User requested account deletion via GDPR dashboard'
        })
      });
      if (response.ok) {
        toast.success('Account deletion initiated. Logging out...');
        setTimeout(() => window.location.href = '/login', 3000);
      } else {
        toast.error('Failed to delete account');
      }
    } catch (error) {
      toast.error('Failed to delete account');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10">
        <CardContent className="p-8">
          <div className="text-center text-[#40221a]/70 dark:text-white/70">Loading your data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-12">
          <TabsTrigger value="personal" className="flex items-center gap-2 data-[state=active]:bg-chart-1 data-[state=active]:text-primary-foreground">
            <User className="w-4 h-4" />
            Personal
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2 data-[state=active]:bg-chart-1 data-[state=active]:text-primary-foreground">
            <Settings className="w-4 h-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-chart-1 data-[state=active]:text-primary-foreground">
            <Lock className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
            <CardContent className="space-y-6">
              {/* Name Field */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2 text-[#40221a] dark:text-white">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                <div className="flex items-center gap-2">
                  {editingField === 'name' ? (
                    <>
                      <Input
                        id="name"
                        value={editValues.name}
                        onChange={(e) => setEditValues(prev => ({ ...prev, name: e.target.value }))}
                        className="flex-1 rounded-xl border-[#40221a]/20 dark:border-white/20 focus-visible:ring-[#40221a] dark:focus-visible:ring-white"
                      />
                      <Button
                        size="icon"
                        onClick={() => handleSaveField('name')}
                        disabled={actionLoading === 'edit-name'}
                        className="rounded-xl bg-[#40221a] hover:bg-[#40221a]/90 dark:bg-white dark:text-[#40221a] dark:hover:bg-white/90"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="rounded-xl border-[#40221a]/20 dark:border-white/20 hover:bg-[#40221a]/5 dark:hover:bg-white/5"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 p-3 border rounded-xl bg-[#40221a]/5 dark:bg-white/5 border-[#40221a]/10 dark:border-white/10 text-[#40221a] dark:text-white">
                        {userData?.name || 'Not provided'}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setEditingField('name')}
                        className="rounded-xl border-[#40221a]/20 dark:border-white/20 hover:bg-[#40221a]/5 dark:hover:bg-white/5"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-[#40221a] dark:text-white">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <div className="flex items-center gap-2">
                  {editingField === 'email' ? (
                    <>
                      <Input
                        id="email"
                        type="email"
                        value={editValues.email}
                        onChange={(e) => setEditValues(prev => ({ ...prev, email: e.target.value }))}
                        className="flex-1 rounded-xl border-[#40221a]/20 dark:border-white/20 focus-visible:ring-[#40221a] dark:focus-visible:ring-white"
                      />
                      <Button
                        size="icon"
                        onClick={() => handleSaveField('email')}
                        disabled={actionLoading === 'edit-email'}
                        className="rounded-xl bg-[#40221a] hover:bg-[#40221a]/90 dark:bg-white dark:text-[#40221a] dark:hover:bg-white/90"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={handleCancelEdit}
                        className="rounded-xl border-[#40221a]/20 dark:border-white/20 hover:bg-[#40221a]/5 dark:hover:bg-white/5"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 p-3 border rounded-xl bg-[#40221a]/5 dark:bg-white/5 border-[#40221a]/10 dark:border-white/10 text-[#40221a] dark:text-white">
                        {userData?.email || 'Not provided'}
                      </div>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setEditingField('email')}
                        className="rounded-xl border-[#40221a]/20 dark:border-white/20 hover:bg-[#40221a]/5 dark:hover:bg-white/5"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Read-only fields */}
            <div className="space-y-6 pt-4 text-[#40221a] dark:text-white">
            <div className="grid gap-6 md:grid-cols-2">

                {/* Account Created */}
                <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#40221a]/70 dark:text-white/70 flex-shrink-0" />
                <span className="font-medium">Account Created:</span>
                <span className="text-[#40221a]/80 dark:text-white/80">
                    {userData?.createdAt
                    ? new Date(userData.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        })
                    : 'Unknown'}
                </span>
                </div>

                {/* Account Status */}
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-[#40221a]/70 dark:text-white/70 flex-shrink-0" />
                    <span className="font-medium">Account Status:</span>
                    <span
                        className={`px-2 py-0.5 rounded-md text-sm font-medium ${
                        (userData?.accountStatus || 'Active') === 'Active'
                            ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                            : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                        }`}
                    >
                        {userData?.accountStatus || 'Active'}
                    </span>
                    </div>

                    </div>
                </div>


              {/* Currency Preferences */}
                <CurrencyPreferences
                  preferredCurrencies={currencyPreferences.length > 0 ? currencyPreferences : ["EUR", "USD", "GBP"]}
                  onCurrencyPreferencesUpdate={handleCurrencyPreferencesUpdate}
                />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid gap-6 ">
            {/* Data Export */}
            <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10 shadow-sm hover:shadow-md transition-all duration-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#40221a] dark:text-white">
                  <Download className="w-5 h-5" />
                  Export Your Data
                </CardTitle>
                <CardDescription className="text-[#40221a]/60 dark:text-white/60">
                  Download a copy of all your personal data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                <Button
                    onClick={() => handleDataExport('json')}
                    disabled={actionLoading === 'export'}
                    className="w-full justify-start rounded-xl bg-[#40221a] text-white hover:bg-[#5a2d20] 
                                dark:bg-amber-100 dark:text-[#40221a] dark:hover:bg-amber-200
                                transition-colors duration-200"
                    size="lg"
                    >
                    <FileText className="w-4 h-4 mr-2" />
                    {actionLoading === 'export' ? 'Exporting...' : 'Export as JSON'}
                    </Button>

                    <Button
                    onClick={() => handleDataExport('csv')}
                    disabled={actionLoading === 'export'}
                    variant="outline"
                    className="w-full justify-start rounded-xl border-[#40221a]/30 text-[#40221a] hover:bg-[#40221a]/10 hover:text-[#40221a]
                                dark:border-amber-100/30 dark:text-amber-100 dark:hover:bg-amber-100/10
                                transition-colors duration-200"
                    size="lg"
                    >
                    <FileText className="w-4 h-4 mr-2" />
                    {actionLoading === 'export' ? 'Exporting...' : 'Export as CSV'}
                    </Button>

                </div>
                <p className="text-sm text-[#40221a]/60 dark:text-white/60">
                  The export includes all your financial data, preferences, and account information.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Account Deletion - Danger Zone */}
          <DangerZoneDeleteAccount
            onConfirm={handleAccountDeletion}
            loading={actionLoading === 'delete'}
            userEmail={userData?.email}
            supportEmail="support@nexpass.com"
          />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card className="rounded-3xl border-[#40221a]/10 dark:border-white/10 shadow-sm hover:shadow-md transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#40221a] dark:text-white">
                <Settings className="w-5 h-5" />
                Preferences
              </CardTitle>
              <CardDescription className="text-[#40221a]/60 dark:text-white/60">
                Manage your notification preferences and data processing consent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Email Notifications */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2 text-base font-semibold text-[#40221a] dark:text-white">
                    <Mail className="w-5 h-5" />
                    Email Notifications
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-2xl border-[#40221a]/10 dark:border-white/10 bg-gradient-to-br from-[#40221a]/[0.02] to-transparent dark:from-white/[0.02] hover:border-[#40221a]/20 dark:hover:border-white/20 transition-all duration-200">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-[#40221a] dark:text-white">Essential Notifications</p>
                        <p className="text-xs text-[#40221a]/60 dark:text-white/60">
                          Security alerts and service updates
                        </p>
                      </div>
                      <Switch
                        checked={notificationPreferences.emailNotifications}
                        onCheckedChange={(checked) => handleNotificationPreferenceUpdate('emailNotifications', checked)}
                        disabled={true}
                        className="data-[state=checked]:bg-[#40221a] dark:data-[state=checked]:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-2xl border-[#40221a]/10 dark:border-white/10 hover:border-[#40221a]/20 dark:hover:border-white/20 transition-all duration-200">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-[#40221a] dark:text-white">Marketing Communications</p>
                        <p className="text-xs text-[#40221a]/60 dark:text-white/60">
                          Product updates and promotional content
                        </p>
                      </div>
                      <Switch
                        checked={notificationPreferences.marketingEmails}
                        onCheckedChange={(checked) => handleNotificationPreferenceUpdate('marketingEmails', checked)}
                        className="data-[state=checked]:bg-[#40221a] dark:data-[state=checked]:bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Reports & Analytics */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2 text-base font-semibold text-[#40221a] dark:text-white">
                    <BarChart3 className="w-5 h-5" />
                    Reports & Analytics
                  </Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 border rounded-2xl border-[#40221a]/10 dark:border-white/10 hover:border-[#40221a]/20 dark:hover:border-white/20 transition-all duration-200">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-[#40221a] dark:text-white">Weekly Reports</p>
                        <p className="text-xs text-[#40221a]/60 dark:text-white/60">
                          Weekly spending summaries and insights
                        </p>
                      </div>
                      <Switch
                        checked={notificationPreferences.weeklyReports}
                        onCheckedChange={(checked) => handleNotificationPreferenceUpdate('weeklyReports', checked)}
                        className="data-[state=checked]:bg-[#40221a] dark:data-[state=checked]:bg-white"
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-2xl border-[#40221a]/10 dark:border-white/10 hover:border-[#40221a]/20 dark:hover:border-white/20 transition-all duration-200">
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium text-[#40221a] dark:text-white">Monthly Reports</p>
                        <p className="text-xs text-[#40221a]/60 dark:text-white/60">
                          Monthly financial summaries and trends
                        </p>
                      </div>
                      <Switch
                        checked={notificationPreferences.monthlyReports}
                        onCheckedChange={(checked) => handleNotificationPreferenceUpdate('monthlyReports', checked)}
                        className="data-[state=checked]:bg-[#40221a] dark:data-[state=checked]:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Analysis Consent Section */}
              <div className="border-t border-[#40221a]/10 dark:border-white/10 pt-6">
                <h3 className="text-lg font-semibold text-[#40221a] dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  AI & Data Analysis
                </h3>
                <div className="space-y-4">

                  <div className="flex items-center justify-between p-4 border rounded-2xl border-[#40221a]/10 dark:border-white/10 bg-background">
                    <div className="space-y-1 flex-1">
                      <p className="text-sm font-medium text-[#40221a] dark:text-white">AI Financial Insights</p>
                      <p className="text-xs text-[#40221a]/60 dark:text-white/60">
                        Enable AI-powered insights and recommendations based on your spending patterns
                      </p>
                    </div>
                    <Switch
                      checked={notificationPreferences.aiInsightsConsent}
                      onCheckedChange={(checked) => handleNotificationPreferenceUpdate('aiInsightsConsent', checked)}
                      className="data-[state=checked]:bg-[#40221a] dark:data-[state=checked]:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#40221a]/10 dark:border-white/10 pt-4">
                <p className="text-sm text-[#40221a]/60 dark:text-white/60">
                  <strong>Note:</strong> We only send essential notifications required for account security
                  and service functionality. All AI processing is done securely and your data is never shared with third parties.
                </p>
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}