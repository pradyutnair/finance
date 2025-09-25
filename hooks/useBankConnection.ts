'use client';

import { useState, useEffect } from 'react';
import { Account, Databases, Query } from 'appwrite';
import { createAppwriteClient } from '@/lib/auth';

interface BankConnection {
  $id: string;
  institutionId: string;
  institutionName: string;
  status: string;
  $createdAt: string;
  $updatedAt: string;
}

interface Requisition {
  $id: string;
  requisitionId: string;
  institutionId: string;
  institutionName: string;
  status: string;
  $createdAt: string;
  $updatedAt: string;
}

export function useBankConnection() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasConnectedBanks, setHasConnectedBanks] = useState(false);
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkBankConnections = async () => {
      try {
        const client = createAppwriteClient();
        const account = new Account(client);
        const databases = new Databases(client);

        // Get current user
        const currentUser = await account.get();
        setUser(currentUser);

        // Check for existing bank connections
        let connections: BankConnection[] = [];
        let reqs: Requisition[] = [];
        
        try {
          const connectionsResponse = await databases.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string,
            'bank_connections', // Collection ID
            [Query.equal('userId', currentUser.$id)]
          );
          connections = connectionsResponse.documents as unknown as BankConnection[];
          setBankConnections(connections);
        } catch (error) {
          console.log('Bank connections collection not available yet');
          setBankConnections([]);
        }

        // Check for existing requisitions
        try {
          const requisitionsResponse = await databases.listDocuments(
            process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID as string,
            'requisitions', // Collection ID
            [Query.equal('userId', currentUser.$id)]
          );
          reqs = requisitionsResponse.documents as unknown as Requisition[];
          setRequisitions(reqs);
        } catch (error) {
          console.log('Requisitions collection not available yet');
          setRequisitions([]);
        }

        // Determine if user has connected banks
        const hasActiveConnections = connections.some(conn => conn.status === 'active');
        const hasActiveRequisitions = reqs.some(req => req.status === 'LINKED');
        
        setHasConnectedBanks(hasActiveConnections || hasActiveRequisitions);
      } catch (error) {
        console.error('Error checking bank connections:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkBankConnections();
  }, []);

  return {
    isLoading,
    hasConnectedBanks,
    bankConnections,
    requisitions,
    user
  };
}
