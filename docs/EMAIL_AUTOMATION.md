# Email Automation System

This document describes the comprehensive email automation system implemented for Nexpass, providing weekly insights, monthly reports, and marketing emails while respecting user preferences.

## 🎯 Overview

The email automation system includes:
- **Weekly Financial Insights** - Automated spending summaries and tips
- **Monthly Financial Reports** - Comprehensive monthly financial overviews
- **Marketing Campaigns** - Feature announcements and financial education content
- **User Preference Management** - Full GDPR-compliant opt-in system
- **Advanced Scheduling** - Cron-based job scheduler with retry logic
- **Comprehensive Testing** - Unit tests, integration tests, and end-to-end validation

## 🏗️ Architecture

### Core Components

1. **Email Service** (`lib/email-service.ts`)
   - Resend integration with preference checking
   - User data fetching and personalization
   - Template management and email sending

2. **Email Templates** (`lib/email-templates.ts`)
   - Professional HTML templates with responsive design
   - Weekly insights, monthly reports, and marketing templates
   - Personalization with user data and financial insights

3. **Insights Generator** (`lib/email-insights.ts`)
   - Financial data analysis and trend calculation
   - Budget performance tracking and alerts
   - Personalized tips and recommendations

4. **Email Scheduler** (`lib/scheduler.ts`)
   - Cron-based job scheduling with node-cron
   - Retry logic and error handling
   - Job status tracking and history

5. **Preference System**
   - User opt-in for weekly/monthly/marketing emails
   - Real-time preference checking
   - GDPR-compliant consent management

## 📧 Email Types

### Weekly Insights
- **When**: Sundays at 9:00 AM UTC
- **Content**: Spending summary, top categories, budget alerts, savings rate, weekly tip
- **Requirement**: User must opt-in via profile settings

### Monthly Reports
- **When**: 1st of each month at 10:00 AM UTC
- **Content**: Complete financial overview, budget performance, insights, trends
- **Requirement**: User must opt-in via profile settings

### Marketing Emails
- **When**: Tuesdays at 2:00 PM UTC
- **Content**: Feature announcements, financial tips, educational content
- **Requirement**: User must opt-in via profile settings

## 🔧 Configuration

### Environment Variables

```bash
# Required
RESEND_API=your_resend_api_key
RESEND_EMAIL=team@nexpass.app
NEXT_PUBLIC_APP_URL=https://your-app.com

# Scheduler Configuration
ENABLE_EMAIL_SCHEDULER=true
WEEKLY_INSIGHTS_CRON=0 9 * * 0
MONTHLY_REPORTS_CRON=0 10 1 * *
MARKETING_EMAILS_CRON=0 14 * * 2

# Optional
MAX_CONCURRENT_JOBS=5
JOB_RETRY_ATTEMPTS=3
JOBS_API_KEY=secure_api_key_for_job_management
```

### User Preferences

Users can control their email subscriptions via:
- Profile Settings → Preferences → Reports & Analytics
- Weekly Reports toggle
- Monthly Reports toggle
- Marketing Communications toggle

## 🚀 Setup & Installation

### 1. Install Dependencies

```bash
npm install node-cron @types/node-cron
```

### 2. Configure Environment

Add the required environment variables to your `.env` file (see above).

### 3. Initialize the System

```typescript
// In your app initialization (e.g., layout.tsx or _app.tsx)
import { initializeEmailAutomation } from '@/lib/email-setup';

initializeEmailAutomation();
```

### 4. Verify Configuration

```bash
# Test the system
curl -X POST http://localhost:3000/api/email/test-automation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"testType": "comprehensive"}'
```

## 📡 API Endpoints

### Job Management

#### Weekly Insights
```bash
# Get status
GET /api/jobs/weekly-insights

# Trigger job
POST /api/jobs/weekly-insights

# Enable/disable
PUT /api/jobs/weekly-insights
{
  "enabled": true
}
```

#### Monthly Reports
```bash
# Get status
GET /api/jobs/monthly-reports

# Trigger job
POST /api/jobs/monthly-reports

# Enable/disable
PUT /api/jobs/monthly-reports
{
  "enabled": true
}
```

#### Marketing Emails
```bash
# Get status
GET /api/jobs/marketing

# Trigger job
POST /api/jobs/marketing

# Send test email
POST /api/jobs/marketing
{
  "userId": "user_id",
  "testMode": true,
  "campaignType": "financial_tip"
}
```

