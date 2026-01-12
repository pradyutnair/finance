import { EmailContent } from './email-service';

export interface WeeklyInsightData {
  userName: string;
  totalSpending: number;
  spendingChange: number; // percentage change from last week
  topCategories: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  budgetAlerts: Array<{
    category: string;
    spent: number;
    budget: number;
    percentage: number;
  }>;
  savingsRate: number;
  weeklyTip: string;
  periodStart: string;
  periodEnd: string;
}

export interface MonthlyReportData {
  userName: string;
  month: string;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  topExpenseCategories: Array<{
    name: string;
    amount: number;
    percentage: number;
  }>;
  budgetPerformance: Array<{
    category: string;
    budget: number;
    spent: number;
    status: 'under' | 'over' | 'on_track';
    percentage: number;
  }>;
  insights: string[];
  monthlyTip: string;
}

export interface MarketingEmailData {
  userName?: string;
  campaignType: 'feature_announcement' | 'financial_tip' | 'onboarding' | 're_engagement';
  subject: string;
  content: {
    headline: string;
    mainMessage: string;
    features?: string[];
    ctaText: string;
    ctaUrl: string;
  };
}

export const EnhancedEmailTemplates = {
  // Weekly Insights Email Template
  weeklyInsights: (data: WeeklyInsightData): EmailContent => ({
    subject: `Your Weekly Financial Insights - ${data.periodEnd}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div style="background: white; border-radius: 16px; margin: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
              ${data.userName ? `Hello ${data.userName}!` : 'Hello!'}
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              Your weekly financial insights are here
            </p>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <!-- Spending Summary -->
            <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">💰 Spending Summary</h2>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                  <p style="color: #64748b; margin: 0; font-size: 14px;">Total Spending</p>
                  <p style="color: #1e293b; margin: 0; font-size: 24px; font-weight: 700;">€${data.totalSpending.toFixed(2)}</p>
                </div>
                <div style="text-align: right;">
                  <p style="color: #64748b; margin: 0; font-size: 14px;">vs Last Week</p>
                  <p style="color: ${data.spendingChange >= 0 ? '#ef4444' : '#10b981'}; margin: 0; font-size: 18px; font-weight: 600;">
                    ${data.spendingChange >= 0 ? '+' : ''}${data.spendingChange.toFixed(1)}%
                    ${data.spendingChange >= 0 ? '↑' : '↓'}
                  </p>
                </div>
              </div>
            </div>

            <!-- Top Categories -->
            <div style="margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">📊 Top Spending Categories</h2>
              ${data.topCategories.map(category => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                  <div style="flex: 1;">
                    <p style="color: #1e293b; margin: 0; font-weight: 600;">${category.name}</p>
                    <p style="color: #64748b; margin: 0; font-size: 14px;">${category.percentage}% of total</p>
                  </div>
                  <p style="color: #1e293b; margin: 0; font-weight: 700; font-size: 16px;">€${category.amount.toFixed(2)}</p>
                </div>
              `).join('')}
            </div>

            ${data.budgetAlerts.length > 0 ? `
              <!-- Budget Alerts -->
              <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
                <h2 style="color: #991b1b; margin: 0 0 15px 0; font-size: 18px;">⚠️ Budget Alerts</h2>
                ${data.budgetAlerts.map(alert => `
                  <div style="margin-bottom: 12px;">
                    <p style="color: #991b1b; margin: 0; font-weight: 600;">${alert.category}</p>
                    <p style="color: #b91c1c; margin: 0; font-size: 14px;">
                      €${alert.spent.toFixed(2)} of €${alert.budget.toFixed(2)} (${alert.percentage.toFixed(0)}%)
                    </p>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <!-- Savings Rate -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
              <h2 style="color: #166534; margin: 0 0 10px 0; font-size: 18px;">💎 Savings Rate</h2>
              <p style="color: #166534; margin: 0; font-size: 24px; font-weight: 700;">${data.savingsRate.toFixed(1)}%</p>
              <p style="color: #15803d; margin: 5px 0 0 0; font-size: 14px;">of your income saved this week</p>
            </div>

            <!-- Weekly Tip -->
            <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin: 0 0 10px 0; font-size: 18px;">💡 Weekly Tip</h2>
              <p style="color: #1e40af; margin: 0; line-height: 1.5;">${data.weeklyTip}</p>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; display: inline-block;">
                View Full Dashboard
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0; font-size: 12px;">
              This weekly report covers ${data.periodStart} to ${data.periodEnd}
            </p>
            <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 11px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" style="color: #64748b; text-decoration: none;">
                Manage email preferences
              </a> |
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/support" style="color: #64748b; text-decoration: none;">
                Support
              </a>
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Hello ${data.userName || 'there'}!

Your Weekly Financial Insights - ${data.periodEnd}

💰 Spending Summary:
Total Spending: €${data.totalSpending.toFixed(2)}
${data.spendingChange >= 0 ? 'Increased' : 'Decreased'} by ${Math.abs(data.spendingChange).toFixed(1)}% from last week

📊 Top Spending Categories:
${data.topCategories.map(cat => `${cat.name}: €${cat.amount.toFixed(2)} (${cat.percentage}%)`).join('\n')}

${data.budgetAlerts.length > 0 ? `
⚠️ Budget Alerts:
${data.budgetAlerts.map(alert => `${alert.category}: €${alert.spent.toFixed(2)} of €${alert.budget.toFixed(2)} (${alert.percentage.toFixed(0)}%)`).join('\n')}
` : ''}

💎 Savings Rate: ${data.savingsRate.toFixed(1)}%

💡 Weekly Tip: ${data.weeklyTip}

View your full dashboard at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard

---
Manage email preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`
  }),

  // Monthly Report Email Template
  monthlyReport: (data: MonthlyReportData): EmailContent => ({
    subject: `Monthly Financial Report - ${data.month} ${data.year}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
        <div style="background: white; border-radius: 16px; margin: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
              ${data.userName ? `Hello ${data.userName}!` : 'Hello!'}
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              Your ${data.month} ${data.year} Financial Report
            </p>
          </div>

          <!-- Main Content -->
          <div style="padding: 30px;">
            <!-- Financial Overview -->
            <div style="background: #f0fdf4; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
              <h2 style="color: #166534; margin: 0 0 20px 0; font-size: 20px;">📈 Financial Overview</h2>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
                <div style="text-align: center;">
                  <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">Income</p>
                  <p style="color: #166534; margin: 0; font-size: 22px; font-weight: 700;">€${data.totalIncome.toFixed(0)}</p>
                </div>
                <div style="text-align: center;">
                  <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">Expenses</p>
                  <p style="color: #dc2626; margin: 0; font-size: 22px; font-weight: 700;">€${data.totalExpenses.toFixed(0)}</p>
                </div>
                <div style="text-align: center;">
                  <p style="color: #64748b; margin: 0 0 5px 0; font-size: 14px;">Net Savings</p>
                  <p style="color: ${data.netSavings >= 0 ? '#166534' : '#dc2626'}; margin: 0; font-size: 22px; font-weight: 700;">
                    €${data.netSavings.toFixed(0)}
                  </p>
                </div>
              </div>
              <div style="margin-top: 20px; text-align: center;">
                <p style="color: #15803d; margin: 0; font-size: 18px; font-weight: 600;">
                  💰 Savings Rate: ${data.savingsRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <!-- Top Expense Categories -->
            <div style="margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">📊 Top Expense Categories</h2>
              ${data.topExpenseCategories.map((category, index) => `
                <div style="display: flex; align-items: center; margin-bottom: 15px;">
                  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; margin-right: 15px;">
                    ${index + 1}
                  </div>
                  <div style="flex: 1;">
                    <p style="color: #1e293b; margin: 0; font-weight: 600;">${category.name}</p>
                    <div style="background: #e2e8f0; border-radius: 4px; height: 8px; margin: 5px 0;">
                      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); height: 100%; border-radius: 4px; width: ${category.percentage}%;"></div>
                    </div>
                  </div>
                  <p style="color: #1e293b; margin: 0 0 0 15px; font-weight: 700; min-width: 80px; text-align: right;">
                    €${category.amount.toFixed(0)}
                  </p>
                </div>
              `).join('')}
            </div>

            <!-- Budget Performance -->
            <div style="margin-bottom: 25px;">
              <h2 style="color: #1e293b; margin: 0 0 15px 0; font-size: 20px;">🎯 Budget Performance</h2>
              ${data.budgetPerformance.map(budget => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 15px; margin-bottom: 8px; border-radius: 8px; background: ${
                  budget.status === 'over' ? '#fef2f2' :
                  budget.status === 'under' ? '#f0fdf4' : '#eff6ff'
                }; border-left: 4px solid ${
                  budget.status === 'over' ? '#ef4444' :
                  budget.status === 'under' ? '#10b981' : '#3b82f6'
                };">
                  <div style="flex: 1;">
                    <p style="color: #1e293b; margin: 0; font-weight: 600;">${budget.category}</p>
                    <p style="color: #64748b; margin: 0; font-size: 13px;">
                      €${budget.spent.toFixed(0)} of €${budget.budget.toFixed(0)}
                    </p>
                  </div>
                  <div style="text-align: right;">
                    <span style="background: ${
                      budget.status === 'over' ? '#fef2f2' :
                      budget.status === 'under' ? '#f0fdf4' : '#eff6ff'
                    }; color: ${
                      budget.status === 'over' ? '#dc2626' :
                      budget.status === 'under' ? '#059669' : '#2563eb'
                    }; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">
                      ${budget.status === 'over' ? 'Over' : budget.status === 'under' ? 'Under' : 'On Track'}
                    </span>
                    <p style="color: #64748b; margin: 5px 0 0 0; font-size: 13px;">
                      ${budget.percentage.toFixed(0)}%
                    </p>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Key Insights -->
            <div style="background: #fefce8; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
              <h2 style="color: #a16207; margin: 0 0 15px 0; font-size: 18px;">💡 Key Insights</h2>
              <ul style="color: #a16207; margin: 0; padding-left: 20px;">
                ${data.insights.map(insight => `<li style="margin-bottom: 8px;">${insight}</li>`).join('')}
              </ul>
            </div>

            <!-- Monthly Tip -->
            <div style="background: #eff6ff; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
              <h2 style="color: #1e40af; margin: 0 0 10px 0; font-size: 18px;">🎯 Monthly Tip</h2>
              <p style="color: #1e40af; margin: 0; line-height: 1.5;">${data.monthlyTip}</p>
            </div>

            <!-- CTA -->
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard"
                 style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600; display: inline-block;">
                View Full Report
              </a>
            </div>
          </div>

          <!-- Footer -->
          <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; margin: 0; font-size: 12px;">
              This monthly report covers all transactions in ${data.month} ${data.year}
            </p>
            <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 11px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" style="color: #64748b; text-decoration: none;">
                Manage email preferences
              </a> |
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/support" style="color: #64748b; text-decoration: none;">
                Support
              </a>
            </p>
          </div>
        </div>
      </div>
    `,
    text: `Hello ${data.userName || 'there'}!

Your Monthly Financial Report - ${data.month} ${data.year}

📈 Financial Overview:
Income: €${data.totalIncome.toFixed(2)}
Expenses: €${data.totalExpenses.toFixed(2)}
Net Savings: €${data.netSavings.toFixed(2)}
Savings Rate: ${data.savingsRate.toFixed(1)}%

📊 Top Expense Categories:
${data.topExpenseCategories.map((cat, i) => `${i + 1}. ${cat.name}: €${cat.amount.toFixed(2)} (${cat.percentage}%)`).join('\n')}

🎯 Budget Performance:
${data.budgetPerformance.map(budget => `${budget.category}: €${budget.spent.toFixed(0)} of €${budget.budget.toFixed(0)} (${budget.percentage.toFixed(0)}%) - ${budget.status.replace('_', ' ')}`).join('\n')}

💡 Key Insights:
${data.insights.map(insight => `• ${insight}`).join('\n')}

🎯 Monthly Tip: ${data.monthlyTip}

View your full report at ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard

---
Manage email preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`
  }),

  // Marketing Email Templates
  marketing: {
    featureAnnouncement: (data: MarketingEmailData): EmailContent => ({
      subject: data.subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: white; border-radius: 16px; margin: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                ${data.userName ? `Hello ${data.userName}!` : 'Hello!'}
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Exciting news from Nexpass
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px; font-weight: 700;">
                ${data.content.headline}
              </h2>

              <p style="color: #475569; margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">
                ${data.content.mainMessage}
              </p>

              ${data.content.features ? `
                <div style="background: #fef3c7; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="color: #92400e; margin: 0 0 15px 0; font-size: 18px;">✨ What's New:</h3>
                  <ul style="color: #92400e; margin: 0; padding-left: 20px;">
                    ${data.content.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              <!-- CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.content.ctaUrl}"
                   style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                  ${data.content.ctaText}
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; margin: 0; font-size: 11px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" style="color: #64748b; text-decoration: none;">
                  Manage email preferences
                </a> |
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/support" style="color: #64748b; text-decoration: none;">
                  Support
                </a>
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Hello ${data.userName || 'there'}!

${data.content.headline}

${data.content.mainMessage}

${data.content.features ? `\n✨ What's New:\n${data.content.features.map(f => `• ${f}`).join('\n')}` : ''}

${data.content.ctaText}: ${data.content.ctaUrl}

---
Manage email preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`
    }),

    financialTip: (data: MarketingEmailData): EmailContent => ({
      subject: data.subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: white; border-radius: 16px; margin: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
                ${data.userName ? `Hello ${data.userName}!` : 'Hello!'}
              </h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                Your weekly financial wisdom
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 30px;">
              <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px; font-weight: 700;">
                💡 ${data.content.headline}
              </h2>

              <div style="background: #ecfeff; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                <p style="color: #164e63; margin: 0; font-size: 16px; line-height: 1.6;">
                  ${data.content.mainMessage}
                </p>
              </div>

              ${data.content.features ? `
                <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 18px;">📚 Key Points:</h3>
                <ul style="color: #475569; margin: 0 0 25px 0; padding-left: 20px;">
                  ${data.content.features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
                </ul>
              ` : ''}

              <!-- CTA -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.content.ctaUrl}"
                   style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
                  ${data.content.ctaText}
                </a>
              </div>
            </div>

            <!-- Footer -->
            <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #94a3b8; margin: 0; font-size: 11px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile" style="color: #64748b; text-decoration: none;">
                  Manage email preferences
                </a> |
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/support" style="color: #64748b; text-decoration: none;">
                  Support
                </a>
              </p>
            </div>
          </div>
        </div>
      `,
      text: `Hello ${data.userName || 'there'}!

💡 ${data.content.headline}

${data.content.mainMessage}

${data.content.features ? `\n📚 Key Points:\n${data.content.features.map(f => `• ${f}`).join('\n')}` : ''}

${data.content.ctaText}: ${data.content.ctaUrl}

---
Manage email preferences: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/profile`
    })
  }
};