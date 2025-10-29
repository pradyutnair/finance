import { emailScheduler } from './scheduler';

/**
 * Initialize the email automation system
 * This should be called when the application starts
 */
export function initializeEmailAutomation(): void {
  try {
    // Check if email scheduler is enabled
    if (process.env.ENABLE_EMAIL_SCHEDULER !== 'true') {
      console.log('📧 Email automation is disabled. Set ENABLE_EMAIL_SCHEDULER=true to enable.');
      return;
    }

    // Check required environment variables
    const requiredEnvVars = [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'NEXT_PUBLIC_APP_URL'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error('❌ Email automation setup failed - missing environment variables:', missingVars);
      return;
    }

    // Initialize scheduler (this happens automatically when getting the instance)
    const scheduler = emailScheduler;
    const allJobs = scheduler.getAllJobsStatus();

    console.log('📧 Email automation system initialized successfully');
    console.log(`📊 Registered ${allJobs.size} automated jobs:`);

    allJobs.forEach((job, jobId) => {
      const status = job.enabled ? '✅ ENABLED' : '❌ DISABLED';
      const schedule = job.schedule || 'Not set';
      console.log(`   ${jobId}: ${status} (Schedule: ${schedule})`);
    });

    console.log('\n🕐 Job Schedules:');
    console.log('   Weekly Insights: Sundays at 9:00 AM UTC');
    console.log('   Monthly Reports: 1st of each month at 10:00 AM UTC');
    console.log('   Marketing Emails: Tuesdays at 2:00 PM UTC');

    console.log('\n🔧 Configuration:');
    console.log(`   Max Concurrent Jobs: ${process.env.MAX_CONCURRENT_JOBS || '5'}`);
    console.log(`   Job Retry Attempts: ${process.env.JOB_RETRY_ATTEMPTS || '3'}`);
    console.log(`   From Email: ${process.env.RESEND_FROM_EMAIL}`);

    console.log('\n📝 API Endpoints:');
    console.log('   GET/PUT /api/jobs/weekly-insights - Manage weekly insights job');
    console.log('   GET/PUT /api/jobs/monthly-reports - Manage monthly reports job');
    console.log('   GET/PUT /api/jobs/marketing - Manage marketing emails job');
    console.log('   GET/POST /api/email/test-automation - Test email system');

    console.log('\n🧪 To test the system:');
    console.log('   1. Send a POST request to /api/email/test-automation');
    console.log('   2. Check user preferences in profile settings');
    console.log('   3. Verify email templates render correctly');
    console.log('   4. Test individual job triggers via API endpoints');

  } catch (error) {
    console.error('❌ Failed to initialize email automation system:', error);
  }
}

/**
 * Get email automation system status
 */
export function getEmailAutomationStatus(): {
  enabled: boolean;
  configured: boolean;
  jobs: Array<{
    id: string;
    name: string;
    enabled: boolean;
    schedule?: string;
    lastRun?: Date;
    nextRun?: Date;
  }>;
  environment: {
    hasApiKey: boolean;
    hasFromEmail: boolean;
    hasNextPublicAppUrl: boolean;
    schedulerEnabled: boolean;
  };
} {
  const scheduler = emailScheduler;
  const allJobs = scheduler.getAllJobsStatus();

  return {
    enabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true',
    configured: !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
    jobs: Array.from(allJobs.values()).map(job => ({
      id: job.id,
      name: job.name,
      enabled: job.enabled,
      schedule: job.schedule,
      lastRun: job.lastRun,
      nextRun: job.nextRun
    })),
    environment: {
      hasApiKey: !!process.env.RESEND_API_KEY,
      hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
      hasNextPublicAppUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      schedulerEnabled: process.env.ENABLE_EMAIL_SCHEDULER === 'true'
    }
  };
}

/**
 * Validate email automation configuration
 */
export function validateEmailConfiguration(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables
  if (!process.env.RESEND_API_KEY) {
    errors.push('RESEND_API_KEY is required');
  }
  if (!process.env.RESEND_FROM_EMAIL) {
    errors.push('RESEND_FROM_EMAIL is required');
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('NEXT_PUBLIC_APP_URL is recommended for proper link generation');
  }

  // Check optional but recommended variables
  if (!process.env.JOBS_API_KEY) {
    warnings.push('JOBS_API_KEY is recommended for securing job management endpoints');
  }

  // Validate cron schedules
  const cronPatterns = {
    weekly: process.env.WEEKLY_INSIGHTS_CRON || '0 9 * * 0',
    monthly: process.env.MONTHLY_REPORTS_CRON || '0 10 1 * *',
    marketing: process.env.MARKETING_EMAILS_CRON || '0 14 * * 2'
  };

  // Basic cron pattern validation (simplified)
  Object.entries(cronPatterns).forEach(([name, pattern]) => {
    const parts = pattern.split(' ');
    if (parts.length !== 5) {
      errors.push(`Invalid cron pattern for ${name}: ${pattern}`);
    }
  });

  // Validate numeric values
  const maxJobs = parseInt(process.env.MAX_CONCURRENT_JOBS || '5');
  if (isNaN(maxJobs) || maxJobs < 1 || maxJobs > 20) {
    warnings.push('MAX_CONCURRENT_JOBS should be between 1 and 20');
  }

  const retryAttempts = parseInt(process.env.JOB_RETRY_ATTEMPTS || '3');
  if (isNaN(retryAttempts) || retryAttempts < 0 || retryAttempts > 10) {
    warnings.push('JOB_RETRY_ATTEMPTS should be between 0 and 10');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}