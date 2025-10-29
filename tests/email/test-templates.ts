import { describe, it, expect, beforeEach } from '@jest/globals';
import { EnhancedEmailTemplates, WeeklyInsightData, MonthlyReportData, MarketingEmailData } from '@/lib/email-templates';

describe('Email Templates', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('Weekly Insights Template', () => {
    const mockWeeklyData: WeeklyInsightData = {
      userName: 'John Doe',
      totalSpending: 1500.50,
      spendingChange: -12.5,
      topCategories: [
        { name: 'Groceries', amount: 450.25, percentage: 30 },
        { name: 'Transport', amount: 300.15, percentage: 20 },
        { name: 'Entertainment', amount: 225.10, percentage: 15 }
      ],
      budgetAlerts: [
        { category: 'Entertainment', spent: 225.10, budget: 200, percentage: 112.5 }
      ],
      savingsRate: 15.2,
      weeklyTip: 'Consider reducing entertainment expenses to stay within budget.',
      periodStart: 'Jan 01',
      periodEnd: 'Jan 07, 2024'
    };

    it('should generate weekly insights email content', () => {
      const emailContent = EnhancedEmailTemplates.weeklyInsights(mockWeeklyData);

      expect(emailContent.subject).toBe('Your Weekly Financial Insights - Jan 07, 2024');
      expect(emailContent.html).toContain('Hello John Doe!');
      expect(emailContent.html).toContain('€1,500.50');
      expect(emailContent.html).toContain('-12.5%');
      expect(emailContent.html).toContain('Groceries');
      expect(emailContent.html).toContain('€450.25');
      expect(emailContent.html).toContain('30%');
      expect(emailContent.html).toContain('Budget Alerts');
      expect(emailContent.html).toContain('Entertainment');
      expect(emailContent.html).toContain('15.2%');
      expect(emailContent.html).toContain('http://localhost:3000/dashboard');
      expect(emailContent.html).toContain('http://localhost:3000/profile');
    });

    it('should generate text version of weekly insights', () => {
      const emailContent = EnhancedEmailTemplates.weeklyInsights(mockWeeklyData);

      expect(emailContent.text).toContain('Hello John Doe');
      expect(emailContent.text).toContain('€1,500.50');
      expect(emailContent.text).toContain('decreased by 12.5%');
      expect(emailContent.text).toContain('Groceries: €450.25 (30%)');
      expect(emailContent.text).toContain('Savings Rate: 15.2%');
      expect(emailContent.text).toContain('http://localhost:3000/dashboard');
    });

    it('should handle empty budget alerts', () => {
      const dataWithoutAlerts = {
        ...mockWeeklyData,
        budgetAlerts: []
      };

      const emailContent = EnhancedEmailTemplates.weeklyInsights(dataWithoutAlerts);

      expect(emailContent.html).not.toContain('Budget Alerts');
      expect(emailContent.html).not.toContain('⚠️');
    });

    it('should handle missing user name', () => {
      const dataWithoutName = {
        ...mockWeeklyData,
        userName: ''
      };

      const emailContent = EnhancedEmailTemplates.weeklyInsights(dataWithoutName);

      expect(emailContent.html).toContain('Hello!');
      expect(emailContent.text).toContain('Hello there');
    });
  });

  describe('Monthly Report Template', () => {
    const mockMonthlyData: MonthlyReportData = {
      userName: 'Jane Smith',
      month: 'January',
      year: 2024,
      totalIncome: 5000.00,
      totalExpenses: 3200.75,
      netSavings: 1799.25,
      savingsRate: 36.0,
      topExpenseCategories: [
        { name: 'Rent/Mortgage', amount: 1200.00, percentage: 37.5 },
        { name: 'Groceries', amount: 600.30, percentage: 18.8 },
        { name: 'Utilities', amount: 250.45, percentage: 7.8 }
      ],
      budgetPerformance: [
        { category: 'Groceries', budget: 500, spent: 600.30, status: 'over', percentage: 120.1 },
        { category: 'Entertainment', budget: 200, spent: 150.00, status: 'under', percentage: 75.0 },
        { category: 'Transport', budget: 300, spent: 295.50, status: 'on_track', percentage: 98.5 }
      ],
      insights: [
        'Excellent savings rate! You\'re building a strong financial foundation.',
        'You went over budget in 1 category. Consider adjusting your budget or spending habits.',
        'Rent/Mortgage makes up over half of your spending. Review this area for potential savings.'
      ],
      monthlyTip: 'Your high savings rate is excellent! Consider investing some of your savings to help them grow through compound interest.'
    };

    it('should generate monthly report email content', () => {
      const emailContent = EnhancedEmailTemplates.monthlyReport(mockMonthlyData);

      expect(emailContent.subject).toBe('Monthly Financial Report - January 2024');
      expect(emailContent.html).toContain('Hello Jane Smith!');
      expect(emailContent.html).toContain('January 2024 Financial Report');
      expect(emailContent.html).toContain('€5,000');
      expect(emailContent.html).toContain('€3,201');
      expect(emailContent.html).toContain('€1,799');
      expect(emailContent.html).toContain('36.0%');
      expect(emailContent.html).toContain('Rent/Mortgage');
      expect(emailContent.html).toContain('€1,200');
      expect(emailContent.html).toContain('37.5%');
      expect(emailContent.html).toContain('Over');
      expect(emailContent.html).toContain('Under');
      expect(emailContent.html).toContain('On Track');
      expect(emailContent.html).toContain('Excellent savings rate!');
      expect(emailContent.html).toContain('http://localhost:3000/dashboard');
    });

    it('should generate text version of monthly report', () => {
      const emailContent = EnhancedEmailTemplates.monthlyReport(mockMonthlyData);

      expect(emailContent.text).toContain('Hello Jane Smith');
      expect(emailContent.text).toContain('January 2024 Financial Report');
      expect(emailContent.text).toContain('Income: €5,000.00');
      expect(emailContent.text).toContain('Expenses: €3,200.75');
      expect(emailContent.text).toContain('Net Savings: €1,799.25');
      expect(emailContent.text).toContain('Savings Rate: 36.0%');
      expect(emailContent.text).toContain('1. Rent/Mortgage: €1,200.00 (37.5%)');
      expect(emailContent.text).toContain('over budget');
      expect(emailContent.text).toContain('under budget');
      expect(emailContent.text).toContain('on track');
    });

    it('should handle negative net savings', () => {
      const dataWithNegativeSavings = {
        ...mockMonthlyData,
        netSavings: -200.50,
        savingsRate: -4.0
      };

      const emailContent = EnhancedEmailTemplates.monthlyReport(dataWithNegativeSavings);

      expect(emailContent.html).toContain('€-200');
      expect(emailContent.html).toContain('€-200'); // The negative value should appear
    });

    it('should handle empty insights array', () => {
      const dataWithoutInsights = {
        ...mockMonthlyData,
        insights: []
      };

      const emailContent = EnhancedEmailTemplates.monthlyReport(dataWithoutInsights);

      expect(emailContent.html).toContain('Key Insights');
      // Should not crash when insights array is empty
    });
  });

  describe('Marketing Email Templates', () => {
    const mockMarketingData: MarketingEmailData = {
      userName: 'Alice Johnson',
      campaignType: 'feature_announcement',
      subject: '🎉 New Feature: Enhanced Analytics Dashboard',
      content: {
        headline: 'Track Your Finances Like Never Before',
        mainMessage: 'We\'ve just launched powerful new analytics features to help you better understand your spending patterns.',
        features: [
          'Interactive spending charts',
          'Budget progress tracking',
          'Trend analysis'
        ],
        ctaText: 'Explore New Features',
        ctaUrl: 'http://localhost:3000/dashboard'
      }
    };

    it('should generate feature announcement email', () => {
      const emailContent = EnhancedEmailTemplates.marketing.featureAnnouncement(mockMarketingData);

      expect(emailContent.subject).toBe('🎉 New Feature: Enhanced Analytics Dashboard');
      expect(emailContent.html).toContain('Hello Alice Johnson!');
      expect(emailContent.html).toContain('Track Your Finances Like Never Before');
      expect(emailContent.html).toContain('Interactive spending charts');
      expect(emailContent.html).toContain('Budget progress tracking');
      expect(emailContent.html).toContain('Trend analysis');
      expect(emailContent.html).toContain('Explore New Features');
      expect(emailContent.html).toContain('http://localhost:3000/dashboard');
      expect(emailContent.html).toContain('http://localhost:3000/profile');
    });

    it('should generate financial tip email', () => {
      const financialTipData: MarketingEmailData = {
        campaignType: 'financial_tip',
        subject: '💡 Weekly Financial Tip: Smart Saving Strategies',
        content: {
          headline: 'Boost Your Savings with These Simple Tips',
          mainMessage: 'Small changes in your daily habits can lead to significant savings over time.',
          features: [
            'Automate your savings',
            'Use the 24-hour rule',
            'Review subscriptions'
          ],
          ctaText: 'Read More Financial Tips',
          ctaUrl: 'http://localhost:3000/dashboard'
        }
      };

      const emailContent = EnhancedEmailTemplates.marketing.financialTip(financialTipData);

      expect(emailContent.subject).toBe('💡 Weekly Financial Tip: Smart Saving Strategies');
      expect(emailContent.html).toContain('Hello there!'); // No user name provided
      expect(emailContent.html).toContain('💡 Boost Your Savings with These Simple Tips');
      expect(emailContent.html).toContain('Automate your savings');
      expect(emailContent.html).toContain('Read More Financial Tips');
      expect(emailContent.html).toContain('http://localhost:3000/dashboard');
    });

    it('should handle marketing email without user name', () => {
      const dataWithoutName = {
        ...mockMarketingData,
        userName: undefined
      };

      const emailContent = EnhancedEmailTemplates.marketing.featureAnnouncement(dataWithoutName);

      expect(emailContent.html).toContain('Hello!');
      expect(emailContent.text).toContain('Hello there');
    });

    it('should handle marketing email without features list', () => {
      const dataWithoutFeatures = {
        ...mockMarketingData,
        content: {
          ...mockMarketingData.content,
          features: undefined
        }
      };

      const emailContent = EnhancedEmailTemplates.marketing.featureAnnouncement(dataWithoutFeatures);

      expect(emailContent.html).toContain('Hello Alice Johnson!');
      expect(emailContent.html).toContain('Track Your Finances Like Never Before');
      // Should not contain features section
      expect(emailContent.html).not.toContain('✨ What\'s New:');
    });
  });

  describe('Template Edge Cases', () => {
    it('should handle zero values correctly', () => {
      const weeklyDataWithZeros: WeeklyInsightData = {
        userName: 'Test User',
        totalSpending: 0,
        spendingChange: 0,
        topCategories: [],
        budgetAlerts: [],
        savingsRate: 0,
        weeklyTip: 'Start tracking your expenses to build better financial habits.',
        periodStart: 'Jan 01',
        periodEnd: 'Jan 07, 2024'
      };

      const emailContent = EnhancedEmailTemplates.weeklyInsights(weeklyDataWithZeros);

      expect(emailContent.html).toContain('€0.00');
      expect(emailContent.html).toContain('0.0%');
    });

    it('should handle very large numbers correctly', () => {
      const monthlyDataWithLargeNumbers: MonthlyReportData = {
        userName: 'High Earner',
        month: 'December',
        year: 2024,
        totalIncome: 50000.00,
        totalExpenses: 25000.00,
        netSavings: 25000.00,
        savingsRate: 50.0,
        topExpenseCategories: [
          { name: 'Luxury', amount: 10000.00, percentage: 40 }
        ],
        budgetPerformance: [],
        insights: ['Excellent high-income savings rate!'],
        monthlyTip: 'Consider diversifying your investment portfolio with your high savings rate.'
      };

      const emailContent = EnhancedEmailTemplates.monthlyReport(monthlyDataWithLargeNumbers);

      expect(emailContent.html).toContain('€50,000');
      expect(emailContent.html).toContain('€25,000');
      expect(emailContent.html).toContain('€10,000');
    });

    it('should handle special characters in content', () => {
      const marketingDataWithSpecialChars: MarketingEmailData = {
        campaignType: 'financial_tip',
        subject: 'Special Characters Test: é, ñ, ü, €, £',
        content: {
          headline: 'Test with special chars: café, naïve, résumé',
          mainMessage: 'Currency symbols: €100, £50, ¥2000',
          features: ['Feature with "quotes"', 'Feature with &ampersand&', 'Feature with <brackets>'],
          ctaText: 'Click here & enjoy!',
          ctaUrl: 'http://localhost:3000/dashboard?test=value&other=data'
        }
      };

      const emailContent = EnhancedEmailTemplates.marketing.financialTip(marketingDataWithSpecialChars);

      expect(emailContent.subject).toContain('é, ñ, ü, €, £');
      expect(emailContent.html).toContain('café, naïve, résumé');
      expect(emailContent.html).toContain('€100, £50, ¥2000');
      expect(emailContent.html).toContain('Click here & enjoy!');
    });
  });
});