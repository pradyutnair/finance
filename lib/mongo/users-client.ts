import { MongoClient, Db, Collection } from 'mongodb';

// Simple MongoDB client for user data (non-encrypted for user management)
let clientPromise: Promise<MongoClient> | null = null;

export function getMongoDbName(): string {
  return process.env.MONGODB_DB || 'finance_dev';
}

export async function getMongoClient(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI as string;
  if (!uri) throw new Error('MONGODB_URI is not set');

  clientPromise = (async () => {
    const client = new MongoClient(uri);
    await client.connect();
    return client;
  })();

  return clientPromise;
}

export async function getUsersDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(getMongoDbName());
}

// User premium status interface
export interface UserRecord {
  userId: string;
  email: string;
  name?: string;
  role: string;
  avatarUrl?: string;
  preferredCurrencies?: string[];

  // Stripe fields
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'inactive' | 'past_due' | 'cancelled' | 'unpaid';
  subscriptionCurrentPeriodEnd?: number; // Unix timestamp
  subscriptionCancelAtPeriodEnd?: boolean;
  isPremium: boolean;
  premiumActivatedAt?: number | null; // Unix timestamp
  premiumDeactivatedAt?: number | null; // Unix timestamp

  // Metadata
  createdAt: number;
  updatedAt: number;
}

export async function getUsersCollection(): Promise<Collection<UserRecord>> {
  const db = await getUsersDb();
  return db.collection<UserRecord>('users_premium');
}

/**
 * Get user by userId
 */
export async function getUserByUserId(userId: string): Promise<UserRecord | null> {
  try {
    const collection = await getUsersCollection();
    const user = await collection.findOne({ userId });
    return user;
  } catch (error) {
    console.error('Error fetching user by userId:', error);
    return null;
  }
}

/**
 * Create or update user record
 */
export async function upsertUser(userData: Partial<UserRecord>): Promise<UserRecord> {
  try {
    const collection = await getUsersCollection();
    const now = Date.now();

    const userRecord: UserRecord = {
      userId: userData.userId!,
      email: userData.email!,
      name: userData.name || '',
      role: userData.role || 'user',
      avatarUrl: userData.avatarUrl || '',
      preferredCurrencies: userData.preferredCurrencies || [],
      stripeCustomerId: userData.stripeCustomerId,
      stripeSubscriptionId: userData.stripeSubscriptionId,
      subscriptionStatus: userData.subscriptionStatus || 'inactive',
      subscriptionCurrentPeriodEnd: userData.subscriptionCurrentPeriodEnd || null,
      subscriptionCancelAtPeriodEnd: userData.subscriptionCancelAtPeriodEnd || false,
      isPremium: userData.isPremium || false,
      premiumActivatedAt: userData.premiumActivatedAt || null,
      premiumDeactivatedAt: userData.premiumDeactivatedAt || null,
      createdAt: userData.createdAt || now,
      updatedAt: now,
    };

    const result = await collection.replaceOne(
      { userId: userData.userId },
      { $set: userRecord },
      { upsert: true, returnDocument: 'after' }
    );

    if (!result.value) {
      throw new Error('Failed to upsert user record');
    }

    return result.value;
  } catch (error) {
    console.error('Error upserting user:', error);
    throw new Error(`Failed to upsert user: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update user subscription status
 */
export async function updateUserSubscriptionStatus(
  userId: string,
  subscriptionData: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    subscriptionStatus?: string;
    subscriptionCurrentPeriodEnd?: number;
    isPremium?: boolean;
    premiumActivatedAt?: number | null;
    premiumDeactivatedAt?: number | null;
  }
): Promise<void> {
  try {
    const collection = await getUsersCollection();
    const now = Date.now();

    const updateData = {
      ...(subscriptionData.stripeCustomerId && { stripeCustomerId: subscriptionData.stripeCustomerId }),
      ...(subscriptionData.stripeSubscriptionId && { stripeSubscriptionId: subscriptionData.stripeSubscriptionId }),
      ...(subscriptionData.subscriptionStatus && { subscriptionStatus: subscriptionData.subscriptionStatus }),
      ...(subscriptionData.subscriptionCurrentPeriodEnd !== undefined && {
        subscriptionCurrentPeriodEnd: subscriptionData.subscriptionCurrentPeriodEnd
      }),
      ...(subscriptionData.isPremium !== undefined && { isPremium: subscriptionData.isPremium }),
      ...(subscriptionData.premiumActivatedAt !== undefined && { premiumActivatedAt: subscriptionData.premiumActivatedAt }),
      ...(subscriptionData.premiumDeactivatedAt !== undefined && { premiumDeactivatedAt: subscriptionData.premiumDeactivatedAt }),
      updatedAt: now,
    };

    const result = await collection.updateOne(
      { userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      throw new Error(`User not found: ${userId}`);
    }
  } catch (error) {
    console.error('Error updating user subscription status:', error);
    throw new Error(`Failed to update subscription status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if user has premium access
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  try {
    const user = await getUserByUserId(userId);
    return user?.isPremium || false;
  } catch (error) {
    console.error('Error checking user premium status:', error);
    return false;
  }
}

/**
 * Get user's subscription details
 */
export async function getUserSubscriptionDetails(userId: string): Promise<{
  isPremium: boolean;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: number;
  stripeSubscriptionId?: string;
  premiumActivatedAt?: number | null;
} | null> {
  try {
    const user = await getUserByUserId(userId);
    if (!user) {
      return null;
    }

    return {
      isPremium: user.isPremium,
      subscriptionStatus: user.subscriptionStatus,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
      stripeSubscriptionId: user.stripeSubscriptionId,
      premiumActivatedAt: user.premiumActivatedAt,
    };
  } catch (error) {
    console.error('Error getting user subscription details:', error);
    return null;
  }
}

/**
 * Create index for better performance
 */
export async function createIndexes(): Promise<void> {
  try {
    const collection = await getUsersCollection();

    await collection.createIndex({ userId: 1 }, { unique: true });
    await collection.createIndex({ email: 1 });
    await collection.createIndex({ stripeCustomerId: 1 });
    await collection.createIndex({ stripeSubscriptionId: 1 });
    await collectionIndex({ isPremium: 1 });
    await collectionIndex({ subscriptionStatus: 1 });

    console.log('✅ User collection indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  }
}

// Helper function for creating index (if not available in older MongoDB versions)
async function collectionIndex(collection: Collection<UserRecord>, index: any, options?: any): Promise<void> {
  try {
    await collection.createIndex(index, options);
  } catch (error: any) {
    if (error.code === 11000) {
      // Index already exists, which is fine
      return;
    }
    throw error;
  }
}