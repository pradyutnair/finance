Here you go:

# Front-End Spec — Finance Dashboard (Dark, Minimal, Midday-like)

## 0) Tech choices & global conventions
- **Framework**: Next.js + React.  
- **Styling**: Tailwind CSS with **class-based dark mode** (`dark` variant) and a theme toggle. Use semantic tokens (CSS vars) for color scale (see §1).  
- **UI components**: Compose from **shadcn/ui** (Buttons, Cards, Dropdowns, Dialogs, Input, Avatar, Tabs).  
- **Charts**: **Recharts** (LineChart, PieChart, ResponsiveContainer, Tooltip, Legend).  
- **Aesthetic reference**: Midday’s product marketing & docs — clean typography, high contrast, ample spacing, minimal UI. Design with a Glassmorphism style using frosted glass effects with transparency and backdrop blur. Elements should have subtle light borders (1px) and slight transparency. Create depth through layering of translucent elements. Use colorful backgrounds (gradients work well) with frosted glass UI elements on top. Apply backdrop-blur CSS properties and use RGBA colors with alpha transparency. Aim for a modern, clean aesthetic with subtle light reflections and shadows. The design should be unique, beautiful and detailed. the colors should work well together. It should be monochromatic and dark mode

---

## 1) Theme & design tokens (dark-first)
Use CSS variables on `:root` and `.dark` to keep consistent look.

**Core palette (suggested)**  
- Backgrounds: `--bg: #0b0d10`, `--bg-elev: #111318`, `--bg-hover: #161a20`  
- Text: `--fg: #e6eaf2`, `--fg-muted: #a9b1c3`, `--fg-subtle: #7c8598`  
- Accents: `--accent: #6aa3ff`, `--success: #22c55e`, `--danger: #ef4444`, `--warning: #f59e0b`  
- Strokes: `--border: #222733`, `--ring: #2b3240`

**Tailwind setup**  
- `darkMode: 'class'` in `tailwind.config.js`.  
- Map Tailwind utilities to vars (e.g. `bg-[var(--bg)]`, `text-[var(--fg)]`).  
- Provide light mode fallback (optional) using `dark:` variants.

**Typography & density**  
- Typeface: a neutral grotesk (e.g. Inter).  
- Sizes: Title: `text-2xl md:text-3xl font-semibold`; KPI numbers: `text-2xl md:text-3xl font-semibold`; Body: `text-sm md:text-base text-[var(--fg-muted)]`.

**Surface**  
- Cards: subtle elevation, 24px radius, 16–20px padding.  
- Focus ring: 2px using `--ring`.

---

## 2) Information architecture & layout
**Page: `/dashboard`**  
- **Top app bar**: logo, date range selector, account selector (optional), theme toggle, user menu.  
- **Metrics row (4 KPIs)**: Gross income, Expenses, Net income, % Savings.  
- **Time-series chart**: line chart of income vs expenses.  
- **Lower area** (3 columns on xl, adaptively fewer on smaller):  
  - **Left**: AI Chatbot  
  - **Middle**: Recent Expenses table  
  - **Right**: Categories Pie chart

**Responsive behavior**  
- `xl`: full layout.  
- `md–lg`: stacked / 2-column layout.  
- `sm`: single-column stacked in logical order.

**Grid & spacing**  
- Container: `max-w-[1200px] mx-auto px-4 md:px-6`.  
- Vertical spacing: `space-y-6` desktop, `space-y-4` mobile.

---

## 3) Components & interactions

### 3.1 AppBar  
- Logo (left)  
- Date range picker (center)  
- Theme toggle + avatar menu (right)  
- Use `Button`, `DropdownMenu`, `Popover`, `Avatar`, `Calendar` from shadcn/ui.

### 3.2 KPI Cards (4)  
- Gross income, Expenses, Net, % Savings  
- Big number + label + optional delta vs previous  
- Hover lift, clickable filter behavior  
- Use `Card` / `CardContent`

### 3.3 Line Chart (Income vs Expenses)  
- Use `ResponsiveContainer` + `LineChart`  
- Two series: `income`, `expenses`  
- Smooth curves, minimal grid, custom tooltip  
- Synchronize with date range

