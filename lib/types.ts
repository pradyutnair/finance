/**
 * Common type definitions used across the application
 */

import type { Models } from 'appwrite';

// Auth User Types
export interface AuthUser {
  $id: string;
  id?: string;
  email?: string;
  name?: string;
  [key: string]: unknown;
}

export type AuthUserResult = Models.User<Models.Preferences> | AuthUser;

// API Error Types
export interface ApiError {
  message: string;
  status?: number;
  code?: string | number;
  details?: unknown;
}

export class AppwriteError extends Error implements ApiError {
  status: number;
  code?: string | number;
  details?: unknown;

  constructor(message: string, status: number, code?: string | number, details?: unknown) {
    super(message);
    this.name = 'AppwriteError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Transaction Types
export interface TransactionDocument {
  $id: string;
  userId: string;
  accountId: string;
  transactionId?: string;
  amount: string | number;
  currency: string;
  bookingDate?: string;
  bookingDateTime?: string;
  valueDate?: string;
  description?: string;
  counterparty?: string;
  category?: string;
  exclude?: boolean;
  isNotRecurring?: boolean;
  raw?: string;
  $createdAt?: string;
  $updatedAt?: string;
}

// Budget Types
export interface BudgetDocument {
  $id?: string;
  userId: string;
  baseCurrency: string;
  groceriesBudget: number;
  restaurantsBudget: number;
  educationBudget: number;
  transportBudget: number;
  travelBudget: number;
  shoppingBudget: number;
  utilitiesBudget: number;
  entertainmentBudget: number;
  healthBudget: number;
  incomeBudget: number;
  financeBudget: number;
  subscriptionsBudget: number;
  miscellaneousBudget: number;
  uncategorizedBudget: number;
  bankTransferBudget: number;
}

// Database Response Types
export interface DatabaseListResponse<T> {
  documents: T[];
  total: number;
}

// Client Headers Type
export interface AppwriteClientHeaders {
  'X-Appwrite-Key'?: string;
  'X-Appwrite-JWT'?: string;
  [key: string]: string | undefined;
}

