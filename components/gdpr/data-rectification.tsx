"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Edit, 
  Save, 
  X, 
  CheckCircle, 
  AlertTriangle,
  User,
  Mail,
  Shield,
  Database
} from "lucide-react";

interface UserData {
  userId: string;
  name?: string;
  email?: string;
  role: string;
  avatarUrl?: string;
  preferredCurrencies?: string[];
  createdAt: string;
  updatedAt: string;
}

interface DataRectificationProps {
  userId: string;
}

export function DataRectification({ userId }: DataRectificationProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = async () => {
    try {
      const response = await fetch('/api/gdpr/user-data', {
        headers: { Authorization: `Bearer ${await getAuthToken()}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUserData(data.userData);
      } else {
        setMessage({ type: 'error', text: 'Failed to load user data' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load user data' });
    } finally {
      setLoading(false);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    const { account } = await import('@/lib/appwrite');
    const jwt = await account.createJWT();
    return (jwt as any).jwt || (jwt as any).token;
  };

  const startEditing = (field: string, currentValue: string) => {
    setEditing(field);
    setEditValues({ [field]: currentValue || '' });
  };

  const cancelEditing = () => {
    setEditing(null);
    setEditValues({});
  };

  const handleSave = async (field: string) => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/gdpr/rectify-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          field,
          value: editValues[field]
        })
      });

      if (response.ok) {
        setMessage({ type: 'success', text: `${field} updated successfully` });
        setEditing(null);
        setEditValues({});
        await loadUserData(); // Refresh data
      } else {
        setMessage({ type: 'error', text: `Failed to update ${field}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to update ${field}` });
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (field: string, value: string) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'name': return User;
      case 'email': return Mail;
      case 'role': return Shield;
      default: return Database;
    }
  };

  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'name': return 'Full Name';
      case 'email': return 'Email Address';
      case 'role': return 'User Role';
      case 'avatarUrl': return 'Avatar URL';
      case 'preferredCurrencies': return 'Preferred Currencies';
      default: return field;
    }
  };

  const isFieldEditable = (field: string) => {
    // Some fields like userId, createdAt, updatedAt are not editable
    return !['userId', 'createdAt', 'updatedAt', 'role'].includes(field);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading your data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!userData) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              Failed to load your data. Please try again or contact support.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Your Personal Data
          </CardTitle>
          <CardDescription>
            View and correct your personal information. You have the right to rectify any inaccurate data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert className={message.type === 'success' ? 'border-green-200 bg-green-50' : 
                              message.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : 
                              'border-red-200 bg-red-50'}>
              <AlertDescription className={message.type === 'success' ? 'text-green-800' : 
                                            message.type === 'warning' ? 'text-yellow-800' : 
                                            'text-red-800'}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {Object.entries(userData).map(([field, value], index) => {
            const Icon = getFieldIcon(field);
            const label = getFieldLabel(field);
            const isEditable = isFieldEditable(field);
            const isCurrentlyEditing = editing === field;
            const displayValue = Array.isArray(value) ? value.join(', ') : String(value || 'Not set');

            return (
              <div key={field} className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-medium">{label}</Label>
                        {!isEditable && (
                          <Badge variant="outline" className="text-xs">
                            Read-only
                          </Badge>
                        )}
                      </div>
                      {isCurrentlyEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editValues[field] || ''}
                            onChange={(e) => handleValueChange(field, e.target.value)}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            className="max-w-md"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSave(field)}
                              disabled={saving}
                            >
                              <Save className="w-4 h-4 mr-1" />
                              {saving ? 'Saving...' : 'Save'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEditing}
                              disabled={saving}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">
                            {displayValue}
                          </p>
                          {isEditable && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEditing(field, displayValue)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {index < Object.entries(userData).length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Accuracy Information</CardTitle>
          <CardDescription>
            Important information about your data accuracy rights
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-semibold">Right to Rectification</h4>
                <p className="text-sm text-muted-foreground">
                  You can request correction of any inaccurate personal data we hold about you.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold">Verification Required</h4>
                <p className="text-sm text-muted-foreground">
                  Some changes may require verification to ensure data security and accuracy.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold">Data Sources</h4>
                <p className="text-sm text-muted-foreground">
                  Some data comes from your bank connections and cannot be edited directly here.
                  Contact your bank to update account information.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Contact us if you need assistance with your data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-semibold">Data Protection Officer</h4>
              <p className="text-sm text-muted-foreground">dpo@nexpass.com</p>
            </div>
            <div>
              <h4 className="font-semibold">General Support</h4>
              <p className="text-sm text-muted-foreground">support@nexpass.com</p>
            </div>
            <div>
              <h4 className="font-semibold">Response Time</h4>
              <p className="text-sm text-muted-foreground">Within 72 hours for data protection requests</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
