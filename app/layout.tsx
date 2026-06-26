import type { Metadata, Viewport } from "next";
import { BrowserThemeMeta } from "@/components/browser-theme-meta";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Board",
  description: "A Trello-style project management board."
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
          storageKey="project-board-theme"
        >
          <BrowserThemeMeta />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
