# Profile Page Components

This directory contains the components for the comprehensive profile page implementation.

## Components

// Note: avatar-upload.tsx and name-editor.tsx were removed. Inline name editing now
// lives directly in `app/profile/page.tsx`. Avatars are not edited on the profile page.

### `currency-preferences.tsx`
- **Purpose**: Manage user's preferred currencies for the app
- **Features**:
  - Add/remove currencies from preferred list
  - Visual currency symbols and badges
  - Integration with currency context
  - Automatic base currency adjustment

## Integration

### Appwrite Services Used
- **Account**: For user authentication and basic profile info
- **Databases**: For extended user profile data (`users_private` collection)
- **Avatars**: For generating initials-based profile pictures
- **Storage**: (Future) For custom avatar uploads

### Context Integration
- **AuthContext**: User authentication state
- **CurrencyContext**: Enhanced with user preferences from Appwrite

## Required Schema Updates

Before using these components, ensure your `users_private` collection has these fields:

```javascript
// avatarUrl - stores profile picture URL
{
  key: 'avatarUrl',
  type: 'string',
  size: 500,
  required: false,
  array: false
}

// preferredCurrencies - array of currency codes
{
  key: 'preferredCurrencies', 
  type: 'string',
  size: 255,
  required: false,
  array: true
}
```

See `scripts/update-user-schema.md` for detailed instructions.

## Usage

```tsx
import { CurrencyPreferences } from '@/components/profile-page/currency-preferences'

<CurrencyPreferences
  preferredCurrencies={['EUR', 'USD', 'GBP']}
  onCurrencyPreferencesUpdate={(currs) => {/* handled in page */}}
/> 
```

## Styling

All components use shadcn/ui components for consistency:
- Cards for section organization
- Buttons with proper loading states
- Form inputs with validation
- Badges for status indicators
- Toast notifications for user feedback

## Error Handling

- Graceful fallbacks for missing schema fields
- User-friendly error messages
- Loading states for async operations
- Validation feedback for form inputs
