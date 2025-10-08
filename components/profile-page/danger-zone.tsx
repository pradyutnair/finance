import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2, ShieldX, LockKeyhole } from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * DangerZoneDeleteAccount
 * -------------------------------------------------------------
 * A polished, accessible "Delete Account" section with:
 * - Strong visual hierarchy and clear warning copy
 * - Double-confirmation (checkbox + typing "DELETE")
 * - Optional reason textarea for feedback
 * - Async-safe confirm handler + disabled states
 * - Keyboard and screen-reader friendly markup
 * - Small animations for affordance
 *
 * Usage:
 * <DangerZoneDeleteAccount onConfirm={handleAccountDeletion} loading={isDeleting} userEmail={email} />
 */

export type DangerZoneDeleteAccountProps = {
  onConfirm: (payload: { reason?: string }) => Promise<void> | void;
  loading?: boolean;
  userEmail?: string;
  supportEmail?: string; // e.g., "support@yourapp.com"
};

export default function DangerZoneDeleteAccount({
  onConfirm,
  loading = false,
  userEmail,
  supportEmail,
}: DangerZoneDeleteAccountProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [ack, setAck] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = ack && confirmText.trim().toUpperCase() === "DELETE" && !loading;

  async function handleConfirm() {
    try {
      setError(null);
      await onConfirm({ reason: reason.trim() || undefined });
      setConfirmOpen(false);
      // Optional: reset local confirmations after success
      setAck(false);
      setConfirmText("");
      setReason("");
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <section aria-labelledby="danger-zone-heading" className="mt-2">
      {/* Account Deletion - Danger Zone */}
      <Accordion type="single" collapsible>
        <AccordionItem value="delete-account" className="border-none">
          <AccordionTrigger className="p-4 rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/30 hover:no-underline [&[data-state=open]>svg]:rotate-180">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" aria-hidden />
              <div className="text-left">
                <p id="danger-zone-heading" className="font-semibold text-red-800 dark:text-red-200">
                  Delete Account
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 font-normal">This action cannot be undone</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 space-y-4">
            <Card className="rounded-3xl border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-all duration-300">
              {/* <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <Trash2 className="w-5 h-5" aria-hidden />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-[#40221a]/60 dark:text-white/60">
                  Permanently delete your account and all associated data.
                </CardDescription>
              </CardHeader> */}
              <CardContent className="space-y-4">
                <Alert className="rounded-2xl border-red-300 dark:border-red-700 bg-red-100/60 dark:bg-red-900/30">
                  <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" aria-hidden />
                  <AlertDescription className="text-red-900 dark:text-red-100">
                    All your data will be permanently deleted and cannot be recovered.
                  </AlertDescription>
                </Alert>

                {/* Consequences list for clarity */}
                <ul className="list-disc pl-6 text-sm text-red-900/80 dark:text-red-100/80 space-y-1">
                  <li>Profile, settings, and preferences removed</li>
                  <li>Data and logs erased</li>
                  <li>Sessions terminated</li>
                </ul>

                {/* Small helper text */}
                {userEmail && (
                  <p className="text-xs text-muted-foreground">
                    You are currently signed in as <span className="font-medium">{userEmail}</span>.
                  </p>
                )}

                <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="open-delete-dialog"
                      variant="destructive"
                      className="w-full rounded-xl mt-2 bg-red-600 hover:bg-red-700 dark:bg-red-700/50 dark:hover:bg-red-800/50"
                      size="lg"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" aria-hidden />
                      Delete Account Permanently
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ShieldX className="w-5 h-5" aria-hidden />
                        Confirm permanent deletion
                      </DialogTitle>
                      <DialogDescription>
                        This will immediately and irreversibly delete your account and all data.
                      </DialogDescription>
                    </DialogHeader>

                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      <div className="flex items-start gap-3 rounded-xl border p-3 bg-muted/30">
                        <LockKeyhole className="w-4 h-4 mt-0.5" aria-hidden />
                        <p className="text-sm text-muted-foreground">
                          For your security, please acknowledge and confirm. This cannot be undone.
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Checkbox id="acknowledge" checked={ack} onCheckedChange={(v) => setAck(Boolean(v))} />
                        <Label htmlFor="acknowledge" className="text-sm leading-snug">
                          I understand all data will be permanently deleted.
                        </Label>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="confirm-text">Type <span className="font-semibold">DELETE</span> to confirm</Label>
                        <Input
                          id="confirm-text"
                          placeholder="DELETE"
                          autoComplete="off"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          aria-invalid={!canDelete && confirmText.length > 0}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="reason" className="flex items-center gap-2">
                          Optional feedback
                          <span className="text-xs text-muted-foreground">(helps us improve)</span>
                        </Label>
                        <Textarea
                          id="reason"
                          placeholder="Tell us why you’re leaving… (optional)"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          rows={3}
                        />
                      </div>

                      {error && (
                        <p role="alert" aria-live="assertive" className="text-sm text-red-600 dark:text-red-400">
                          {error}
                        </p>
                      )}
                    </motion.div>

                    <DialogFooter className="gap-2 sm:gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setConfirmOpen(false)}
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                      <Button
                        data-testid="confirm-delete"
                        type="button"
                        variant="destructive"
                        className="rounded-xl"
                        onClick={handleConfirm}
                        disabled={!canDelete}
                      >
                        {loading ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-b-transparent" />
                            Deleting…
                          </span>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-2" aria-hidden />
                            Permanently delete
                          </>
                        )}
                      </Button>
                    </DialogFooter>

                    {supportEmail && (
                      <p className="pt-2 text-xs text-muted-foreground text-center">
                        Need help instead? Contact <a className="underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
                      </p>
                    )}
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
