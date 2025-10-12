'use client';

import { Card } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

function InsightsChart() {
  return (
    // CSS variables switch colors by theme
    <div className="w-full h-40 sm:h-48 rounded-lg relative overflow-hidden
                    bg-white dark:bg-black
                    [--bar:#40221a] [--line:#40221a] [--axis:#a3a3a3]
                    dark:[--bar:#000000] dark:[--line:#ffffff] dark:[--axis:#7a7a7a]">
      <div className="absolute inset-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeOpacity={0.08} vertical={false} />
            <XAxis dataKey="day" tickMargin={6} stroke="var(--axis)" />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: 'rgba(0,0,0,0.04)' }}
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 8
              }}
              wrapperStyle={{ zIndex: 20 }}
              labelFormatter={() => ''}
              formatter={(value, name) => [name === 'exp' ? `€${value}` : `€${value}` , name === 'exp' ? 'Expense' : 'Cumulative']}
            />
            <Bar dataKey="exp" fill="var(--bar)" radius={[6, 6, 0, 0]} />
            <Line
              type="monotone"
              dataKey="cum"
              stroke="var(--line)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Big overlay text */}
      <div className="absolute right-3 bottom-2 sm:right-4 sm:bottom-3 text-right">
        <div className="text-[22px] sm:text-3xl lg:text-4xl font-extrabold
                        text-[#40221a] dark:text-white tracking-tight">
          Projected: €200
        </div>
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
              {/* Chart for the first card only */}
              <div className="w-full h-40 sm:h-48 mb-4 sm:mb-6 rounded-lg overflow-hidden relative">
                {feature.title === 'Real-time Insights' ? (
                  <InsightsChart />
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