### Testing & Diagnostics

#### System Test
```bash
# Run comprehensive tests
POST /api/email/test-automation

# Get system status
GET /api/email/test-automation
```

## 🧪 Testing

### Unit Tests

```bash
# Run email service tests
npm test -- tests/email/test-email-service.ts

# Run template tests
npm test -- tests/email/test-templates.ts

# Run scheduler tests
npm test -- tests/email/test-scheduler.ts
```

### Manual Testing

1. **User Preference Testing**
   - Go to Profile → Preferences
   - Toggle email preferences
   - Verify preference changes are respected

2. **Template Testing**
   - Use test endpoint to render templates
   - Check HTML rendering in different email clients
   - Verify personalization works correctly

3. **Scheduler Testing**
   - Manually trigger jobs via API endpoints
   - Verify job execution and logging
   - Test error handling and retry logic

## 📊 Monitoring & Analytics

### Job History

The system maintains a history of job executions:
```typescript
import { emailScheduler } from '@/lib/scheduler';

const history = emailScheduler.getJobHistory(10);
console.log('Recent job executions:', history);
```

### Email Delivery Tracking

Resend provides built-in analytics:
- Delivery rates
- Open rates
- Click tracking
- Bounce handling

Access via: https://resend.com/dashboard/analytics

### System Health

Monitor system health via:
```typescript
import { getEmailAutomationStatus } from '@/lib/email-setup';

const status = getEmailAutomationStatus();
console.log('System status:', status);
```

## 🔒 Security & Privacy

### Data Protection
- All email sends require user opt-in consent
- Personal data is only used for email personalization
- Users can unsubscribe at any time via profile settings
- Compliance with GDPR and privacy regulations

### API Security
- Job management endpoints require API key authentication
- User-specific operations require valid JWT tokens
- Rate limiting and request validation

### Preference Respect
- **Hard checks** before every email send
- Graceful fallback if preferences can't be fetched
- Audit logging of all email sends

## 🎨 Email Design

### Brand Guidelines
- Colors: Primary gradient (purple to blue)
- Typography: System fonts for maximum compatibility
- Layout: Mobile-first responsive design
- Logo: Nexpass branding in header

### Content Strategy
- **Weekly**: Quick insights, actionable tips
- **Monthly**: Comprehensive analysis, trends
- **Marketing**: Value-focused, educational content

### Personalization
- User's first name in greetings
- Financial data specific to their accounts
- Budget categories they actually use
- Insights based on their spending patterns

## 🚨 Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check RESEND_API_KEY is valid
   - Verify RESEND_FROM_EMAIL is verified in Resend
   - Check user has opted in for specific email type

2. **Jobs not running**
   - Verify ENABLE_EMAIL_SCHEDULER=true
   - Check cron schedule patterns
   - Review job history for errors

3. **Template rendering issues**
   - Check NEXT_PUBLIC_APP_URL is set
   - Verify template data structure
   - Test with mock data first

### Debug Mode

Enable debug logging:
```bash
DEBUG=email:* npm run dev
```

### Health Checks

```typescript
// Check system health
const validation = validateEmailConfiguration();
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## 📈 Performance Optimization

### Sending Limits
- Resend: 100 emails per second (free tier)
- Configure MAX_CONCURRENT_JOBS appropriately
- Implement rate limiting for large user bases

### Database Optimization
- Index user preference fields
- Cache frequently accessed user data
- Batch preference checks for multiple users

### Template Caching
- Pre-compile templates
- Cache rendered content when possible
- Optimize HTML for email client compatibility

## 🔄 Future Enhancements

### Planned Features
- [ ] A/B testing for email content
- [ ] Advanced user segmentation
- [ ] Personalized sending times
- [ ] Email analytics dashboard
- [ ] Automated campaign management
- [ ] Multi-language support

### Integration Opportunities
- [ ] Push notification coordination
- [ ] In-app messaging integration
- [ ] Social media sharing
- [ ] Third-party analytics tools

## 📞 Support

For issues with the email automation system:

1. Check the troubleshooting section above
2. Review system logs and job history
3. Verify configuration using test endpoints
4. Contact development team with specific error details

---

**Last Updated**: January 2024
**Version**: 1.0.0
**Maintainer**: Nexpass Development Team