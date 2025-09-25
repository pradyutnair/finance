'use client';

import { useState } from 'react';

interface SandboxTestButtonProps {
  userId: string;
}

export function SandboxTestButton({ userId }: SandboxTestButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSandboxTest = async () => {
    setIsConnecting(true);
    
    try {
      // Create requisition with sandbox institution
      const requisitionResponse = await fetch('/api/gocardless/requisitions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          institutionId: 'SANDBOXFINANCE_SFIN0000',
          redirect: `${window.location.origin}/dashboard/banks/callback`,
          reference: `sandbox_${userId}_${Date.now()}`,
          userLanguage: 'en',
        })
      });

      if (!requisitionResponse.ok) {
        const errorData = await requisitionResponse.json();
        throw new Error(errorData.error || 'Failed to create sandbox connection');
      }

      const requisitionData = await requisitionResponse.json();
      
      // Redirect to sandbox bank authentication
      if (requisitionData.link) {
        window.location.href = requisitionData.link;
      } else {
        throw new Error('No sandbox consent link received');
      }
    } catch (error: any) {
      console.error('Sandbox test error:', error);
      alert(`Sandbox test failed: ${error.message}`);
      setIsConnecting(false);
    }
  };

  return (
    <div className="glass-card p-6 mb-6 border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
          <span className="text-2xl">🧪</span>
        </div>
        <div>
          <h3 className="text-white font-semibold">Sandbox Testing</h3>
          <p className="text-gray-300 text-sm">Test your integration without using live connections</p>
        </div>
      </div>
      
      <button
        onClick={handleSandboxTest}
        disabled={isConnecting}
        className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isConnecting
            ? 'bg-yellow-600/50 text-yellow-200 cursor-not-allowed'
            : 'bg-yellow-500 text-black hover:bg-yellow-400 hover:scale-105'
        }`}
      >
        {isConnecting ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-yellow-800 border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting to Sandbox...</span>
          </div>
        ) : (
          'Test with Sandbox Finance'
        )}
      </button>
      
      <div className="mt-4 text-xs text-gray-400">
        <p>• Uses test data only - no real bank credentials needed</p>
        <p>• Enter any values for User ID and Code Generator</p>
        <p>• Safe for development and testing</p>
      </div>
    </div>
  );
}
