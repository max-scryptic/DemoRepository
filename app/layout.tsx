import type { Metadata } from "next";
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  try {
    const savedTheme = window.localStorage.getItem("project-board-theme");
    const useDark = savedTheme === "dark";
    document.documentElement.classList.toggle("dark", useDark);
  } catch {
    document.documentElement.classList.remove("dark");
  }
})();
            `.trim()
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
