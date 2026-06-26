import type { Metadata } from "next";
import { BrowserThemeMeta } from "@/components/browser-theme-meta";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Board",
  description: "A Trello-style project management board."
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
