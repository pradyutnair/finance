# Email Verification Setup with Appwrite

This guide explains how to configure email verification for your Nexpass application using Appwrite's built-in email verification system.

## Overview

The email verification system ensures that users provide real, functional email addresses during sign up. Users must verify their email before they can access the dashboard and use the application features.

## Implementation Summary

✅ **Features Implemented:**
- Email verification required for all new users
- Automatic verification email on sign up
- Verification status tracking
- Redirect unverified users to verification page
- Resend verification email functionality
- Verification success/error handling

## Appwrite Configuration Required

### 1. Enable Email Verification in Appwrite Console

1. Log in to your Appwrite console
2. Navigate to your project
3. Go to **Authentication** → **Settings**
4. Enable **Email Verification** under the "Email/Password" authentication provider
5. Configure the following settings:

```
✓ Require email verification: ON
✓ Verification redirect URL: https://yourdomain.com/verify-email-success
```

### 2. Configure Email Delivery Service

You need to set up an email delivery service for Appwrite to send verification emails. Choose one of the following:

#### Option A: Use Appwrite's Built-in Email Service
1. In Appwrite Console → Authentication → Settings
2. Configure SMTP settings:
   ```
   SMTP Server: smtp.gmail.com (or your provider)
   SMTP Port: 587
   SMTP Secure: TLS
   SMTP User: your-email@domain.com
   SMTP Password: your-app-password
   ```

#### Option B: Use Third-party Email Service (Recommended)
1. Configure services like:
   - **Mailgun**
   - **SendGrid**
   - **AWS SES**
   - **Resend** (already configured for your email service)

2. In Appwrite Console → Authentication → Settings
3. Add your SMTP or API credentials from the chosen service

### 3. Update Environment Variables

Ensure your Appwrite configuration in `.env.local` includes:

```env
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT=your-project-id
```

## User Flow After Implementation

### New User Sign Up
1. User fills out sign up form
2. Account is created in Appwrite
3. Verification email is automatically sent
4. User is redirected to `/verify-email` page
5. User must click verification link in email
6. After verification, user can access dashboard

### Existing User Login
1. User enters email and password
2. If email is verified → redirected to dashboard
3. If email is not verified → redirected to `/verify-email` page
4. User can resend verification email from verification page

## Pages Created

1. **`/verify-email`** - Email verification prompt page
   - Shows user's email
   - Provides resend functionality
   - Auto-redirects after verification

2. **`/verify-email-success`** - Verification callback handler
   - Processes Appwrite verification completion
   - Shows success/error status
   - Redirects to dashboard after success

## Key Components Modified

### Auth Context (`contexts/auth-context.tsx`)
- Added `isEmailVerified` state tracking
- Updated `register()` to send verification email
- Updated `login()` to check verification status
- Added `sendVerificationEmail()` function

### Auth Guard (`components/auth-guard.tsx`)
- Added email verification check
- Redirects unverified users to verification page

### Login Form (`components/login/login-form.tsx`)
- Updated success messages for verification flow
- Added error handling for unverified users

## Testing the Implementation

### 1. Test Sign Up Flow
```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000/login
# Click "Sign up" and create a new account
# Check that you're redirected to /verify-email
# Verify the email was received and clickable
```

### 2. Test Verification Flow
1. Click the verification link in the email
2. Should redirect to `/verify-email-success`
3. Should show success message
4. Should auto-redirect to dashboard

### 3. Test Login Without Verification
1. Try logging in with an unverified account
2. Should redirect to `/verify-email` page
3. Should not allow dashboard access

### 4. Test Resend Functionality
1. On `/verify-email` page, click "Resend Verification Email"
2. Should receive new verification email
3. Cooldown timer should work (60 seconds)

## Security Considerations

✅ **Security Features:**
- Verification tokens are time-limited (configured in Appwrite)
- Users must have access to the email account
- Automatic session management
- Protection against fake email signups

## Troubleshooting

### Common Issues

**Issue:** Users not receiving verification emails
**Solution:** Check your SMTP/email service configuration in Appwrite Console

**Issue:** Verification links are invalid
**Solution:** Ensure the redirect URL in Appwrite matches your domain

**Issue:** Users can access dashboard without verification
**Solution:** Verify AuthGuard is properly implemented and email verification is enabled

### Appwrite Console Monitoring

Monitor email verification in:
- Authentication → Users (see verification status)
- Authentication → Settings (check email configuration)
- Logs (check for delivery failures)

## Production Deployment

For production deployment:

1. **Domain Configuration:**
   ```
   Verification redirect URL: https://yourdomain.com/verify-email-success
   ```

2. **Email Service:**
   - Use a reliable email service (SendGrid, Mailgun, etc.)
   - Set up proper SPF/DKIM records for deliverability
   - Configure bounce handling

3. **Monitoring:**
   - Monitor email delivery rates
   - Track verification completion rates
   - Set up alerts for failed email sends

## Additional Features (Future Enhancements)

- Email template customization
- Verification reminder emails (e.g., after 24 hours)
- Analytics on verification completion rates
- Admin dashboard for managing unverified users
- Allow changing email address with re-verification