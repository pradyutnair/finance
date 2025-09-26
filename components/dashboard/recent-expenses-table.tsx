"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const recentExpenses = [
  {
    id: 1,
    description: "Grocery Shopping",
    amount: -85.32,
    category: "Food & Drink",
    date: "2024-04-12",
    status: "completed",
  },
  {
    id: 2,
    description: "Gas Station",
    amount: -45.20,
    category: "Transport",
    date: "2024-04-11",
    status: "completed",
  },
  {
    id: 3,
    description: "Coffee Shop",
    amount: -12.50,
    category: "Food & Drink",
    date: "2024-04-11",
    status: "completed",
  },
  {
    id: 4,
    description: "Online Shopping",
    amount: -156.78,
    category: "Shopping",
    date: "2024-04-10",
    status: "completed",
  },
  {
    id: 5,
    description: "Subscription Service",
    amount: -9.99,
    category: "Shopping",
    date: "2024-04-09",
    status: "pending",
  },
]


export function RecentExpensesTable() {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Recent Expenses</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="space-y-1">
          {recentExpenses.map((expense, index) => (
            <div 
              key={expense.id} 
              className={`flex ml-2 items-center justify-between p-3 hover:bg-muted/50 transition-colors ${
                index === recentExpenses.length - 1 ? '' : 'border-b border-border/50'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{expense.description}</p>
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ 
                      backgroundColor: expense.category === 'Food & Drink' ? '#f97316' :
                                     expense.category === 'Transport' ? '#3b82f6' :
                                     expense.category === 'Shopping' ? '#8b5cf6' : '#6b7280'
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(expense.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-mono text-sm font-medium text-red-600 dark:text-gray-200">
                  -${Math.abs(expense.amount).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
