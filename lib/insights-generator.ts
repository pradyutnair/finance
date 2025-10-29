import { databases, DATABASE_ID, TRANSACTIONS_COLLECTION_ID, PREFERENCES_BUDGETS_COLLECTION_ID } from './appwrite';
import { WeeklyInsightData, MonthlyReportData } from './email-templates';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format } from 'date-fns';

export interface Transaction {
  $id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'income' | 'expense';
  merchantName?: string;
  createdAt: string;
}

export interface BudgetData {
  category: string;
  amount: number;
  period: 'weekly' | 'monthly';
}

export interface FinancialMetrics {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  spendingByCategory: Record<string, number>;
  transactionCount: number;
  averageTransactionSize: number;
}

export class InsightsGenerator {
  private static instance: InsightsGenerator;

  public static getInstance(): InsightsGenerator {
    if (!InsightsGenerator.instance) {
      InsightsGenerator.instance = new InsightsGenerator();
    }
    return InsightsGenerator.instance;
  }

  /**
   * Get user transactions for a specific date range
   */
  private async getUserTransactions(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<Transaction[]> {
    try {
      // Query transactions for the user within the date range
      const response = await databases.listDocuments(
        DATABASE_ID,
        TRANSACTIONS_COLLECTION_ID,
        [
          // Filter by user ID
          `userId=${userId}`,
          // Filter by date range (this assumes Appwrite supports date filtering)
          `date>=${startDate}`,
          `date<=${endDate}`,
          // Limit results to prevent performance issues
          'limit=1000'
        ]
      );

      return response.documents as Transaction[];
    } catch (error) {
      console.error(`Error fetching transactions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Get user budgets for categories
   */
  private async getUserBudgets(userId: string): Promise<BudgetData[]> {
    try {
      const preferences = await databases.getDocument(
        DATABASE_ID,
        PREFERENCES_BUDGETS_COLLECTION_ID,
        userId
      );

      // Extract budgets from preferences - this structure might need adjustment
      // based on how budgets are stored in your preferences
      const budgets: BudgetData[] = [];

      if (preferences.budgets) {
        for (const [category, budgetData] of Object.entries(preferences.budgets)) {
          if (typeof budgetData === 'object' && budgetData !== null) {
            const budget = budgetData as any;
            budgets.push({
              category,
              amount: budget.amount || 0,
              period: budget.period || 'monthly'
            });
          }
        }
      }

      return budgets;
    } catch (error) {
      console.error(`Error fetching budgets for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Calculate financial metrics for a set of transactions
   */
  private calculateFinancialMetrics(transactions: Transaction[]): FinancialMetrics {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const expenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const netSavings = income - expenses;
    const savingsRate = income > 0 ? (netSavings / income) * 100 : 0;

    const spendingByCategory: Record<string, number> = {};
    let expenseCount = 0;
    let totalExpenseAmount = 0;

    transactions
      .filter(t => t.type === 'expense')
      .forEach(transaction => {
        const category = transaction.category || 'Uncategorized';
        spendingByCategory[category] = (spendingByCategory[category] || 0) + Math.abs(transaction.amount);
        expenseCount++;
        totalExpenseAmount += Math.abs(transaction.amount);
      });

    const averageTransactionSize = expenseCount > 0 ? totalExpenseAmount / expenseCount : 0;

    return {
      totalIncome: income,
      totalExpenses: expenses,
      netSavings,
      savingsRate,
      spendingByCategory,
      transactionCount: transactions.length,
      averageTransactionSize
    };
  }

  /**
   * Generate weekly insights for a user
   */
  async generateWeeklyInsights(userId: string, userName?: string): Promise<WeeklyInsightData | null> {
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });

      // Get current week and last week transactions
      const currentWeekTransactions = await this.getUserTransactions(
        userId,
        format(weekStart, 'yyyy-MM-dd'),
        format(weekEnd, 'yyyy-MM-dd')
      );

      const lastWeekTransactions = await this.getUserTransactions(
        userId,
        format(lastWeekStart, 'yyyy-MM-dd'),
        format(lastWeekEnd, 'yyyy-MM-dd')
      );

      if (currentWeekTransactions.length === 0) {
        return null;
      }

      // Calculate metrics
      const currentMetrics = this.calculateFinancialMetrics(currentWeekTransactions);
      const lastWeekMetrics = this.calculateFinancialMetrics(lastWeekTransactions);

      // Calculate spending change
      const spendingChange = lastWeekMetrics.totalExpenses > 0
        ? ((currentMetrics.totalExpenses - lastWeekMetrics.totalExpenses) / lastWeekMetrics.totalExpenses) * 100
        : 0;

      // Get top spending categories
      const topCategories = Object.entries(currentMetrics.spendingByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: currentMetrics.totalExpenses > 0 ? (amount / currentMetrics.totalExpenses) * 100 : 0
        }));

      // Get budgets and check for alerts
      const budgets = await this.getUserBudgets(userId);
      const budgetAlerts = [];

      for (const budget of budgets.filter(b => b.period === 'weekly')) {
        const spent = currentMetrics.spendingByCategory[budget.category] || 0;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        if (percentage >= 80) { // Alert if 80% or more of budget is used
          budgetAlerts.push({
            category: budget.category,
            spent,
            budget: budget.amount,
            percentage
          });
        }
      }

      // Generate personalized tip
      const weeklyTip = this.generateWeeklyTip(currentMetrics, topCategories, budgetAlerts);

      return {
        userName: userName || '',
        totalSpending: currentMetrics.totalExpenses,
        spendingChange,
        topCategories,
        budgetAlerts,
        savingsRate: currentMetrics.savingsRate,
        weeklyTip,
        periodStart: format(weekStart, 'MMM dd'),
        periodEnd: format(weekEnd, 'MMM dd, yyyy')
      };
    } catch (error) {
      console.error(`Error generating weekly insights for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Generate monthly report for a user
   */
  async generateMonthlyReport(userId: string, userName?: string): Promise<MonthlyReportData | null> {
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Get current month transactions
      const currentMonthTransactions = await this.getUserTransactions(
        userId,
        format(monthStart, 'yyyy-MM-dd'),
        format(monthEnd, 'yyyy-MM-dd')
      );

      if (currentMonthTransactions.length === 0) {
        return null;
      }

      // Calculate metrics
      const currentMetrics = this.calculateFinancialMetrics(currentMonthTransactions);

      // Get top expense categories
      const topExpenseCategories = Object.entries(currentMetrics.spendingByCategory)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: currentMetrics.totalExpenses > 0 ? (amount / currentMetrics.totalExpenses) * 100 : 0
        }));

      // Get budgets and check performance
      const budgets = await this.getUserBudgets(userId);
      const budgetPerformance = [];

      for (const budget of budgets.filter(b => b.period === 'monthly')) {
        const spent = currentMetrics.spendingByCategory[budget.category] || 0;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        let status: 'under' | 'over' | 'on_track';
        if (percentage > 100) {
          status = 'over';
        } else if (percentage < 80) {
          status = 'under';
        } else {
          status = 'on_track';
        }

        budgetPerformance.push({
          category: budget.category,
          budget: budget.amount,
          spent,
          status,
          percentage
        });
      }

      // Generate insights
      const insights = this.generateMonthlyInsights(currentMetrics, topExpenseCategories, budgetPerformance);

      // Generate monthly tip
      const monthlyTip = this.generateMonthlyTip(currentMetrics, budgetPerformance);

      return {
        userName: userName || '',
        month: format(now, 'MMMM'),
        year: now.getFullYear(),
        totalIncome: currentMetrics.totalIncome,
        totalExpenses: currentMetrics.totalExpenses,
        netSavings: currentMetrics.netSavings,
        savingsRate: currentMetrics.savingsRate,
        topExpenseCategories,
        budgetPerformance,
        insights,
        monthlyTip
      };
    } catch (error) {
      console.error(`Error generating monthly report for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Generate personalized weekly tip
   */
  private generateWeeklyTip(
    metrics: FinancialMetrics,
    topCategories: Array<{ name: string; amount: number; percentage: number }>,
    budgetAlerts: Array<{ category: string; spent: number; budget: number; percentage: number }>
  ): string {
    const tips = [
      "Track your expenses daily to stay within budget and reach your financial goals faster.",
      "Consider setting up automatic transfers to savings right after you receive your income.",
      "Review your subscriptions regularly - small recurring expenses can add up quickly.",
      "Try the 50/30/20 rule: 50% for needs, 30% for wants, and 20% for savings and debt repayment.",
      "Use cash for discretionary spending to help you stay more mindful of your purchases.",
      "Set specific financial goals for each month to keep yourself motivated and on track."
    ];

    // Personalized tips based on data
    if (metrics.savingsRate < 10) {
      return "Your savings rate is below 10%. Try to reduce expenses in your top spending category or increase your income to improve your financial health.";
    }

    if (budgetAlerts.length > 0) {
      return `You're close to exceeding your budget in ${budgetAlerts[0].category}. Consider postponing non-essential purchases in this category for the rest of the week.`;
    }

    if (topCategories.length > 0 && topCategories[0].percentage > 40) {
      return `${topCategories[0].name} represents ${topCategories[0].percentage.toFixed(0)}% of your spending. Consider if there are ways to reduce expenses in this area.`;
    }

    if (metrics.savingsRate > 30) {
      return "Excellent job on your savings rate! Consider investing some of your savings to help them grow over time.";
    }

    // Return a random tip if no specific recommendation
    return tips[Math.floor(Math.random() * tips.length)];
  }

  /**
   * Generate monthly insights
   */
  private generateMonthlyInsights(
    metrics: FinancialMetrics,
    topCategories: Array<{ name: string; amount: number; percentage: number }>,
    budgetPerformance: Array<{ category: string; status: 'under' | 'over' | 'on_track' }>
  ): string[] {
    const insights: string[] = [];

    // Savings insights
    if (metrics.savingsRate > 20) {
      insights.push("Excellent savings rate! You're building a strong financial foundation.");
    } else if (metrics.savingsRate < 5) {
      insights.push("Consider ways to increase your savings rate to build an emergency fund and work towards your goals.");
    } else {
      insights.push("Good progress on savings. Small increases can make a big difference over time.");
    }

    // Spending insights
    if (topCategories.length > 0) {
      const topCategory = topCategories[0];
      if (topCategory.percentage > 50) {
        insights.push(`${topCategory.name} makes up over half of your spending. Review this category for potential savings.`);
      }
    }

    // Budget performance insights
    const overBudgetCategories = budgetPerformance.filter(b => b.status === 'over');
    if (overBudgetCategories.length > 0) {
      insights.push(`You went over budget in ${overBudgetCategories.length} category${overBudgetCategories.length > 1 ? 's' : ''}. Consider adjusting your budget or spending habits.`);
    } else if (budgetPerformance.length > 0) {
      insights.push("Great job staying within your budgets this month!");
    }

    // Income insights
    if (metrics.totalIncome > 0 && metrics.netSavings < 0) {
      insights.push("You spent more than you earned this month. Review your expenses and consider ways to increase income or reduce spending.");
    }

    return insights;
  }

  /**
   * Generate personalized monthly tip
   */
  private generateMonthlyTip(
    metrics: FinancialMetrics,
    budgetPerformance: Array<{ category: string; status: 'under' | 'over' | 'on_track' }>
  ): string {
    if (metrics.netSavings < 0) {
      return "This month you spent more than you earned. Focus on essential expenses next month and look for areas to cut back.";
    }

    if (metrics.savingsRate < 10) {
      return "Aim to save at least 10% of your income. Start small if needed - even 1-2% can build momentum.";
    }

    const overBudgetCount = budgetPerformance.filter(b => b.status === 'over').length;
    if (overBudgetCount > 2) {
      return "You went over budget in several categories. Consider setting more realistic budgets or finding ways to reduce expenses.";
    }

    if (metrics.savingsRate > 25) {
      return "Excellent savings rate! Consider investing some of your savings to help them grow through compound interest.";
    }

    return "Review your financial goals and adjust your budget to align with what's most important to you.";
  }
}

// Export singleton instance
export const insightsGenerator = InsightsGenerator.getInstance();