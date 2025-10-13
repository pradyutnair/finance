'use client';

import { Card } from '@/components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const features = [
  {
    title: "Real-time Insights",
    description: "Instant analysis of your spending patterns and financial health with smart algorithms."
  },
  {
    title: "Bank Integration",
    description: "Connect all your EU bank accounts securely through PSD2-compliant GoCardless integration."
  },
  {
    title: "Smart Budgeting",
    description: "Set goals, track progress, and receive intelligent notifications to stay on target."
  },
  {
    title: "Advanced Analytics",
    description: "Visualize your financial data with beautiful charts and comprehensive reporting tools."
  },
  {
    title: "AI Categorization",
    description: "Automatic transaction categorization powered by AI that learns from your spending habits."
  },
  {
    title: "Privacy First",
    description: "End-to-end encryption with queryable encryption. Your data stays private, always."
  }
];

// sample data like the screenshot
const chartData = [
  { day: 'Oct 1', exp: 42, cum: 10 },
  { day: 'Oct 2', exp: 95, cum: 30 },
  { day: 'Oct 3', exp: 88, cum: 55 },
  { day: 'Oct 4', exp: 92, cum: 78 },
  { day: 'Oct 5', exp: 40, cum: 95 },
  { day: 'Oct 6', exp: 10, cum: 120 },
  { day: 'Oct 7', exp: 12, cum: 180 },
  { day: 'Oct 8', exp: 6,  cum: 195 },
  { day: 'Oct 9', exp: 7,  cum: 198 },
  { day: 'Oct 10', exp: 5, cum: 200 },
];

// Scroll animation hook
function useScrollAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  return { ref, isVisible };
}

// Repeat animation hook - increments a counter every interval while visible
function useRepeatAnimation(isVisible: boolean, intervalMs: number = 5000) {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!isVisible) return;
    setCycle((c) => c + 1);
    const id = setInterval(() => setCycle((c) => c + 1), intervalMs);
    return () => clearInterval(id);
  }, [isVisible, intervalMs]);

  return cycle;
}

// Sample budget data for demo
const budgetData = [
  { category: 'Groceries', spent: 180, budget: 300, color: '#10b981' },
  { category: 'Restaurants', spent: 125, budget: 150, color: '#f59e0b' },
  { category: 'Transport', spent: 45, budget: 100, color: '#3b82f6' },
  { category: 'Shopping', spent: 220, budget: 200, color: '#8b5cf6' },
];

