# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nexpass is a personal finance dashboard built with Next.js 15, featuring a dual backend architecture:
- **Appwrite**: User authentication, preferences, budgets, and GDPR compliance
- **MongoDB**: Encrypted banking data using GCP KMS Queryable Encryption
- **GoCardless**: EU bank account aggregation via PSD2 regulations

## Development Commands

```bash
# Development
npm run dev          # Start development server with Turbopack
npm run build        # Build for production with Turbopack
npm run start        # Start production server
npm run lint         # Run ESLint

# Function Deployment (Appwrite)
# Use Appwrite CLI in /functions/ subdirectories
```

## Architecture Patterns

### Dual Backend Strategy
- **User management & preferences** → Appwrite collections (`/lib/appwrite.ts`)
- **Banking data** (accounts, transactions) → MongoDB with encryption (`/lib/mongo/`)
- **API routes** bridge both backends (`/app/api/`)

### MongoDB Queryable Encryption
Critical: Sensitive fields are encrypted while queryable fields remain plaintext:
```typescript
// Plaintext fields (for efficient queries): userId, accountId, bookingDate, category
// Encrypted fields: iban, accountName, amount, description, counterparty
```

Use the cache service (`/lib/server/cache-service.ts`) which handles encryption transparently.

### Context Provider Stack
Order matters in `/app/layout.tsx`:
1. ThemeProvider (theming)
2. AuthProvider (user state)
3. QueryProvider (TanStack Query)
4. CurrencyProvider (financial formatting)

## Key Directories and Files

### Core Application
- `app/` - Next.js App Router pages and API routes
- `components/` - Reusable React components
- `lib/` - Utility functions and services
- `contexts/` - React context providers

### Banking Integration
- `lib/gocardless.ts` - Rate-limited GoCardless API client with token caching
- `functions/gocardless-sync-mongo/` - Appwrite function for bank data sync
- `app/api/transactions/route.ts` - Encrypted transaction queries

### Authentication & Security
- `contexts/auth-context.tsx` - Appwrite user state management
- `components/auth-guard.tsx` - Route protection
- `lib/auth.ts` - Server-side auth utilities
- `lib/mongo/qe.ts` - Queryable encryption setup
- `lib/mongo/client.ts` - Encrypted MongoDB client

## Code Conventions

### TypeScript Patterns
- Use functional components only (no classes)
- Prefer interfaces over types
- Server Actions for mutations, return error objects not exceptions
- Use `server-only` package for sensitive operations

### API Route Structure
```typescript
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Always authenticate first
const user = await requireAuthUser(request);
// Use cache service for encrypted data
const data = await getUserTransactionCache(userId);
```

### Component Guidelines
- Every component requiring user info must be wrapped in AuthGuard and AuthContext
- Use Suspense boundaries for loading states
- Mobile-first responsive design with Tailwind CSS
- Shadcn/ui + Radix primitives for components
- Minimize 'use client' directive - favor React Server Components

## Environment Variables

Essential environment variables (do not create .env files):
- Appwrite configuration (endpoint, project ID, database IDs)
- GoCardless API keys for banking integration
- MongoDB URI + GCP KMS credentials for encryption
- `SHARED_LIB_PATH` for MongoDB encryption library
- OpenAI API key for AI categorization

See `.cursor/rules/env-rule.mdc` for complete variable list.

## Security Notes

- Never log encrypted fields or API keys
- Use `requireAuthUser()` for all protected API routes
- Encryption keys managed via GCP KMS, not environment variables
- GDPR compliance implemented via `/app/gdpr/` and `/lib/gdpr/`
- Do not throw errors on client side - always return error objects

## Testing & Debugging

- Check MongoDB collections via Atlas or Compass (encrypted fields show as binary)
- Use `/app/api/debug/` routes for development diagnostics
- Cache invalidation via `/app/api/clear-cache/`
- Function development in `/functions/` directory using Appwrite CLI

## Data Flow Patterns

1. **User Authentication**: Appwrite → AuthContext → components
2. **Bank Data**: GoCardless → Appwrite Function → Encrypted MongoDB → API Routes → Components
3. **Caching**: MongoDB → Cache Service → TanStack Query → Components