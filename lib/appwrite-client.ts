import { Client, Account, Databases, Storage, Avatars } from 'appwrite';
import { APPWRITE_CONFIG } from './config';

// Create client - in browser, Appwrite SDK automatically uses cookies for authentication
const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId);

// Note: In browser environments, the Appwrite SDK automatically sends cookies
// with requests. No explicit session token is needed when using cookies.

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const avatars = new Avatars(client);

export default client;
