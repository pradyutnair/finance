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

  // Sample expense data
  const expenseData = [
    { category: 'Groceries', amount: 450, percentage: 25, color: 'bg-green-500' },
    { category: 'Restaurants', amount: 380, percentage: 21, color: 'bg-yellow-500' },
    { category: 'Transport', amount: 220, percentage: 12, color: 'bg-blue-500' },
    { category: 'Shopping', amount: 340, percentage: 19, color: 'bg-purple-500' },
    { category: 'Entertainment', amount: 180, percentage: 10, color: 'bg-red-500' },
    { category: 'Bills', amount: 230, percentage: 13, color: 'bg-cyan-500' },
  ];

  const total = expenseData.reduce((sum, item) => sum + item.amount, 0);

  // Create simple pie chart representation
  const chartRadius = 60;
  const centerX = 80;
  const centerY = 80;

  const createPiePath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(centerX, centerY, chartRadius, endAngle);
    const end = polarToCartesian(centerX, centerY, chartRadius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", centerX, centerY,
      "L", start.x, start.y,
      "A", chartRadius, chartRadius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ");
  };

  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  let currentAngle = 0;

  return (
    <div
      ref={ref}
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-4 transition-all duration-700 ${
        isVisible
          ? 'opacity-100 scale-100'
          : 'opacity-0 scale-95'
      }`}
    >
      <div className="flex h-full items-center justify-center gap-6">
        {/* Simple SVG Pie Chart */}
        <div className={`relative transition-all duration-1000 ${
          isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
          style={{
            transitionDelay: isVisible ? '200ms' : '0ms'
          }}
        >
          <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
            {/* Pie slices */}
            {expenseData.map((item, index) => {
              const startAngle = currentAngle;
              const endAngle = currentAngle + (item.percentage * 3.6);
              currentAngle = endAngle;

              const colors = ['rgb(34 197 94)', 'rgb(234 179 8)', 'rgb(59 130 246)', 'rgb(168 85 247)', 'rgb(239 68 68)', 'rgb(6 182 212)'];
              const color = colors[index % colors.length];

              return (
                <path
                  key={item.category}
                  d={createPiePath(startAngle, endAngle)}
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                  className={`transition-all duration-300 ${
                    isVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    transitionDelay: isVisible ? `${300 + index * 100}ms` : '0ms'
                  }}
                />
              );
            })}

            {/* Center circle for donut effect */}
            <circle
              cx={centerX}
              cy={centerY}
              r="35"
              fill="white"
              className={`transition-all duration-500 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                transitionDelay: isVisible ? '800ms' : '0ms'
              }}
            />

            {/* Center text */}
            <text
              x={centerX}
              y={centerY - 5}
              textAnchor="middle"
              className="text-lg font-bold fill-[#40221a] dark:fill-white"
            >
              €{total}
            </text>
            <text
              x={centerX}
              y={centerY + 10}
              textAnchor="middle"
              className="text-xs fill-gray-500 dark:fill-gray-400"
            >
              Total
            </text>
          </svg>
        </div>

        {/* Category breakdown */}
        <div className="flex-1 space-y-2">
          <div className={`text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 transition-all duration-500 ${
            isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
          }`}
            style={{
              transitionDelay: isVisible ? '100ms' : '0ms'
            }}
          >
            Categories
          </div>
          {expenseData.map((item, index) => (
            <div
              key={item.category}
              className={`flex items-center justify-between transition-all duration-500 ${
                isVisible
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4'
              }`}
              style={{
                transitionDelay: isVisible ? `${200 + index * 80}ms` : '0ms'
              }}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${item.color}`} />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {item.category}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs font-mono font-semibold text-[#40221a] dark:text-white">
                  €{item.amount}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">
                  {item.percentage}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PrivacyVisualization() {
  const { ref, isVisible } = useScrollAnimation();

  // Sample data for the table
  const tableData = [
    { bookingDate: '2024-01-15', userId: 'user-123', transactionId: '****-****-****', amount: '€***.**', counterparty: '**************', category: 'Restaurants' },
    { bookingDate: '2024-01-14', userId: 'user-123', transactionId: '****-****-****', amount: '€**.**', counterparty: '****', category: 'Transport' },
    { bookingDate: '2024-01-13', userId: 'user-123', transactionId: '****-****-****', amount: '€***.**', counterparty: '******', category: 'Shopping' },
    { bookingDate: '2024-01-12', userId: 'user-123', transactionId: '****-****-****', amount: '€**.**', counterparty: '*******', category: 'Entertainment' },
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
      <span className={`font-mono text-[10px] text-gray-600 dark:text-gray-400 inline-block transition-all duration-300 ${
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
      className={`w-full h-40 sm:h-48 rounded-lg overflow-hidden bg-white dark:bg-black p-3 transition-all duration-700 ${
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
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">Date</div>
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">User ID</div>
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">Transaction</div>
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">Amount</div>
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">Counterparty</div>
        <div className="text-[9px] font-semibold text-gray-700 dark:text-gray-300 truncate">Category</div>
      </div>

      {/* Table Body */}
      <div className="space-y-1">
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
            <div className="font-mono text-[10px] text-gray-600 dark:text-gray-400 truncate">
              {row.bookingDate}
            </div>
            <div className="font-mono text-[10px] text-gray-600 dark:text-gray-400 truncate">
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
              <span className="font-mono text-[10px] text-gray-600 dark:text-gray-400">
                {row.category}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Encryption indicator */}
      <div className={`mt-3 flex items-center justify-center gap-1 transition-all duration-500 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
        style={{
          transitionDelay: '700ms'
        }}
      >
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <div className="text-[9px] text-gray-500 dark:text-gray-400">
          Encrypted at rest
        </div>
      </div>
    </div>
  );
}

function InsightsChart() {
  const { ref, isVisible } = useScrollAnimation();

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
          <ComposedChart data={chartData} margin={{ top: 2, right: 1, left: 1, bottom: 1 }}>
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
