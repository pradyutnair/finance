import { cn } from "@/lib/utils"

const gradients = [
  "from-pink-500 via-red-500 to-yellow-500",
  "from-purple-500 via-indigo-500 to-blue-500",
  "from-green-400 via-emerald-500 to-teal-600",
  "from-orange-400 via-pink-500 to-rose-600",
  "from-sky-400 via-cyan-500 to-blue-600",
]

function pickGradient(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export function GradientAvatar({
  name,
  className,
  height = 80,
  width = 80,
  fontSize = "text-lg",
}: {
  name?: string | null
  className?: string
  height?: number | string
  width?: number | string
  fontSize?: string
}) {
  const initials =
    (name ?? "U")
      .trim()
      .split(/\s+/)
      .map((s) => s[0]?.toUpperCase())
      .slice(0, 2)
      .join("") || "U"

  const gradient = pickGradient(name || "user")

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full text-white font-semibold shadow-md bg-gradient-to-br",
        fontSize,
        gradient,
        className
      )}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        width: typeof width === "number" ? `${width}px` : width,
        minHeight: typeof height === "number" ? `${height}px` : height,
        minWidth: typeof width === "number" ? `${width}px` : width,
      }}
    >
      {initials}
    </div>
  )
}
