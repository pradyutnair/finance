import { GDPRDashboard } from "@/components/gdpr/gdpr-dashboard";
import { AuthGuard } from "@/components/auth-guard";

export default function GDPRPage() {
  return (
    <AuthGuard>
      <div className="container mx-auto px-4 py-8">
        <GDPRDashboard />
      </div>
    </AuthGuard>
  );
}
