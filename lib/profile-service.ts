import { databases, account } from '@/lib/appwrite-client'
import { ID, Query } from 'appwrite'

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || '68d42ac20031b27284c9'
const USERS_PRIVATE_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_USERS_PRIVATE_COLLECTION_ID || 'users_private'

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
  private static isUnknownAttributeError(error: any): boolean {
    const message = String(error?.message || "");
    return /Unknown attribute/i.test(message);
  }

  /**
   * Get user profile from the users_private collection
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const profile = await databases.getDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId
      )
      return profile as UserProfile
    } catch (error: any) {
      if (error.code === 404) {
        // Profile doesn't exist, create it
        return await this.createUserProfile(userId)
      }
      console.error('Error fetching user profile:', error)
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
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId, // Use userId as document ID
        profileData
      )

      return profile as UserProfile
    } catch (error) {
      console.error('Error creating user profile:', error)
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
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId,
        { name }
      )
    } catch (error) {
      console.error('Error updating user name:', error)
      throw error
    }
  }

  /**
   * Update user avatar URL
   */
  static async updateAvatar(userId: string, avatarUrl: string): Promise<void> {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId,
        { avatarUrl }
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support this field
        return
      }
      console.error('Error updating user avatar:', error)
      throw error
    }
  }

  /**
   * Update user currency preferences
   */
  static async updateCurrencyPreferences(userId: string, preferredCurrencies: string[]): Promise<void> {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId,
        { preferredCurrencies }
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support this field
        return
      }
      console.error('Error updating currency preferences:', error)
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
        DATABASE_ID,
        USERS_PRIVATE_COLLECTION_ID,
        userId,
        updates
      )
    } catch (error) {
      if (this.isUnknownAttributeError(error)) {
        // Silently ignore if schema doesn't support some fields
        return
      }
      console.error('Error updating user profile:', error)
      throw error
    }
  }
}
