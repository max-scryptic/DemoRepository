"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const lightThemeColor = "#f8fafc";
const darkThemeColor = "#020617";

function upsertMeta(name: string, content: string) {
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    document.head.appendChild(meta);
  }

  meta.content = content;
}

export function BrowserThemeMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";

    upsertMeta("theme-color", isDark ? darkThemeColor : lightThemeColor);
    upsertMeta("color-scheme", isDark ? "dark" : "light");
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [resolvedTheme]);

  return null;
}