### 3.4 AI Chatbot Panel  
- Message bubbles (User / Assistant)  
- Composer (textarea + send button)  
- Suggested prompt chips  
- Scroll to bottom, optimistic UI for sending  
- Use `Textarea`, `Button`, `ScrollArea`, `Avatar`, `Separator`

### 3.5 Recent Expenses Table  
- Show last 5–10 negative transactions  
- Columns: Date, Merchant, Category, Amount (right aligned)  
- Hover highlight, row click opens detail drawer  
- Sticky header, skeleton loading, empty state

### 3.6 Categories Pie (Expenses by Category)  
- Donut chart (PieChart)  
- Limit to top N + “Other”  
- Hover tooltips  
- Legend with category names + values

---

## 4) Data contract (front-end expectations)

**Metrics endpoint**  
```ts
type Metrics = {
  grossIncome: number;
  expenses: number;
  netIncome: number;
  savingRatePct: number;
  deltas?: { netPct: number; incomePct: number; expensesPct: number };
}

Timeseries endpoint

type SeriesPoint = { t: string; income: number; expenses: number };
type Timeseries = SeriesPoint[];

Recent expenses

type Transaction = {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  category?: string;
  amount: number;
  currency: string;
  accountId: string;
};

Categories breakdown

type CategorySlice = { name: string; amount: number; percent: number };

Chat API
	•	POST /chat { message: string } → streamed or { reply: string }

⸻

5) State management & loading strategy
	•	Page-level skeleton loaders
	•	Query keys per range: (metrics, range), (series, range), (recent, range), (cats, range)
	•	Optimistic UI for chat, error retry
	•	Empty states for new users; CTA “Connect bank”

⸻

6) Accessibility & interactions
	•	Keyboard nav, focus rings
	•	Charts: ARIA descriptions + data table fallback
	•	Color contrast >= 4.5:1
	•	Tooltips content mirrored in sr-only for critical data

⸻

7) Visual polish (Midday-like)
	•	Minimal chrome, generous whitespace, high-contrast typography
	•	KPI cards: subtle gradients or overlays
	•	Line chart: thin strokes, smooth curves, minimal grid
	•	Pie: center label showing total expenses, minimal legend
	•	Overall restraint in UI chrome; accent use minimal & intentional

⸻

8) Component file map (suggested)

/app/dashboard/page.tsx  
/app/components/AppBar.tsx  
/app/components/ThemeToggle.tsx  
/app/components/KpiCard.tsx  
/app/components/TimeseriesChart.tsx  
/app/components/Chat/ChatPanel.tsx  
/app/components/Transactions/RecentExpensesTable.tsx  
/app/components/Categories/CategoriesPie.tsx  
/app/components/DateRange/DateRangePicker.tsx  
/app/lib/api.ts  
/app/lib/format.ts  
/app/styles/theme.css  


⸻

9) Chart specifics (Recharts)

LineChart
	•	ResponsiveContainer height ~300
	•	LineChart data={timeseries} with XAxis dataKey="t", YAxis, optional CartesianGrid, Tooltip, Legend
	•	Line type="monotone" dataKey="income" (accent stroke), Line dataKey="expenses" (danger stroke)

PieChart (donut)
	•	PieChart width="100%" height={280}
	•	Pie data={slices} with innerRadius & outerRadius
	•	Tooltip + custom center label
	•	Legend with name + percent/amount

⸻

10) Dark mode & theming implementation
	•	Apply class="dark" on html when dark mode active (persist via localStorage)
	•	Use Tailwind dark: classes and CSS vars
	•	Override shadcn/ui component theme via CSS vars

⸻

11) Acceptance criteria
	•	KPIs reflect correct values
	•	Chart updates within ~150ms on range change
	•	Chat sends & displays reply
	•	Table displays 10 recent expenses; row click opens details
	•	Pie shows top categories + “Other”
	•	Dark mode default, toggle works, persists
	•	Responsive across breakpoints
	•	No layout shifts at load; skeletons displayed during fetch

⸻

References
	•	Midday’s visual style & product pages (as inspiration)
	•	Tailwind CSS dark mode docs
	•	shadcn/ui component system
	•	Recharts docs & examples

