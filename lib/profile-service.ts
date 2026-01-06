import { databases, account } from '@/lib/appwrite-client'
import { ID, Query } from 'appwrite'
import { logger } from './logger'
import { APPWRITE_CONFIG, COLLECTIONS } from './config'

export interface UserProfile {
  userId: string
  name?: string
  email?: string
  role: string
  avatarUrl?: string
  preferredCurrencies?: string[]
  $id: string
  $createdAt: string
  $updatedAt: string
}

export class ProfileService {
  private static isUnknownAttributeError(error: unknown): boolean {
    const message = String(error?.message || "");
    return /Unknown attribute/i.test(message);
  }

  /**
   * Get user profile from the users_private collection
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const profile = await databases.getDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId
      )
      return profile as UserProfile
    } catch (error: unknown) {
      const err = error as { code?: number };
      if (err.code === 404) {
        // Profile doesn't exist, create it
        return await this.createUserProfile(userId)
      }
      logger.error('Error fetching user profile', { error: error.message, userId })
      throw error
    }
  }

  /**
   * Create a new user profile
   */
  static async createUserProfile(userId: string): Promise<UserProfile> {
    try {
      // Get user info from Appwrite account
      const user = await account.get()
      
      const profileData = {
        userId: userId,
        role: 'user',
        name: user.name || '',
        email: user.email || ''
        // Note: preferredCurrencies and avatarUrl fields will be added when they exist in the schema
      }

      const profile = await databases.createDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId, // Use userId as document ID
        profileData
      )

      return profile as UserProfile
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error creating user profile', { error: err.message, userId })
      throw error
    }
  }

  /**
   * Update user profile name
   */
  static async updateName(userId: string, name: string): Promise<void> {
    try {
      // Update in Appwrite account
      await account.updateName(name)
      
      // Update in users_private collection
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId,
        { name }
      )
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error('Error updating user name', { error: err.message, userId })
      throw error
    }
  }

  /**
   * Update user avatar URL
   */
  static async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId,
        { avatarUrl }
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support this field
        return
      }
      const err = error as { message?: string };
      logger.error('Error updating user avatar', { error: err.message, userId })
      throw error
    }
  }

  /**
   * Update user currency preferences
   */
  static async updateCurrencyPreferences(userId: string, preferredCurrencies: string[]): Promise<void> {
    try {
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId,
        { preferredCurrencies }
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support this field
        return
      }
      const err = error as { message?: string };
      logger.error('Error updating currency preferences', { error: err.message, userId })
      throw error
    }
  }

  /**
   * Update multiple profile fields at once
   */
  static async updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'name' | 'avatarUrl' | 'preferredCurrencies'>>): Promise<void> {
    try {
      // If name is being updated, update account as well
      if (updates.name) {
        await account.updateName(updates.name)
      }

      // Update users_private collection
      await databases.updateDocument(
        APPWRITE_CONFIG.databaseId,
        COLLECTIONS.usersPrivate,
        userId,
        updates
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support some fields
        return
      }
      const err = error as { message?: string };
      logger.error('Error updating user profile', { error: err.message, userId })
      throw error
    }
  }
}
