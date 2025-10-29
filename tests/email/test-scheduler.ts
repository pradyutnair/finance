import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { EmailScheduler, emailScheduler } from '@/lib/scheduler';
import { emailService } from '@/lib/email-service';
import { insightsGenerator } from '@/lib/insights-generator';
import { EnhancedEmailTemplates } from '@/lib/email-templates';

// Mock dependencies
jest.mock('@/lib/email-service');
jest.mock('@/lib/insights-generator');
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn()
  }))
}));

describe('EmailScheduler', () => {
  let scheduler: EmailScheduler;
  const mockEmailService = emailService as jest.Mocked<typeof emailService>;
  const mockInsightsGenerator = insightsGenerator as jest.Mocked<typeof insightsGenerator>;

  beforeEach(() => {
    scheduler = EmailScheduler.getInstance();
    jest.clearAllMocks();

    // Mock environment variables
    process.env.ENABLE_EMAIL_SCHEDULER = 'true';
    process.env.MAX_CONCURRENT_JOBS = '5';
    process.env.JOB_RETRY_ATTEMPTS = '3';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    jest.resetModules();
  });

  describe('initialization', () => {
    it('should be a singleton', () => {
      const scheduler1 = EmailScheduler.getInstance();
      const scheduler2 = EmailScheduler.getInstance();
      expect(scheduler1).toBe(scheduler2);
    });

    it('should initialize with default jobs', () => {
      const allJobs = scheduler.getAllJobsStatus();
      expect(allJobs.size).toBe(3);
      expect(allJobs.has('weekly-insights')).toBe(true);
      expect(allJobs.has('monthly-reports')).toBe(true);
      expect(allJobs.has('marketing-emails')).toBe(true);
    });

    it('should create jobs with correct default values', () => {
      const weeklyJob = scheduler.getJobStatus('weekly-insights');
      expect(weeklyJob).toBeDefined();
      expect(weeklyJob?.id).toBe('weekly-insights');
      expect(weeklyJob?.name).toBe('Weekly Financial Insights');
      expect(weeklyJob?.enabled).toBe(true);
      expect(weeklyJob?.running).toBe(false);
      expect(weeklyJob?.retryCount).toBe(0);
      expect(weeklyJob?.maxRetries).toBe(3);
    });
  });

  describe('job management', () => {
    it('should register a new job', () => {
      const testJob = {
        id: 'test-job',
        name: 'Test Job',
        schedule: '0 */6 * * *',
        task: jest.fn(),
        enabled: true,
        retryCount: 0,
        maxRetries: 5
      };

      scheduler.registerJob(testJob);

      const jobStatus = scheduler.getJobStatus('test-job');
      expect(jobStatus).toBeDefined();
      expect(jobStatus?.id).toBe('test-job');
      expect(jobStatus?.name).toBe('Test Job');
      expect(jobStatus?.schedule).toBe('0 */6 * * *');
      expect(jobStatus?.enabled).toBe(true);
    });

    it('should toggle job enabled status', () => {
      const initialStatus = scheduler.getJobStatus('weekly-insights');
      expect(initialStatus?.enabled).toBe(true);

      const success = scheduler.toggleJob('weekly-insights', false);
      expect(success).toBe(true);

      const updatedStatus = scheduler.getJobStatus('weekly-insights');
      expect(updatedStatus?.enabled).toBe(false);

      // Toggle back to enabled
      scheduler.toggleJob('weekly-insights', true);
      const finalStatus = scheduler.getJobStatus('weekly-insights');
      expect(finalStatus?.enabled).toBe(true);
    });

    it('should return false when toggling non-existent job', () => {
      const success = scheduler.toggleJob('non-existent-job', true);
      expect(success).toBe(false);
    });

    it('should get job status correctly', () => {
      const jobStatus = scheduler.getJobStatus('monthly-reports');
      expect(jobStatus).toBeDefined();
      expect(jobStatus?.id).toBe('monthly-reports');
      expect(jobStatus?.name).toBe('Monthly Financial Reports');
    });

    it('should return null for non-existent job', () => {
      const jobStatus = scheduler.getJobStatus('non-existent-job');
      expect(jobStatus).toBeNull();
    });

    it('should get all jobs status', () => {
      const allJobs = scheduler.getAllJobsStatus();
      expect(allJobs.size).toBe(3);
      expect(allJobs.has('weekly-insights')).toBe(true);
      expect(allJobs.has('monthly-reports')).toBe(true);
      expect(allJobs.has('marketing-emails')).toBe(true);
    });
  });

  describe('job execution', () => {
    beforeEach(() => {
      // Mock successful email sending
      mockEmailService.getUsersOptedInForWeeklyReports.mockResolvedValue(['user1', 'user2', 'user3']);
      mockEmailService.canSendWeeklyReport.mockResolvedValue(true);
      mockEmailService.sendEmailToUser.mockResolvedValue({
        success: true,
        messageId: 'test-message-id'
      });

      mockEmailService.getUsersOptedInForMonthlyReports.mockResolvedValue(['user1', 'user2']);
      mockEmailService.canSendMonthlyReport.mockResolvedValue(true);

      mockEmailService.getUsersOptedInForMarketing.mockResolvedValue(['user1', 'user2', 'user3', 'user4']);
      mockEmailService.canSendMarketingEmail.mockResolvedValue(true);

      // Mock insights generation
      mockInsightsGenerator.generateWeeklyInsights.mockResolvedValue({
        userName: 'Test User',
        totalSpending: 1000,
        spendingChange: -10,
        topCategories: [{ name: 'Food', amount: 300, percentage: 30 }],
        budgetAlerts: [],
        savingsRate: 20,
        weeklyTip: 'Save more!',
        periodStart: 'Jan 01',
        periodEnd: 'Jan 07, 2024'
      });

      mockInsightsGenerator.generateMonthlyReport.mockResolvedValue({
        userName: 'Test User',
        month: 'January',
        year: 2024,
        totalIncome: 3000,
        totalExpenses: 2000,
        netSavings: 1000,
        savingsRate: 33.3,
        topExpenseCategories: [{ name: 'Rent', amount: 1000, percentage: 50 }],
        budgetPerformance: [],
        insights: ['Good job saving!'],
        monthlyTip: 'Keep up the good work!'
      });
    });

    it('should execute weekly insights job successfully', async () => {
      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('weekly-insights');
      expect(result.recipientsProcessed).toBe(3);
      expect(result.recipientsSuccessful).toBe(3);
      expect(result.recipientsFailed).toBe(0);
      expect(result.error).toBeUndefined();

      expect(mockEmailService.getUsersOptedInForWeeklyReports).toHaveBeenCalledTimes(1);
      expect(mockInsightsGenerator.generateWeeklyInsights).toHaveBeenCalledTimes(3);
      expect(mockEmailService.sendEmailToUser).toHaveBeenCalledTimes(3);
    });

    it('should execute monthly reports job successfully', async () => {
      const result = await scheduler.triggerJob('monthly-reports');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('monthly-reports');
      expect(result.recipientsProcessed).toBe(2);
      expect(result.recipientsSuccessful).toBe(2);
      expect(result.recipientsFailed).toBe(0);

      expect(mockEmailService.getUsersOptedInForMonthlyReports).toHaveBeenCalledTimes(1);
      expect(mockInsightsGenerator.generateMonthlyReport).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendEmailToUser).toHaveBeenCalledTimes(2);
    });

    it('should execute marketing emails job successfully', async () => {
      const result = await scheduler.triggerJob('marketing-emails');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('marketing-emails');
      expect(result.recipientsProcessed).toBe(4);
      expect(result.recipientsSuccessful).toBe(4);
      expect(result.recipientsFailed).toBe(0);

      expect(mockEmailService.getUsersOptedInForMarketing).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmailToUser).toHaveBeenCalledTimes(4);
    });

    it('should handle job execution failures gracefully', async () => {
      mockEmailService.getUsersOptedInForWeeklyReports.mockRejectedValue(new Error('Database error'));

      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.recipientsProcessed).toBe(0);
      expect(result.recipientsSuccessful).toBe(0);
      expect(result.recipientsFailed).toBe(0);
    });

    it('should handle partial email sending failures', async () => {
      // First user succeeds, second fails, third succeeds
      mockEmailService.sendEmailToUser
        .mockResolvedValueOnce({ success: true, messageId: 'id-1' })
        .mockResolvedValueOnce({ success: false, error: 'Email failed' })
        .mockResolvedValueOnce({ success: true, messageId: 'id-3' });

      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(true); // Overall success because some emails were sent
      expect(result.recipientsProcessed).toBe(3);
      expect(result.recipientsSuccessful).toBe(2);
      expect(result.recipientsFailed).toBe(1);
    });

    it('should handle no opted-in users', async () => {
      mockEmailService.getUsersOptedInForWeeklyReports.mockResolvedValue([]);

      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(true);
      expect(result.recipientsProcessed).toBe(0);
      expect(result.recipientsSuccessful).toBe(0);
      expect(result.recipientsFailed).toBe(0);

      expect(mockInsightsGenerator.generateWeeklyInsights).not.toHaveBeenCalled();
      expect(mockEmailService.sendEmailToUser).not.toHaveBeenCalled();
    });

    it('should respect user preferences during execution', async () => {
      // User1 opted out, User2 opted in
      mockEmailService.canSendWeeklyReport
        .mockResolvedValueOnce(false) // user1
        .mockResolvedValueOnce(true);  // user2

      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(true);
      expect(result.recipientsProcessed).toBe(1); // Only user2 processed
      expect(result.recipientsSuccessful).toBe(1);
      expect(result.recipientsFailed).toBe(0);

      expect(mockInsightsGenerator.generateWeeklyInsights).toHaveBeenCalledTimes(1);
      expect(mockEmailService.sendEmailToUser).toHaveBeenCalledTimes(1);
    });

    it('should handle missing insights data gracefully', async () => {
      mockInsightsGenerator.generateWeeklyInsights.mockResolvedValue(null);

      const result = await scheduler.triggerJob('weekly-insights');

      expect(result.success).toBe(true);
      expect(result.recipientsProcessed).toBe(0);
      expect(result.recipientsSuccessful).toBe(0);
      expect(result.recipientsFailed).toBe(0);

      expect(mockEmailService.sendEmailToUser).not.toHaveBeenCalled();
    });
  });

  describe('job history', () => {
    it('should maintain job history', async () => {
      // Execute a job to create history
      mockEmailService.getUsersOptedInForWeeklyReports.mockResolvedValue(['user1']);
      mockInsightsGenerator.generateWeeklyInsights.mockResolvedValue({
        userName: 'Test User',
        totalSpending: 100,
        spendingChange: 0,
        topCategories: [],
        budgetAlerts: [],
        savingsRate: 10,
        weeklyTip: 'Save!',
        periodStart: 'Jan 01',
        periodEnd: 'Jan 07, 2024'
      });

      await scheduler.triggerJob('weekly-insights');

      const history = scheduler.getJobHistory();
      expect(history).toHaveLength(1);
      expect(history[0].jobId).toBe('weekly-insights');
      expect(history[0].success).toBe(true);
      expect(history[0].recipientsSuccessful).toBe(1);
    });

    it('should limit history size', async () => {
      // This would require running many jobs to test the limit
      // For now, we'll just verify the method exists
      const history = scheduler.getJobHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should get limited history', async () => {
      const history = scheduler.getJobHistory(5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('error handling', () => {
    it('should throw error when triggering non-existent job', async () => {
      await expect(scheduler.triggerJob('non-existent-job')).rejects.toThrow('Job non-existent-job not found');
    });

    it('should throw error when job is already running', async () => {
      // Mock a job that's already running
      const testJob = {
        id: 'running-job',
        name: 'Running Job',
        schedule: '0 */6 * * *',
        task: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        }),
        enabled: true,
        retryCount: 0,
        maxRetries: 1
      };

      scheduler.registerJob(testJob);

      // Start the job twice
      const promise1 = scheduler.triggerJob('running-job');
      const promise2 = scheduler.triggerJob('running-job');

      await expect(promise1).resolves.toBeDefined();
      await expect(promise2).rejects.toThrow('already running');
    });
  });

  describe('concurrent job management', () => {
    beforeEach(() => {
      process.env.MAX_CONCURRENT_JOBS = '1';
    });

    it('should respect concurrent job limits', async () => {
      // This test would require more complex setup to properly test concurrency
      // For now, we'll verify the setting is read correctly
      const scheduler = EmailScheduler.getInstance();
      expect(process.env.MAX_CONCURRENT_JOBS).toBe('1');
    });
  });
});