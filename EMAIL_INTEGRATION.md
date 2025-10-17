# Email Integration with Resend

This document explains how to use the Resend email service integration in Nexpass to send emails to users from the Appwrite database.

## Overview

The email integration allows you to:
- Send transactional emails to users
- Use pre-built email templates (welcome, monthly reports, budget alerts)
- Send custom HTML/text emails
- Respect user email preferences
- Send emails to multiple users at once

## Setup

### 1. Environment Configuration

Add the following to your `.env.local` file:

```bash
# Resend Email Service
RESEND_API_KEY=your-resend-api-key
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

### 2. Get Resend API Key

1. Sign up at [https://resend.com](https://resend.com)
2. Verify your domain in the Resend dashboard
3. Create an API key
4. Add the API key to your environment variables

### 3. Domain Verification

Before sending emails, you must verify your domain with Resend:
- Go to Resend Dashboard → Domains
- Add your domain and complete the DNS verification
- Update `RESEND_FROM_EMAIL` to use your verified domain

## API Endpoints

### Send Email to User
**POST** `/api/email/send`

Send an email to a single user using templates or custom content.

**Request Body:**
```json
{
  "type": "welcome", // or "monthly_report", "budget_alert"
  "recipientUserId": "user_id_here", // optional, defaults to current user
  "checkPreferences": true, // optional, respects user email preferences
  "config": {
    "fromEmail": "custom@yourdomain.com", // optional
    "replyTo": "support@yourdomain.com" // optional
  },
  // Template-specific fields:
  "month": "January 2024", // for monthly_report
  "category": "Food & Dining", // for budget_alert
  "spent": 450.00, // for budget_alert
  "budget": 500.00 // for budget_alert
}
```

**Custom Content Example:**
```json
{
  "customContent": {
    "subject": "Custom Email Subject",
    "html": "<h1>Hello {{name}}</h1><p>This is a custom email.</p>",
    "text": "Hello {{name}}\n\nThis is a custom email."
  },
  "recipientUserId": "user_id_here"
}
```

### Send Email to Multiple Users
**POST** `/api/email/send-multiple`

Send emails to multiple users at once.

**Request Body:**
```json
{
  "userIds": ["user1_id", "user2_id", "user3_id"],
  "type": "welcome", // or "monthly_report"
  "config": {
    "fromEmail": "custom@yourdomain.com" // optional
  }
}
```

### Get User Email Data
**GET** `/api/email/user-data`

Retrieve user's email address and notification preferences.

**Query Parameters:**
- `userId` (optional): User ID, defaults to current user

### Preview Email Templates
**GET** `/api/email/templates`

Preview email templates without sending.

**Query Parameters:**
- `type`: Template type (`welcome`, `monthly_report`, `budget_alert`)
- `userName`: User name for personalization
- `month`: Month for monthly report
- `category`: Category for budget alert
- `spent`: Amount spent for budget alert
- `budget`: Budget amount for budget alert

### Test Email Service
**POST** `/api/email/test`

Test the email service functionality.

**Request Body:**
```json
{
  "templateType": "welcome", // or "monthly_report", "budget_alert"
  "testType": "template" // testing mode
}
```

## Email Templates

### Welcome Email
- **Type**: `welcome`
- **Purpose**: Send welcome email to new users
- **Personalization**: User's name

### Monthly Report
- **Type**: `monthly_report`
- **Purpose**: Send monthly financial summary
- **Personalization**: User's name, month
- **Fields**: `month` (optional, defaults to current month)

### Budget Alert
- **Type**: `budget_alert`
- **Purpose**: Alert users when they exceed budget limits
- **Personalization**: User's name, category, spent amount, budget limit
- **Fields**: `category`, `spent`, `budget`

## User Preferences

The system respects user email preferences stored in the `preferences_budgets_dev` collection:

- `emailNotifications`: Master switch for email notifications (default: true)
- `monthlyReports`: Enable/disable monthly report emails (default: false)
- `weeklyReports`: Enable/disable weekly report emails (default: false)

## Usage Examples

### Send Welcome Email
```javascript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'welcome',
    recipientUserId: 'user123'
  })
});
```

### Send Budget Alert
```javascript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    type: 'budget_alert',
    recipientUserId: 'user123',
    category: 'Food & Dining',
    spent: 450.00,
    budget: 500.00
  })
});
```

### Send Custom Email
```javascript
const response = await fetch('/api/email/send', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customContent: {
      subject: 'Important Update',
      html: '<h1>Hello {{name}}</h1><p>We have important news for you.</p>',
      text: 'Hello {{name}}\n\nWe have important news for you.'
    },
    recipientUserId: 'user123'
  })
});
```

### Send Bulk Email
```javascript
const response = await fetch('/api/email/send-multiple', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userIds: ['user1', 'user2', 'user3'],
    type: 'monthly_report',
    month: 'January 2024'
  })
});
```

## Error Handling

The API returns standard HTTP status codes:

- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `401`: Unauthorized (invalid authentication)
- `404`: User not found
- `500`: Server error (email service issues)

### Error Response Format
```json
{
  "ok": false,
  "error": "Error message description"
}
```

### Success Response Format
```json
{
  "ok": true,
  "message": "Email sent successfully",
  "messageId": "resend_message_id_here"
}
```

## Security Considerations

1. **Authentication**: All email endpoints require authentication
2. **Authorization**: Users can only send emails to themselves unless they have admin privileges
3. **Rate Limiting**: Consider implementing rate limiting for bulk email operations
4. **Input Validation**: All inputs are validated before processing
5. **User Preferences**: The system respects user opt-out preferences

## Troubleshooting

### Common Issues

1. **Emails not sending**
   - Check if `RESEND_API_KEY` is configured
   - Verify your domain is verified in Resend
   - Check server logs for error messages

2. **User not found**
   - Verify the user exists in the `users_private` collection
   - Check if the user ID is correct

3. **Template errors**
   - Ensure all required template fields are provided
   - Check template parameter names

4. **Authentication errors**
   - Verify the user is logged in
   - Check JWT token or session cookie

### Testing

Use the `/api/email/test` endpoint to test the email service:

```javascript
const response = await fetch('/api/email/test', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + userToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateType: 'welcome'
  })
});
```

This will test:
1. User data retrieval from Appwrite
2. Email template generation
3. Email sending via Resend (if configured)

## Integration Points

The email service can be integrated with:

1. **User Registration**: Send welcome emails
2. **Monthly Reports**: Automated financial summaries
3. **Budget Alerts**: When users approach or exceed budget limits
4. **Security Notifications**: Suspicious activity alerts
5. **System Announcements**: Important updates to all users

## Next Steps

1. Configure your Resend account and domain
2. Set up environment variables
3. Test the email service using the test endpoint
4. Integrate email sending into your application flows
5. Set up automated email jobs for recurring notifications