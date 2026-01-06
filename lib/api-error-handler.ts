/**
 * Standardized error handling utilities for API routes
 */

import { NextResponse } from 'next/server';
import { StatusError } from './auth';
import { HttpError } from './gocardless';
import { AppwriteError, ApiError } from './types';
import { logger } from './logger';

export interface ErrorResponse {
  ok: false;
  error: string;
  details?: unknown;
}

/**
 * Standardized error handler for API routes
 * Returns appropriate NextResponse based on error type
 */
export function handleApiError(error: unknown, defaultStatus = 500): NextResponse<ErrorResponse> {
  // Log the error
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStatus = getErrorStatus(error, defaultStatus);
  
  logger.error('API route error', {
    error: errorMessage,
    status: errorStatus,
    type: error?.constructor?.name,
  });

  // Handle known error types
  if (error instanceof StatusError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status }
    );
  }

  if (error instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: error.message, details: error.details },
      { status: error.status }
    );
  }

  if (error instanceof AppwriteError) {
    return NextResponse.json(
      { ok: false, error: error.message, details: error.details },
      { status: error.status }
    );
  }

  // Handle generic errors
  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json(
    { ok: false, error: message },
    { status: errorStatus }
  );
}

/**
 * Extract status code from error object
 */
function getErrorStatus(error: unknown, defaultStatus: number): number {
  if (error instanceof StatusError || error instanceof HttpError || error instanceof AppwriteError) {
    return error.status;
  }
  
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === 'number') {
      return status;
    }
  }
  
  return defaultStatus;
}

/**
 * Type guard to check if error has status property
 */
export function isErrorWithStatus(error: unknown): error is { status: number; message?: string } {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  );
}

