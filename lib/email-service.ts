import { Resend } from 'resend';
import { databases, DATABASE_ID, USERS_PRIVATE_COLLECTION_ID, PREFERENCES_BUDGETS_COLLECTION_ID } from './appwrite';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailConfig {
  fromEmail?: string;
  replyTo?: string;
}

export interface UserEmailData {
  userId: string;
  email: string;
  name?: string;
  preferences?: {
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    monthlyReports?: boolean;
    weeklyReports?: boolean;
  };
}

export interface EmailContent {
  subject: string;
  html?: string;
  text?: string;
}

export interface SendEmailOptions {
  userId?: string;
  email?: string;
  content: EmailContent;
  config?: EmailConfig;
  checkPreferences?: boolean;
}

export class EmailService {
  private static instance: EmailService;
  private fromEmail: string;

  constructor() {
    this.fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@nexpass.app';
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Fetch user data including email and preferences from Appwrite
   */
  async getUserData(userId: string): Promise<UserEmailData | null> {
    try {
      // Get user profile data
      const userProfile = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      );

      // Get user preferences
      let preferences = null;
      try {
        const prefsData = await databases.getDocument(
          DATABASE_ID,
          PREFERENCES_BUDGETS_COLLECTION_ID,
          userId
        );
        preferences = {
          emailNotifications: prefsData.emailNotifications ?? true,
          pushNotifications: prefsData.pushNotifications ?? true,
          monthlyReports: prefsData.monthlyReports ?? false,
          weeklyReports: prefsData.weeklyReports ?? false,
        };
      } catch (error) {
        console.warn(`Could not fetch preferences for user ${userId}:`, error);
        // Use default preferences if not found
        preferences = {
          emailNotifications: true,
          pushNotifications: true,
          monthlyReports: false,
          weeklyReports: false,
        };
      }

      return {
        userId,
        email: userProfile.email,
        name: userProfile.name || undefined,
        preferences,
      };
    } catch (error) {
      console.error(`Error fetching user data for ${userId}:`, error);
      return null;
    }
  }

  /**
   * Check if user has opted in for email notifications
   */
  private async canSendEmail(userId: string, checkPreferences: boolean = true): Promise<boolean> {
    if (!checkPreferences) {
      return true;
    }

    const userData = await this.getUserData(userId);
    return userData?.preferences?.emailNotifications ?? true;
  }