function BudgetChart() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="space-y-3">
        {budgetData.slice(0, 4).map((item, index) => {
          const percentage = Math.min(100, (item.spent / item.budget) * 100);
          const isOverBudget = item.spent > item.budget;

          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                  {item.category}
                </span>
                <span className="font-mono text-gray-600 dark:text-gray-400">
                  €{item.spent} / €{item.budget}
                </span>
              </div>
              <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    isOverBudget
                      ? 'bg-red-500 dark:bg-red-400'
                      : 'bg-[#40221a] dark:bg-white'
                  }`}
                  style={{
                    width: isVisible ? `${percentage}%` : '0%',
                    transitionDelay: isVisible ? `${index * 100}ms` : '0ms'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary text */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Monthly Budget Status</div>
          <div className="text-sm font-bold text-[#40221a] dark:text-white">
            3 of 4 on track
          </div>
        </div>
      </div>
    </div>
  );
}

function AIChatPreview() {
  const { ref, isVisible } = useScrollAnimation();

  // Rich text formatter like in ai-chat-card.tsx
  const formatRichText = (text: string): React.ReactNode => {
    const parts = text.split(/(€\d+(?:,\d{3})*(?:\.\d{2})?|\d+(?:\.\d+)?%|\d{1,2}\/\d{1,2}\/\d{4})/g);

    return parts.map((part, i) => {
      // Currency
      if (part.match(/€\d+/)) {
        return <span key={i} className="font-semibold text-[#40221a] dark:text-gray-200">{part}</span>;
      }
      // Percentage
      if (part.match(/\d+(?:\.\d+)?%/)) {
        const isNegative = text.substring(Math.max(0, text.indexOf(part) - 5), text.indexOf(part)).includes('-');
        return <span key={i} className={`font-semibold ${isNegative ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{part}</span>;
      }
      return part;
    });
  };

  const messages = [
    {
      type: 'user',
      content: 'Analyze my spending patterns and tell me if I can afford a new phone worth €899',
      delay: 0
    },
    {
      type: 'ai',
      content: 'Based on your spending analysis, here\'s what I found:\n\n**Monthly Overview:**\n• Total Income: €3,500\n• Total Expenses: €2,100\n• Current Savings: €1,400 (40% rate)\n\n**Phone Affordability Analysis:**\n• Phone cost: €899\n• This represents 25.7% of your monthly savings\n• At your current savings rate, you\'d need ~2 months to save for it\n• ✅ **Recommendation: Yes, you can afford it**\n\n**Budget Impact:**\n• If you buy now: savings rate drops to 14% for the month\n• If you save 2 months: no impact on savings rate\n• Best approach: Save €450/month for 2 months',
      delay: 100,
      suggestions: [
        "Show me ways to save €450/month faster",
        "What other big purchases can I afford this year?",
        "Update my budget to include phone savings"
      ]
    },
  ];

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="space-y-3">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} transition-all duration-500 ${
              isVisible
                ? 'opacity-100 translate-x-0'
                : msg.type === 'user'
                ? 'opacity-0 translate-x-4'
                : 'opacity-0 -translate-x-4'
            }`}
            style={{
              transitionDelay: isVisible ? `${index * 200}ms` : '0ms'
            }}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-lg text-xs ${
                msg.type === 'user'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                  : 'bg-[#40221a]/10 text-gray-900 dark:text-white'
              }`}
            >
              <div className="leading-relaxed whitespace-pre-wrap">
                {msg.type === 'ai' ? formatRichText(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        <div
          className={`flex justify-start transition-all duration-500 ${
            isVisible
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 -translate-x-4'
          }`}
          style={{
            transitionDelay: isVisible ? '400ms' : '0ms'
          }}
        >
          <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 bg-gray-400 rounded-full ${isVisible ? 'animate-bounce' : ''}`} style={{ animationDelay: isVisible ? '0ms' : '0ms' }}></div>
              <div className={`w-1.5 h-1.5 bg-gray-400 rounded-full ${isVisible ? 'animate-bounce' : ''}`} style={{ animationDelay: isVisible ? '150ms' : '0ms' }}></div>
              <div className={`w-1.5 h-1.5 bg-gray-400 rounded-full ${isVisible ? 'animate-bounce' : ''}`} style={{ animationDelay: isVisible ? '300ms' : '0ms' }}></div>
            </div>
          </div>
        </div>

        {/* AI suggestions */}
        {isVisible && (
          <div className={`mt-3 transition-all duration-500 ${
            isVisible
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-4'
          }`}
            style={{
              transitionDelay: isVisible ? '600ms' : '0ms'
            }}
          >
            <div className="flex flex-wrap gap-1.5">
              {messages[1]?.suggestions?.map((suggestion, idx) => (
                <button
                  key={idx}
                  className={`text-[10px] px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-all border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 flex items-center gap-1`}
                >
                  <span className="text-[8px]">⚡</span>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input preview */}
      <div
        className={`mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 transition-all duration-500 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
        style={{
          transitionDelay: isVisible ? '600ms' : '0ms'
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full px-3 flex items-center">
            <span className="text-xs text-gray-400">Ask about your finances...</span>
          </div>
          <div className="w-6 h-6 bg-[#40221a] dark:bg-gray-300 rounded-full flex items-center justify-center">
            <svg className="w-3 h-3 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function BankIntegrationChart() {
  const { ref, isVisible } = useScrollAnimation();

  const banks = [
    { name: 'Deutsche Bank', connected: true, country: 'DE' },
    { name: 'HSBC UK', connected: true, country: 'UK' },
    { name: 'BNP Paribas', connected: false, country: 'FR' },
    { name: 'ING Netherlands', connected: false, country: 'NL' },
  ];

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* GoCardless logo and title */}
        <div className={`flex items-center gap-2 mb-4 transition-all duration-500 ${
          isVisible
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 -translate-x-4'
        }`}
          style={{
            transitionDelay: isVisible ? '100ms' : '0ms'
          }}
        >
          <img
            src="/gocardless-logo.png"
            alt="GoCardless"
            className="h-6 w-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            PSD2 Integration
          </div>
        </div>

        {/* Bank connections list */}
        <div className="flex-1 space-y-2">
          {banks.map((bank, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-900 transition-all duration-500 ${
                isVisible
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4'
              }`}
              style={{
                transitionDelay: isVisible ? `${200 + index * 100}ms` : '0ms'
              }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  bank.connected
                    ? 'bg-green-500 dark:bg-green-400'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {bank.name}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${
                bank.connected
                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}>
                {bank.connected ? 'Connected' : bank.country}
              </span>
            </div>
          ))}
        </div>

        {/* Security indicator */}
        <div className={`mt-3 text-center transition-all duration-500 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
          style={{
            transitionDelay: isVisible ? '700ms' : '0ms'
          }}
        >
          <div className="text-xs text-gray-500 dark:text-gray-400">
            🔒 Bank-level security encryption
          </div>
        </div>
      </div>
    </div>
  );
}

function AdvancedAnalyticsChart() {
  const { ref, isVisible } = useScrollAnimation();
  const cycle = useRepeatAnimation(isVisible, 5000);

  // Sample expense data with brown and gray gradients only
  const expenseData = [
    { name: 'Groceries', amount: 450, percent: 18 },
    { name: 'Restaurants', amount: 380, percent: 15 },
    { name: 'Transport', amount: 220, percent: 9 },
    { name: 'Shopping', amount: 340, percent: 14 },
    { name: 'Entertainment', amount: 180, percent: 7 },
    { name: 'Bills', amount: 230, percent: 9 },
    { name: 'Healthcare', amount: 160, percent: 6 },
    { name: 'Insurance', amount: 200, percent: 8 },
    { name: 'Subscriptions', amount: 120, percent: 5 },
    { name: 'Personal Care', amount: 90, percent: 4 },
    { name: 'Pet Supplies', amount: 80, percent: 3 },
    { name: 'Home Maintenance', amount: 140, percent: 6 },
  ];

  const total = expenseData.reduce((sum, item) => sum + item.amount, 0);

  // Brown and gray gradient colors only
  const getFill = (index: number) => {
    const brownGrayColors = [
      '#40221a', // Dark brand brown
      '#8B4513', // Saddle brown
      '#654321', // Dark brown
      '#5C4033', // Brown soil
      '#6B4423', // Dark oak
      '#2c2c2c', // Dark gray
      '#808080', // Gray
      '#696969', // Dim gray
      '#71797E', // Cool gray
      '#A9A9A9', // Dark gray
      '#d4d4d8', // Light gray
      '#8B7355', // Burlywood4
    ];
    return brownGrayColors[index % brownGrayColors.length];
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (active && payload?.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 dark:bg-black/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: getFill(expenseData.findIndex(item => item.name === data.name)) }}
            />
            <p className="text-sm font-medium text-gray-900 dark:text-white">{data.name}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#40221a] dark:text-white">
              €{data.amount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {data.percent.toFixed(1)}% of total
            </p>
          </div>
        </div>
      )
    }
    return null
  };

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
      }`}
    >
      <div className="flex h-full items-center justify-center">
        <div className={`relative w-[180px] h-[180px] transition-all duration-1000 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
          style={{
            transitionDelay: isVisible ? '200ms' : '0ms'
          }}
        >
          <ResponsiveContainer width="100%" height="100%" className="max-w-[180px] max-h-[180px]">
            <PieChart key={cycle}>
              <Tooltip content={<CustomTooltip />} />
              <defs>
                {expenseData.map((entry, idx) => (
                  <filter key={`shadow-${idx}`} id={`shadow-${idx}`}>
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.1"/>
                  </filter>
                ))}
              </defs>
              <Pie
                data={expenseData}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                strokeWidth={0}
                animationBegin={0}
                animationDuration={800}
              >
                {expenseData.map((entry, idx) => {
                  const fill = getFill(idx);
                  return (
                    <Cell
                      key={entry.name}
                      fill={fill}
                      className="transition-all duration-200 cursor-pointer hover:opacity-80"
                      style={{
                        filter: 'none',
                        transform: 'scale(1)',
                        transformOrigin: 'center'
                      }}
                    />
                  );
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-xl font-bold text-[#40221a] dark:text-white">
                €{total.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivacyVisualization() {
  const { ref, isVisible } = useScrollAnimation();

  // Standard sample data to match other cards
  const tableData = [
    { bookingDate: '2024-01-15', userId: 'user-123', transactionId: '****-****-****', amount: '€***.**', counterparty: '**************', category: 'Restaurants' },
    { bookingDate: '2024-01-14', userId: 'user-123', transactionId: '****-****-****', amount: '€**.**', counterparty: '****', category: 'Transport' },
    { bookingDate: '2024-01-13', userId: 'user-123', transactionId: '****-****-****', amount: '€***.**', counterparty: '******', category: 'Shopping' },
    { bookingDate: '2024-01-12', userId: 'user-123', transactionId: '****-****-****', amount: '€**.**', counterparty: '*******', category: 'Entertainment' },
    { bookingDate: '2024-01-11', userId: 'user-123', transactionId: '****-****-****', amount: '€*.**', counterparty: '********', category: 'Bills' },
    { bookingDate: '2024-01-10', userId: 'user-123', transactionId: '****-****-****', amount: '€**.**', counterparty: '***', category: 'Groceries' },
  ];

  // Encryption animation for encrypted columns
  const EncryptedCell = ({ text, delay }: { text: string; delay: number }) => {
    const [displayText, setDisplayText] = useState(text);

    useEffect(() => {
      if (!isVisible) return;

      const encryptionChars = ['*', '$', '%', '#', '@', '&', '!', '?'];
      let interval: NodeJS.Timeout;

      const animate = () => {
        interval = setInterval(() => {
          setDisplayText(prev => {
            return prev.split('').map(char =>
              char === '*' ? encryptionChars[Math.floor(Math.random() * encryptionChars.length)] : char
            ).join('');
          });
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
          setDisplayText(text);
        }, 800 + delay);
      };

      const timeout = setTimeout(animate, delay);
      return () => {
        clearTimeout(timeout);
        if (interval) clearInterval(interval);
      };
    }, [isVisible, delay, text]);

    return (
      <span className={`font-mono text-xs text-gray-600 dark:text-gray-400 inline-block transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
        style={{
          transitionDelay: `${delay}ms`
        }}
      >
        {displayText}
      </span>
    );
  };

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Table Header */}
      <div className={`grid grid-cols-6 gap-1 mb-2 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
        style={{
          transitionDelay: '100ms'
        }}
      >
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Date</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">User ID</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Transaction</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Amount</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Counterparty</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">Category</div>
      </div>

      {/* Table Body */}
      <div className="space-y-1.5">
        {tableData.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className={`grid grid-cols-6 gap-1 text-xs transition-all duration-500 ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2'
            }`}
            style={{
              transitionDelay: `${200 + rowIndex * 100}ms`
            }}
          >
            {/* Visible columns */}
            <div className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
              {row.bookingDate}
            </div>
            <div className="font-mono text-xs text-gray-600 dark:text-gray-400 truncate">
              {row.userId}
            </div>

            {/* Encrypted columns with animation */}
            <div className="truncate">
              <EncryptedCell text={row.transactionId} delay={300 + rowIndex * 100} />
            </div>
            <div className="truncate">
              <EncryptedCell text={row.amount} delay={400 + rowIndex * 100} />
            </div>
            <div className="truncate">
              <EncryptedCell text={row.counterparty} delay={500 + rowIndex * 100} />
            </div>

            {/* Visible category */}
            <div className="truncate">
              <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                {row.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsChart() {
  const { ref, isVisible } = useScrollAnimation();
  const cycle = useRepeatAnimation(isVisible, 5000);

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg relative overflow-hidden bg-white dark:bg-black transition-all duration-700 ${
        isVisible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
      }`}
    >
      {/* Title with projection - moved higher and monospace font */}
      <div className={`absolute top-1 left-1/2 transform -translate-x-1/2 z-10 transition-all duration-500 ${
        isVisible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2'
      }`}
        style={{
          transitionDelay: isVisible ? '200ms' : '0ms'
        }}
      >
        <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 text-center">
          MONTHLY PROJECTION: <span className="font-mono font-bold text-[#40221a] dark:text-white">€200</span>
        </div>
      </div>

      <div className="absolute inset-0 pt-8">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={cycle} data={chartData} margin={{ top: 2, right: 1, left: 1, bottom: 1 }}>
            <CartesianGrid strokeOpacity={0.08} vertical={false} />
            <XAxis
              dataKey="day"
              tickMargin={6}
              stroke="#a3a3a3"
              tick={{ fontSize: 10 }}
              tickFormatter={(value) => value.slice(4)} // Show "Oct 1" instead of "Oct 1"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10 }}
              stroke="#a3a3a3"
              tickFormatter={(value) => `€${value}`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10 }}
              stroke="#a3a3a3"
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 8,
                fontSize: 12
              }}
              wrapperStyle={{ zIndex: 20 }}
              labelFormatter={(label) => label}
              formatter={(value: any, name: string) => [
                `€${value}`,
                name === 'exp' ? 'Daily Expense' : 'Cumulative'
              ]}
            />
            <Bar
              yAxisId="left"
              dataKey="exp"
              fill="#40221a"
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="cum"
              stroke="#40221a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section className="py-16 sm:py-24 lg:py-32 px-4 bg-gray-50 dark:bg-black">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 sm:mb-16 lg:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Everything you need
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto px-4">
            Powerful features designed to give you complete control over your financial life.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="p-6 sm:p-8 bg-white dark:bg-[#40221a]/10 border border-gray-200 dark:border-[#40221a]/30 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-[#40221a]/50"
            >
              {/* Feature-specific visualizations */}
              <div className="w-full h-40 sm:h-48 mb-4 sm:mb-6 rounded-lg overflow-hidden relative">
                {feature.title === 'Real-time Insights' ? (
                  <InsightsChart />
                ) : feature.title === 'Bank Integration' ? (
                  <BankIntegrationChart />
                ) : feature.title === 'Smart Budgeting' ? (
                  <BudgetChart />
                ) : feature.title === 'Advanced Analytics' ? (
                  <AdvancedAnalyticsChart />
                ) : feature.title === 'AI Categorization' ? (
                  <AIChatPreview />
                ) : feature.title === 'Privacy First' ? (
                  <PrivacyVisualization />
                ) : (
                  <div className="w-full h-full rounded-lg overflow-hidden bg-gray-100 dark:bg-[#40221a]/20">
                    <img
                      src={`https://api.dicebear.com/7.x/shapes/svg?seed=${feature.title}&backgroundColor=40221a&shape1Color=ffffff&shape2Color=d4d4d4&shape3Color=a3a3a3`}
                      alt={feature.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>

        {/* Additional feature callout */}
        <div className="mt-12 sm:mt-16 lg:mt-20 rounded-2xl bg-gray-50 dark:bg-[#40221a]/10 border border-gray-200 dark:border-[#40221a]/30 p-6 sm:p-8 lg:p-12">
          <div className="max-w-3xl mx-auto text-center">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Built for privacy and security
            </h3>
            <p className="text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              Your financial data is encrypted using Google Cloud KMS with queryable encryption.
              We can't see your sensitive information—only you can. GDPR compliant and built with
               data protection standards in mind.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}