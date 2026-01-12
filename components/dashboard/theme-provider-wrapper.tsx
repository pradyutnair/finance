import { ThemeProvider } from "@/components/theme-provider";

export function DashboardThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="nexpass-dashboard-theme"
    >
      {children}
    </ThemeProvider>
  );
}