  /**
   * Send email to a specific user
   */
  async sendEmailToUser(options: SendEmailOptions): Promise<{ success: boolean; error?: string; messageId?: string }> {
    const { userId, email, content, config, checkPreferences = true } = options;

    try {
      let userEmail = email;
      let userName = undefined;

      // If userId is provided, fetch user data and check preferences
      if (userId) {
        if (checkPreferences) {
          const canSend = await this.canSendEmail(userId, checkPreferences);
          if (!canSend) {
            return { success: false, error: 'User has opted out of email notifications' };
          }
        }

        const userData = await this.getUserData(userId);
        if (!userData) {
          return { success: false, error: 'User not found' };
        }

        userEmail = userData.email;
        userName = userData.name;
      }

      if (!userEmail) {
        return { success: false, error: 'No email address provided' };
      }

      // Prepare email content with personalization
      const personalizedContent = this.personalizeEmailContent(content, userName);

      // Send email via Resend
      const { data, error } = await resend.emails.send({
        from: config?.fromEmail || this.fromEmail,
        to: [userEmail],
        subject: personalizedContent.subject,
        html: personalizedContent.html,
        text: personalizedContent.text,
        replyTo: config?.replyTo,
      });

      if (error) {
        console.error('Resend API error:', error);
        return { success: false, error: error.message };
      }

      console.log(`Email sent successfully to ${userEmail}. Message ID: ${data?.id}`);
      return { success: true, messageId: data?.id };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Send email to multiple users
   */
  async sendEmailToMultipleUsers(
    userIds: string[],
    content: EmailContent,
    config?: EmailConfig
  ): Promise<{ success: boolean; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    const results = [];

    for (const userId of userIds) {
      const result = await this.sendEmailToUser({ userId, content, config });
      results.push({ userId, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    return { success: successCount > 0, results };
  }

  /**
   * Send email to all users with email notifications enabled
   */
  async sendBroadcastEmail(
    content: EmailContent,
    config?: EmailConfig
  ): Promise<{ success: boolean; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    try {
      // Note: This would require implementing a method to list all users
      // For now, this is a placeholder for the concept
      console.warn('Broadcast email functionality requires implementing user listing from Appwrite');
      return { success: false, results: [] };
    } catch (error) {
      console.error('Error sending broadcast email:', error);
      return { success: false, results: [] };
    }
  }

  /**
   * Personalize email content with user's name
   */
  private personalizeEmailContent(content: EmailContent, userName?: string): EmailContent {
    if (!userName) {
      return content;
    }

    const personalizedHtml = content.html?.replace(/{{name}}/g, userName) ||
                            content.html?.replace(/Hello,/g, `Hello ${userName},`) ||
                            content.html;

    const personalizedText = content.text?.replace(/{{name}}/g, userName) ||
                            content.text?.replace(/Hello,/g, `Hello ${userName},`) ||
                            content.text;

    return {
      subject: content.subject,
      html: personalizedHtml,
      text: personalizedText,
    };
  }
}

// Export singleton instance
export const emailService = EmailService.getInstance();

// Convenience functions
export async function sendEmailToUser(options: SendEmailOptions) {
  return emailService.sendEmailToUser(options);
}

export async function sendEmailToMultipleUsers(
  userIds: string[],
  content: EmailContent,
  config?: EmailConfig
) {
  return emailService.sendEmailToMultipleUsers(userIds, content, config);
}

// Email templates
export const EmailTemplates = {
  welcome: (userName?: string): EmailContent => ({
    subject: 'Welcome to Nexpass!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Nexpass${userName ? `, ${userName}` : ''}!</h2>
        <p>Thank you for signing up for Nexpass, your personal finance management solution.</p>
        <p>With Nexpass, you can:</p>
        <ul>
          <li>Track your expenses and income</li>
          <li>Set and monitor budgets</li>
          <li>Connect your bank accounts securely</li>
          <li>Get insights into your spending habits</li>
        </ul>
        <p>Get started by <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="color: #2563eb;">visiting your dashboard</a>.</p>
        <p>Best regards,<br>The Nexpass Team</p>
      </div>
    `,
    text: `Welcome to Nexpass${userName ? `, ${userName}` : ''}!

Thank you for signing up for Nexpass, your personal finance management solution.

With Nexpass, you can:
- Track your expenses and income
- Set and monitor budgets
- Connect your bank accounts securely
- Get insights into your spending habits

Get started by visiting your dashboard at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard.

Best regards,
The Nexpass Team`,
  }),

  monthlyReport: (userName?: string, month?: string): EmailContent => ({
    subject: `Your Monthly Financial Report - ${month || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Monthly Financial Report${userName ? `, ${userName}` : ''}</h2>
        <p>Here's your financial summary for ${month || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
        <p>Log in to your <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="color: #2563eb;">dashboard</a> to view detailed insights and track your progress.</p>
        <p>Best regards,<br>The Nexpass Team</p>
      </div>
    `,
    text: `Monthly Financial Report${userName ? `, ${userName}` : ''}

Here's your financial summary for ${month || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.

Log in to your dashboard at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard to view detailed insights and track your progress.

Best regards,
The Nexpass Team`,
  }),

  budgetAlert: (category: string, spent: number, budget: number, userName?: string): EmailContent => ({
    subject: `Budget Alert: ${category} Spending`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Budget Alert${userName ? `, ${userName}` : ''}</h2>
        <p>You've spent ${spent.toFixed(2)} of your ${(budget).toFixed(2)} budget for <strong>${category}</strong>.</p>
        <p>This is ${((spent / budget) * 100).toFixed(1)}% of your allocated budget for this category.</p>
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" style="color: #2563eb;">View your dashboard</a> to see full details and adjust your budget if needed.</p>
        <p>Best regards,<br>The Nexpass Team</p>
      </div>
    `,
    text: `Budget Alert${userName ? `, ${userName}` : ''}

You've spent ${spent.toFixed(2)} of your ${(budget).toFixed(2)} budget for ${category}.

This is ${((spent / budget) * 100).toFixed(1)}% of your allocated budget for this category.

View your dashboard at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard to see full details and adjust your budget if needed.

Best regards,
The Nexpass Team`,
  }),
};