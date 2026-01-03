import { ThemeProvider } from "@/components/theme-provider";
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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