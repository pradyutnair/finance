/**
 * Appwrite Users API
 */

import { Client, Users } from 'node-appwrite';

export async function listUserIds() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID || '')
    .setKey(process.env.APPWRITE_API_KEY || '');

  const users = new Users(client);

  try {
    const response = await users.list();
    return response.users.map(u => u.$id);
  } catch (error) {
    console.error('Error fetching users from Appwrite:', error);
    return [];
  }
}

