"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar, Clock, CheckCircle, XCircle, TrendingUp, MoreHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useCurrency } from "@/contexts/currency-context"
import type { RecurringPattern } from "@/lib/recurring-detector"
import { toast } from "sonner"
import { getCategoryColor } from "@/lib/categories"

interface RecurringCardProps {
  pattern: RecurringPattern
}

export function RecurringCard({ pattern }: RecurringCardProps) {
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false)
  const { formatAmount } = useCurrency()

  const getFrequencyText = (frequency: RecurringPattern['frequency']) => {
    switch (frequency) {
      case 'daily':
        return 'Daily'
      case 'weekly':
        return 'Weekly'
      case 'bi_weekly':
        return 'Every 2 weeks'
      case 'monthly':
        return 'Monthly'
      case 'quarterly':
        return 'Every 3 months'
      case 'yearly':
        return 'Yearly'
      default:
        return 'Unknown'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getMerchantInitials = (name: string) => {
    const words = name.trim().split(/\s+/)
    if (words.length >= 2) {
      return words.slice(0, 2).map(w => w[0]).join('').toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }

  const handleConfirm = () => {
    // TODO: Implement client-side recurring pattern confirmation
    toast.success("Recurring pattern confirmed")
  }

  const handleDismiss = () => {
    // TODO: Implement client-side recurring pattern dismissal
    toast.success("Recurring pattern dismissed")
    setDismissDialogOpen(false)
  }

  const isNextExpectedSoon = () => {
    const nextDate = new Date(pattern.nextExpectedDate)
    const today = new Date()
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil <= 7 && daysUntil >= 0
  }

  const getNextExpectedText = () => {
    const nextDate = new Date(pattern.nextExpectedDate)
    const today = new Date()
    const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntil === 0) return "Today"
    if (daysUntil === 1) return "Tomorrow"
    if (daysUntil > 0 && daysUntil <= 7) return `In ${daysUntil} days`
    if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`

    return format(nextDate, "MMM d, yyyy")
  }

  return (
    <>
      <Card className="relative hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getMerchantInitials(pattern.counterparty)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate">
                  {pattern.counterparty}
                </CardTitle>
                <CardDescription className="text-sm truncate">
                  {pattern.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${getConfidenceColor(pattern.confidence)}`} />
                <span className="text-xs text-muted-foreground">
                  {Math.round(pattern.confidence * 100)}%
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleConfirm}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirm pattern
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setDismissDialogOpen(true)}
                    className="text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss pattern
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {formatAmount(pattern.averageAmount)}
              </span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {getFrequencyText(pattern.frequency)}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Last seen: {format(new Date(pattern.lastSeenDate), "MMM d")}</span>
            </div>
            <div className={`flex items-center gap-2 ${
              isNextExpectedSoon() ? "text-orange-600 font-medium" : "text-muted-foreground"
            }`}>
              <Clock className="h-4 w-4" />
              <span>Next: {getNextExpectedText()}</span>
            </div>
          </div>

          {pattern.category && (
            <div className="mt-3">
              <Badge
                variant="outline"
                className="text-xs gap-1"
                style={{
                  backgroundColor: `${getCategoryColor(pattern.category)}20`,
                  borderColor: getCategoryColor(pattern.category),
                  color: getCategoryColor(pattern.category)
                }}
              >
                <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: getCategoryColor(pattern.category) }} />
                {pattern.category}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={dismissDialogOpen} onOpenChange={setDismissDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss recurring pattern?</AlertDialogTitle>
            <AlertDialogDescription>
              This will dismiss the detected recurring pattern for "{pattern.counterparty}".
              You can always detect it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDismiss}
              className="bg-red-600 hover:bg-red-700"
            >
              Dismiss pattern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}