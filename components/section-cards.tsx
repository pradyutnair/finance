import {
  IconArrowUpRight,
  IconArrowDownRight,
  IconWallet,
  IconPigMoney,
  IconCreditCard,
  IconCoins,
} from "@tabler/icons-react"

import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"

const cards = [
  {
    label: "Balance",
    value: "€12,500",
    icon: <IconWallet className="size-6 text-muted-foreground" />,
    change: "+3.2%",
    changeType: "up",
    changeColor: "text-green-600",
    subtext: "compared to last month",
  },
  {
    label: "Income",
    value: "€8,200",
    icon: <IconCoins className="size-6 text-muted-foreground" />,
    change: "+8.5%",
    changeType: "up",
    changeColor: "text-green-600",
    subtext: "compared to last month",
  },
  {
    label: "Expenses",
    value: "€4,100",
    icon: <IconCreditCard className="size-6 text-muted-foreground" />,
    change: "-2.1%",
    changeType: "down",
    changeColor: "text-red-600",
    subtext: "compared to last month",
  },
  {
    label: "Savings",
    value: "50%",
    icon: <IconPigMoney className="size-6 text-muted-foreground" />,
    change: "+5.0%",
    changeType: "up",
    changeColor: "text-green-600",
    subtext: "compared to last month",
  },
]

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card
        key={card.label}
        className="
          relative overflow-hidden rounded-2xl border border-border
          bg-background/60 shadow-none transition-shadow
          hover:shadow-sm
          before:absolute before:inset-0 before:rounded-[inherit]
          before:pointer-events-none
          before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_55%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.02)_100%)]
          dark:before:bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.05)_55%,transparent_100%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)]
        "
      >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-muted rounded-md p-1.5">{card.icon}</div>
              <CardDescription className="font-medium text-muted-foreground">
                {card.label}
              </CardDescription>
            </div>
            <CardTitle className="mt-4 text-3xl font-bold tabular-nums">
              {card.value}
            </CardTitle>
          </CardHeader>
          <CardFooter className="pt-0">
            <div className="flex items-center gap-1 text-sm">
              {card.changeType === "up" ? (
                <IconArrowUpRight className={`size-4 ${card.changeColor}`} />
              ) : (
                <IconArrowDownRight className={`size-4 ${card.changeColor}`} />
              )}
              <span className={`font-medium ${card.changeColor}`}>{card.change}</span>
              <span className="text-muted-foreground ml-1">{card.subtext}</span>
            </div>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
