import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Database, Users, Mail, Settings, AlertTriangle } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground text-lg">
            How we collect, use, and protect your personal data
          </p>
          <Badge variant="outline" className="text-sm">
            Last updated: {new Date().toLocaleDateString()}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Data Controller Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <strong>Company:</strong> Nexpass Financial Services
            </div>
            <div>
              <strong>Contact:</strong> privacy@nexpass.com
            </div>
            <div>
              <strong>Data Protection Officer:</strong> dpo@nexpass.com
            </div>
            <div>
              <strong>Supervisory Authority:</strong> [Your local data protection authority]
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Personal Data We Collect
            </CardTitle>
            <CardDescription>
              We only collect data necessary to provide our financial services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Identity Data</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Name and email address (for account creation)</li>
                <li>User preferences and settings</li>
                <li>Authentication credentials (encrypted)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Financial Data</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>Bank account information (IBAN, account names)</li>
                <li>Transaction history and details</li>
                <li>Account balances and financial metrics</li>
                <li>Budget and goal settings</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Technical Data</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li>IP address and device information</li>
                <li>Usage analytics (with consent)</li>
                <li>Error logs and performance data</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              How We Use Your Data
            </CardTitle>
            <CardDescription>
              Legal basis and purposes for data processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-green-700 mb-2">Essential Services (Legitimate Interest)</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Providing financial dashboard and insights</li>
                  <li>Bank account synchronization</li>
                  <li>Transaction categorization and analysis</li>
                  <li>Security and fraud prevention</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-blue-700 mb-2">With Your Consent</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Analytics and usage insights</li>
                  <li>Marketing communications</li>
                  <li>AI-powered financial advice</li>
                  <li>Data sharing with partners</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-orange-700 mb-2">Legal Compliance</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Financial record keeping (7 years)</li>
                  <li>Anti-money laundering requirements</li>
                  <li>Tax reporting obligations</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Data Sharing and Third Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">We share data with:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                <li><strong>GoCardless:</strong> For bank account data access (PSD2 compliant)</li>
                <li><strong>Google Cloud Platform:</strong> For secure data storage and encryption</li>
                <li><strong>Appwrite:</strong> For authentication and user management</li>
                <li><strong>MongoDB Atlas:</strong> For encrypted data storage</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Important:</h4>
                  <p className="text-sm text-yellow-700">
                    We never sell your personal data. All third-party services are GDPR compliant 
                    and bound by strict data processing agreements.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your Rights Under GDPR</CardTitle>
            <CardDescription>
              You have full control over your personal data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Access</h4>
                  <p className="text-sm text-muted-foreground">
                    Request a copy of all your personal data we hold
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Rectification</h4>
                  <p className="text-sm text-muted-foreground">
                    Correct any inaccurate or incomplete personal data
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Erasure</h4>
                  <p className="text-sm text-muted-foreground">
                    Request deletion of your personal data (with some exceptions)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">4</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Data Portability</h4>
                  <p className="text-sm text-muted-foreground">
                    Export your data in a machine-readable format
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">5</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Restrict Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Limit how we process your data in certain circumstances
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">6</span>
                </div>
                <div>
                  <h4 className="font-semibold">Right to Object</h4>
                  <p className="text-sm text-muted-foreground">
                    Object to processing for specific purposes like marketing
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-semibold">End-to-End Encryption</h4>
                  <p className="text-sm text-muted-foreground">
                    All sensitive financial data is encrypted using GCP KMS
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-semibold">Secure Storage</h4>
                  <p className="text-sm text-muted-foreground">
                    Data stored in encrypted databases with access controls
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-semibold">Access Controls</h4>
                  <p className="text-sm text-muted-foreground">
                    Row-level security ensures users only access their own data
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Retention Periods:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Financial Records:</strong> 7 years (legal requirement)</li>
                  <li><strong>User Account Data:</strong> Until account deletion</li>
                  <li><strong>Analytics Data:</strong> 2 years (with consent)</li>
                  <li><strong>Marketing Data:</strong> Until consent withdrawn</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">Automatic Cleanup</h4>
                <p className="text-sm text-blue-700">
                  We automatically delete data that exceeds retention periods, 
                  except where legal obligations require longer storage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Data Protection Officer</h4>
                <p className="text-sm text-muted-foreground">
                  Email: dpo@nexpass.com<br />
                  Response time: Within 72 hours
                </p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Supervisory Authority</h4>
                <p className="text-sm text-muted-foreground">
                  You have the right to lodge a complaint with your local data protection authority 
                  if you believe we have not handled your data correctly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>
            This privacy policy is effective as of {new Date().toLocaleDateString()} and will be updated 
            as our practices change. We will notify you of any material changes.
          </p>
        </div>
      </div>
    </div>
  );
}
