import * as cron from 'node-cron';
import { emailService } from './email-service';
import { insightsGenerator } from './insights-generator';
import { EnhancedEmailTemplates, MarketingEmailData } from './email-templates';

export interface ScheduledJob {
  id: string;
  name: string;
  schedule: string; // cron pattern
  task: () => Promise<void>;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  running: boolean;
  retryCount: number;
  maxRetries: number;
}

export interface JobResult {
  jobId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  error?: string;
  recipientsProcessed: number;
  recipientsSuccessful: number;
  recipientsFailed: number;
}

export class EmailScheduler {
  private static instance: EmailScheduler;
  private jobs: Map<string, ScheduledJob> = new Map();
  private jobHistory: JobResult[] = [];
  private maxHistorySize = 100;
  private maxConcurrentJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '5');
  private runningJobs = 0;

  constructor() {
    // Initialize scheduled jobs
    this.initializeJobs();
  }

  public static getInstance(): EmailScheduler {
    if (!EmailScheduler.instance) {
      EmailScheduler.instance = new EmailScheduler();
    }
    return EmailScheduler.instance;
  }

  /**
   * Initialize all scheduled email jobs
   */
  private initializeJobs(): void {
    // Weekly insights job - Sundays at 9 AM
    this.registerJob({
      id: 'weekly-insights',
      name: 'Weekly Financial Insights',
      schedule: process.env.WEEKLY_INSIGHTS_CRON || '0 9 * * 0', // Sunday 9 AM
      task: this.executeWeeklyInsights.bind(this),
      enabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true',
      retryCount: 0,
      maxRetries: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3')
    });

    // Monthly reports job - 1st of each month at 10 AM
    this.registerJob({
      id: 'monthly-reports',
      name: 'Monthly Financial Reports',
      schedule: process.env.MONTHLY_REPORTS_CRON || '0 10 1 * *', // 1st of month 10 AM
      task: this.executeMonthlyReports.bind(this),
      enabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true',
      retryCount: 0,
      maxRetries: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3')
    });

    // Marketing emails job - Every Tuesday at 2 PM
    this.registerJob({
      id: 'marketing-emails',
      name: 'Marketing Campaign Emails',
      schedule: process.env.MARKETING_EMAILS_CRON || '0 14 * * 2', // Tuesday 2 PM
      task: this.executeMarketingEmails.bind(this),
      enabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true',
      retryCount: 0,
      maxRetries: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3')
    });

    console.log(`Email scheduler initialized with ${this.jobs.size} jobs`);
  }

  /**
   * Register a new scheduled job
   */
  public registerJob(job: Omit<ScheduledJob, 'nextRun' | 'running'>): void {
    const fullJob: ScheduledJob = {
      ...job,
      nextRun: this.getNextRunDate(job.schedule),
      running: false
    };

    this.jobs.set(job.id, fullJob);

    if (job.enabled) {
      this.scheduleJob(fullJob);
    }
  }

  /**
   * Schedule a job using node-cron
   */
  private scheduleJob(job: ScheduledJob): void {
    if (!job.enabled) return;

    const task = cron.schedule(job.schedule, async () => {
      if (this.runningJobs >= this.maxConcurrentJobs) {
        console.log(`Skipping job ${job.id} - too many concurrent jobs running`);
        return;
      }

      await this.executeJob(job.id);
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log(`Scheduled job "${job.name}" (${job.id}) with pattern: ${job.schedule}`);
  }

  /**
   * Execute a specific job
   */
  public async executeJob(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.running) {
      throw new Error(`Job ${jobId} is already running`);
    }

    const startTime = new Date();
    job.running = true;
    this.runningJobs++;

    const result: JobResult = {
      jobId,
      success: false,
      startTime,
      endTime: new Date(),
      recipientsProcessed: 0,
      recipientsSuccessful: 0,
      recipientsFailed: 0
    };

    try {
      console.log(`Executing job: ${job.name} (${jobId})`);
      job.lastRun = startTime;

      await job.task();

      result.success = true;
      result.endTime = new Date();
      job.retryCount = 0;
      job.nextRun = this.getNextRunDate(job.schedule);

      console.log(`Job ${jobId} completed successfully in ${result.endTime.getTime() - startTime.getTime()}ms`);

    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Unknown error';
      result.endTime = new Date();
      job.retryCount++;

      console.error(`Job ${jobId} failed (attempt ${job.retryCount}/${job.maxRetries}):`, error);

      // Retry logic
      if (job.retryCount < job.maxRetries) {
        console.log(`Retrying job ${jobId} in 5 minutes...`);
        setTimeout(async () => {
          try {
            await this.executeJob(jobId);
          } catch (retryError) {
            console.error(`Retry failed for job ${jobId}:`, retryError);
          }
        }, 5 * 60 * 1000); // 5 minutes
      } else {
        console.error(`Job ${jobId} failed after ${job.maxRetries} attempts. Giving up.`);
        job.nextRun = this.getNextRunDate(job.schedule);
      }
    } finally {
      job.running = false;
      this.runningJobs--;
      this.addToHistory(result);
    }

    return result;
  }

  /**
   * Execute weekly insights job
   */
  private async executeWeeklyInsights(): Promise<void> {
    console.log('Starting weekly insights job...');

    // Get users who have opted in for weekly reports
    const optedInUsers = await emailService.getUsersOptedInForWeeklyReports();

    if (optedInUsers.length === 0) {
      console.log('No users opted in for weekly reports');
      return;
    }

    console.log(`Processing weekly insights for ${optedInUsers.length} users`);

    let successCount = 0;
    let failureCount = 0;

    for (const userId of optedInUsers) {
      try {
        // Check user preferences again (in case they changed since last run)
        const canSend = await emailService.canSendWeeklyReport(userId);
        if (!canSend) {
          continue;
        }

        // Generate weekly insights
        const insights = await insightsGenerator.generateWeeklyInsights(userId);
        if (!insights) {
          console.log(`No insights data available for user ${userId}`);
          continue;
        }

        // Send email
        const emailContent = EnhancedEmailTemplates.weeklyInsights(insights);
        const result = await emailService.sendEmailToUser({
          userId,
          content: emailContent,
          checkPreferences: false // Already checked
        });

        if (result.success) {
          successCount++;
          console.log(`Weekly insights sent successfully to user ${userId}`);
        } else {
          failureCount++;
          console.error(`Failed to send weekly insights to user ${userId}: ${result.error}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`Error processing weekly insights for user ${userId}:`, error);
      }
    }

    console.log(`Weekly insights job completed: ${successCount} successful, ${failureCount} failed`);
  }

  /**
   * Execute monthly reports job
   */
  private async executeMonthlyReports(): Promise<void> {
    console.log('Starting monthly reports job...');

    // Get users who have opted in for monthly reports
    const optedInUsers = await emailService.getUsersOptedInForMonthlyReports();

    if (optedInUsers.length === 0) {
      console.log('No users opted in for monthly reports');
      return;
    }

    console.log(`Processing monthly reports for ${optedInUsers.length} users`);

    let successCount = 0;
    let failureCount = 0;

    for (const userId of optedInUsers) {
      try {
        // Check user preferences again
        const canSend = await emailService.canSendMonthlyReport(userId);
        if (!canSend) {
          continue;
        }

        // Generate monthly report
        const report = await insightsGenerator.generateMonthlyReport(userId);
        if (!report) {
          console.log(`No monthly report data available for user ${userId}`);
          continue;
        }

        // Send email
        const emailContent = EnhancedEmailTemplates.monthlyReport(report);
        const result = await emailService.sendEmailToUser({
          userId,
          content: emailContent,
          checkPreferences: false // Already checked
        });

        if (result.success) {
          successCount++;
          console.log(`Monthly report sent successfully to user ${userId}`);
        } else {
          failureCount++;
          console.error(`Failed to send monthly report to user ${userId}: ${result.error}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`Error processing monthly report for user ${userId}:`, error);
      }
    }

    console.log(`Monthly reports job completed: ${successCount} successful, ${failureCount} failed`);
  }

  /**
   * Execute marketing emails job
   */
  private async executeMarketingEmails(): Promise<void> {
    console.log('Starting marketing emails job...');

    // Get users who have opted in for marketing emails
    const optedInUsers = await emailService.getUsersOptedInForMarketing();

    if (optedInUsers.length === 0) {
      console.log('No users opted in for marketing emails');
      return;
    }

    console.log(`Processing marketing emails for ${optedInUsers.length} users`);

    // For demo purposes, send a financial tip
    // In a real implementation, this would come from a campaign management system
    const marketingData: MarketingEmailData = {
      campaignType: 'financial_tip',
      subject: '💡 Weekly Financial Tip: Smart Saving Strategies',
      content: {
        headline: 'Boost Your Savings with These Simple Tips',
        mainMessage: 'Small changes in your daily habits can lead to significant savings over time. Here are some proven strategies to help you save more without sacrificing your lifestyle.',
        features: [
          'Automate your savings - set up automatic transfers to savings right after payday',
          'Use the 24-hour rule for non-essential purchases over $50',
          'Review subscriptions monthly and cancel what you don\'t use',
          'Pack lunch 3-4 days a week instead of eating out',
          'Use cashback apps and credit card rewards for purchases you\'d make anyway'
        ],
        ctaText: 'Read More Financial Tips',
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard`
      }
    };

    let successCount = 0;
    let failureCount = 0;

    for (const userId of optedInUsers) {
      try {
        // Check user preferences again
        const canSend = await emailService.canSendMarketingEmail(userId);
        if (!canSend) {
          continue;
        }

        // Send marketing email
        const emailContent = EnhancedEmailTemplates.marketing.financialTip(marketingData);
        const result = await emailService.sendEmailToUser({
          userId,
          content: emailContent,
          checkPreferences: false // Already checked
        });

        if (result.success) {
          successCount++;
          console.log(`Marketing email sent successfully to user ${userId}`);
        } else {
          failureCount++;
          console.error(`Failed to send marketing email to user ${userId}: ${result.error}`);
        }
      } catch (error) {
        failureCount++;
        console.error(`Error processing marketing email for user ${userId}:`, error);
      }
    }

    console.log(`Marketing emails job completed: ${successCount} successful, ${failureCount} failed`);
  }

  /**
   * Get next run date for a cron schedule
   */
  private getNextRunDate(cronPattern: string): Date {
    // Simple implementation - in production, you might want to use a more sophisticated cron parser
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Placeholder: next day
  }

  /**
   * Add job result to history
   */
  private addToHistory(result: JobResult): void {
    this.jobHistory.unshift(result);
    if (this.jobHistory.length > this.maxHistorySize) {
      this.jobHistory = this.jobHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get job status
   */
  public getJobStatus(jobId: string): ScheduledJob | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get all jobs status
   */
  public getAllJobsStatus(): Map<string, ScheduledJob> {
    return new Map(this.jobs);
  }

  /**
   * Get job history
   */
  public getJobHistory(limit?: number): JobResult[] {
    return limit ? this.jobHistory.slice(0, limit) : [...this.jobHistory];
  }

  /**
   * Enable/disable a job
   */
  public toggleJob(jobId: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.enabled = enabled;

    if (enabled) {
      this.scheduleJob(job);
    } else {
      // Note: node-cron doesn't have a simple way to unschedule specific tasks
      // In production, you might want to keep track of the cron task instances
    }

    return true;
  }

  /**
   * Manually trigger a job
   */
  public async triggerJob(jobId: string): Promise<JobResult> {
    return this.executeJob(jobId);
  }
}

// Export singleton instance
export const emailScheduler = EmailScheduler.getInstance();