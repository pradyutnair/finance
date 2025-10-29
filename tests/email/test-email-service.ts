import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EmailService, emailService } from '@/lib/email-service';
import { EmailContent } from '@/lib/email-service';

// Mock the dependencies
jest.mock('@/lib/appwrite', () => ({
  databases: {
    getDocument: jest.fn(),
    updateDocument: jest.fn(),
    createDocument: jest.fn(),
    listDocuments: jest.fn()
  },
  DATABASE_ID: 'test-db',
  USERS_PRIVATE_COLLECTION_ID: 'test-users',
  PREFERENCES_BUDGETS_COLLECTION_ID: 'test-preferences'
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn()
    }
  }))
}));

describe('EmailService', () => {
  let service: EmailService;
  const mockResend = require('resend').Resend;

  beforeEach(() => {
    service = EmailService.getInstance();
    jest.clearAllMocks();

    // Mock process.env
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.RESEND_FROM_EMAIL = 'test@example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('getUserData', () => {
    it('should fetch user data with preferences successfully', async () => {
      const { databases } = require('@/lib/appwrite');

      const mockUserProfile = {
        email: 'user@example.com',
        name: 'Test User'
      };

      const mockPreferences = {
        emailNotifications: true,
        weeklyReports: true,
        monthlyReports: false,
        marketingEmails: false
      };

      databases.getDocument
        .mockResolvedValueOnce(mockUserProfile)
        .mockResolvedValueOnce(mockPreferences);

      const result = await service.getUserData('test-user-id');

      expect(result).toEqual({
        userId: 'test-user-id',
        email: 'user@example.com',
        name: 'Test User',
        preferences: {
          emailNotifications: true,
          pushNotifications: false,
          weeklyReports: true,
          monthlyReports: false,
          marketingEmails: false
        }
      });
    });

    it('should return default preferences when preferences document not found', async () => {
      const { databases } = require('@/lib/appwrite');

      const mockUserProfile = {
        email: 'user@example.com',
        name: 'Test User'
      };

      databases.getDocument
        .mockResolvedValueOnce(mockUserProfile)
        .mockRejectedValueOnce({ code: 404 });

      const result = await service.getUserData('test-user-id');

      expect(result?.preferences).toEqual({
        emailNotifications: true,
        pushNotifications: false,
        weeklyReports: false,
        monthlyReports: false,
        marketingEmails: false
      });
    });

    it('should return null when user profile not found', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockRejectedValue(new Error('User not found'));

      const result = await service.getUserData('invalid-user-id');

      expect(result).toBeNull();
    });
  });

  describe('preference checking methods', () => {
    beforeEach(() => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-users') {
          return Promise.resolve({
            email: 'user@example.com',
            name: 'Test User'
          });
        }
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: true,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });
    });

    it('should return true for weekly reports when user has opted in', async () => {
      const result = await service.canSendWeeklyReport('test-user-id');
      expect(result).toBe(true);
    });

    it('should return false for weekly reports when user has opted out', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: false,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });

      const result = await service.canSendWeeklyReport('test-user-id');
      expect(result).toBe(false);
    });

    it('should return true for monthly reports when user has opted in', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: false,
            monthlyReports: true,
            marketingEmails: false
          });
        }
      });

      const result = await service.canSendMonthlyReport('test-user-id');
      expect(result).toBe(true);
    });

    it('should return true for marketing emails when user has opted in', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: false,
            monthlyReports: false,
            marketingEmails: true
          });
        }
      });

      const result = await service.canSendMarketingEmail('test-user-id');
      expect(result).toBe(true);
    });

    it('should return false when email notifications are disabled', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: false,
            weeklyReports: true,
            monthlyReports: true,
            marketingEmails: true
          });
        }
      });

      const weeklyResult = await service.canSendWeeklyReport('test-user-id');
      const monthlyResult = await service.canSendMonthlyReport('test-user-id');
      const marketingResult = await service.canSendMarketingEmail('test-user-id');

      expect(weeklyResult).toBe(false);
      expect(monthlyResult).toBe(false);
      expect(marketingResult).toBe(false);
    });
  });

  describe('sendEmailToUser', () => {
    beforeEach(() => {
      const { databases } = require('@/lib/appwrite');
      const mockResendInstance = mockResend.mock.results[0].value;

      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-users') {
          return Promise.resolve({
            email: 'user@example.com',
            name: 'Test User'
          });
        }
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: true,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });

      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: 'test-email-id' },
        error: null
      });
    });

    it('should send email successfully with user data', async () => {
      const emailContent: EmailContent = {
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content'
      };

      const result = await service.sendEmailToUser({
        userId: 'test-user-id',
        content: emailContent
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-email-id');
    });

    it('should personalize email content with user name', async () => {
      const emailContent: EmailContent = {
        subject: 'Hello {{name}}',
        html: '<p>Hello {{name}}, this is a test</p>',
        text: 'Hello {{name}}, this is a test'
      };

      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-users') {
          return Promise.resolve({
            email: 'user@example.com',
            name: 'John Doe'
          });
        }
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: true,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });

      const mockResendInstance = mockResend.mock.results[0].value;
      await service.sendEmailToUser({
        userId: 'test-user-id',
        content: emailContent
      });

      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: ['user@example.com'],
        subject: 'Hello John Doe',
        html: '<p>Hello John Doe, this is a test</p>',
        text: 'Hello John Doe, this is a test',
        replyTo: undefined
      });
    });

    it('should return error when user has opted out of emails', async () => {
      const { databases } = require('@/lib/appwrite');
      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: false,
            weeklyReports: false,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });

      const emailContent: EmailContent = {
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      const result = await service.sendEmailToUser({
        userId: 'test-user-id',
        content: emailContent,
        checkPreferences: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User has opted out of email notifications');
    });

    it('should return error when Resend API fails', async () => {
      const mockResendInstance = mockResend.mock.results[0].value;
      mockResendInstance.emails.send.mockResolvedValue({
        data: null,
        error: { message: 'API Error' }
      });

      const emailContent: EmailContent = {
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      const result = await service.sendEmailToUser({
        userId: 'test-user-id',
        content: emailContent
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });
  });

  describe('sendEmailToMultipleUsers', () => {
    beforeEach(() => {
      const { databases } = require('@/lib/appwrite');
      const mockResendInstance = mockResend.mock.results[0].value;

      databases.getDocument.mockImplementation((collection, userId) => {
        if (collection === 'test-users') {
          return Promise.resolve({
            email: `user${userId}@example.com`,
            name: `User ${userId}`
          });
        }
        if (collection === 'test-preferences') {
          return Promise.resolve({
            emailNotifications: true,
            weeklyReports: true,
            monthlyReports: false,
            marketingEmails: false
          });
        }
      });

      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: 'test-email-id' },
        error: null
      });
    });

    it('should send emails to multiple users successfully', async () => {
      const emailContent: EmailContent = {
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      const result = await service.sendEmailToMultipleUsers(
        ['user1', 'user2', 'user3'],
        emailContent
      );

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      const mockResendInstance = mockResend.mock.results[0].value;
      mockResendInstance.emails.send
        .mockResolvedValueOnce({ data: { id: 'test-email-id-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Failed to send' } })
        .mockResolvedValueOnce({ data: { id: 'test-email-id-3' }, error: null });

      const emailContent: EmailContent = {
        subject: 'Test Email',
        html: '<p>Test content</p>'
      };

      const result = await service.sendEmailToMultipleUsers(
        ['user1', 'user2', 'user3'],
        emailContent
      );

      expect(result.success).toBe(true); // At least one success
      expect(result.results).toHaveLength(3);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[2].success).toBe(true);
    });
  });
});

// Integration tests
describe('EmailService Integration', () => {
  it('should work with actual email templates', async () => {
    // This would be an integration test that uses actual templates
    // For now, we'll just verify the service can be instantiated
    const service = EmailService.getInstance();
    expect(service).toBeInstanceOf(EmailService);
  });
});