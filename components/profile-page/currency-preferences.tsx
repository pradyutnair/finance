"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Plus, X, Save, Loader2 } from 'lucide-react'
import { useCurrency } from '@/contexts/currency-context'
import { toast } from 'sonner'

interface CurrencyPreferencesProps {
  preferredCurrencies: string[]
  onCurrencyPreferencesUpdate: (currencies: string[]) => void
}

export function CurrencyPreferences({ 
  preferredCurrencies, 
  onCurrencyPreferencesUpdate 
}: CurrencyPreferencesProps) {
  const { supportedCurrencies, baseCurrency, setBaseCurrency, getCurrencySymbol } = useCurrency()
  const [selectedCurrencies, setSelectedCurrencies] = useState(preferredCurrencies)
  const [selectedBase, setSelectedBase] = useState(baseCurrency)
  const [newCurrency, setNewCurrency] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Get available currencies that aren't already selected
  const availableCurrencies = supportedCurrencies.filter(
    currency => !selectedCurrencies.includes(currency)
  )

  const handleAddCurrency = () => {
    if (!newCurrency || selectedCurrencies.includes(newCurrency)) return
    
    const updated = [...selectedCurrencies, newCurrency]
    setSelectedCurrencies(updated)
    setNewCurrency('')
  }

  const handleRemoveCurrency = (currency: string) => {
    if (selectedCurrencies.length <= 1) {
      toast.error('You must have at least one preferred currency')
      return
    }
    
    const updated = selectedCurrencies.filter(c => c !== currency)
    setSelectedCurrencies(updated)
    
    // If we removed the base currency, set the first remaining one as base
    if (currency === selectedBase && updated.length > 0) {
      setSelectedBase(updated[0])
    }
  }

  const handleSave = async () => {
    if (selectedCurrencies.length === 0) {
      toast.error('You must select at least one currency')
      return
    }

    setIsLoading(true)

    try {
      await onCurrencyPreferencesUpdate(selectedCurrencies)
      // Apply base currency immediately across the app
      setBaseCurrency(selectedBase)
      toast.success('Currency preferences updated successfully!')
    } catch (error: any) {
      console.error('Currency preferences update error:', error)
      toast.error(error.message || 'Failed to update currency preferences')
      setSelectedCurrencies(preferredCurrencies) // Reset on error
      setSelectedBase(baseCurrency)
    } finally {
      setIsLoading(false)
    }
  }

  const hasChanges =
    JSON.stringify(selectedCurrencies.sort()) !== JSON.stringify(preferredCurrencies.sort()) ||
    selectedBase !== baseCurrency

  return (
    <Card>
      <CardHeader>
        <CardTitle>Currency Preferences</CardTitle>
        <CardDescription>
          Pick your preferred currencies and set your base currency.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base Currency */}
        <div className="space-y-2">
          <Label>Base Currency</Label>
          <Select value={selectedBase} onValueChange={setSelectedBase}>
            <SelectTrigger>
              <SelectValue placeholder="Select base currency" />
            </SelectTrigger>
            <SelectContent>
              {selectedCurrencies.map(currency => (
                <SelectItem key={currency} value={currency}>
                  {getCurrencySymbol(currency)} {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Currencies */}
        <div className="space-y-2">
          <Label>Preferred Currencies</Label>
          <div className="flex flex-wrap gap-2">
            {selectedCurrencies.map(currency => (
              <Badge 
                key={currency} 
                variant={currency === baseCurrency ? "default" : "secondary"}
                className="flex items-center gap-1"
              >
                {getCurrencySymbol(currency)} {currency}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => handleRemoveCurrency(currency)}
                  disabled={selectedCurrencies.length <= 1}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>

        {/* Add New Currency */}
        {availableCurrencies.length > 0 && (
          <div className="space-y-2">
            <Label>Add Currency</Label>
            <div className="flex gap-2">
              <Select value={newCurrency} onValueChange={setNewCurrency}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a currency to add" />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map(currency => (
                    <SelectItem key={currency} value={currency}>
                      {getCurrencySymbol(currency)} {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAddCurrency}
                disabled={!newCurrency}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Save Button */}
        {hasChanges && (
          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || selectedCurrencies.length === 0}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Currency Preferences
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p>• Base currency is applied globally</p>
          <p>• Only preferred currencies appear in the header selector</p>
          <p>• You must have at least one preferred currency</p>
        </div>
      </CardContent>
    </Card>
  )
}
