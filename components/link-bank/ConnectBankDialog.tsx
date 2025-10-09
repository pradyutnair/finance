"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useInstitutions } from "@/lib/api";
import { useAccountsStore } from "@/lib/stores/accounts-store";

interface ConnectBankDialogProps {
  children: React.ReactNode;
}

// Popular European banks
const popularBanks = [
  { id: "REVOLUT_REVOGB21", name: "Revolut", country: "GB" },
  { id: "N26_NTSBDEB1", name: "N26", country: "DE" },
  { id: "ING_INGDDEFF", name: "ING", country: "DE" },
  { id: "DEUTSCHE_BANK_DEUTDEFF", name: "Deutsche Bank", country: "DE" },
];

export function ConnectBankDialog({ children }: ConnectBankDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("DE");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  
  const { data: institutions } = useInstitutions(selectedCountry);
  const { createRequisition } = useAccountsStore();

  const filteredInstitutions = Array.isArray(institutions) 
    ? institutions.filter((institution: any) =>
        institution.name.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : popularBanks;

  const handleConnectBank = async (institutionId: string) => {
    setIsCreating(true);
    try {
      const result = await createRequisition({
        institutionId,
        redirect: `${window.location.origin}/banks`,
        reference: `nexpass_${Date.now()}`,
        userLanguage: "EN",
      });
      
      if (result && typeof result === 'object' && 'link' in result) {
        window.location.href = (result as any).link;
      }
    } catch (error) {
      console.error("Failed to create requisition:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Bank Account</DialogTitle>
          <DialogDescription>
            Choose your bank to securely connect your account
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input
            placeholder="Search banks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="glass-input text-white placeholder:text-white/50"
          />
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredInstitutions.slice(0, 10).map((institution: any) => (
              <button
                key={institution.id}
                onClick={() => handleConnectBank(institution.id)}
                disabled={isCreating}
                className="w-full glass-card p-4 hover:bg-white/10 transition-colors text-left"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white font-medium">{institution.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
