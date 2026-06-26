"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const lightThemeColor = "#f8fafc";
const darkThemeColor = "#020617";
const lightMedia = "(prefers-color-scheme: light)";
const darkMedia = "(prefers-color-scheme: dark)";

function upsertMeta(name: string, content: string, media?: string) {
  const mediaSelector = media ? `[media="${media}"]` : ":not([media])";
  let meta = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]${mediaSelector}`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.name = name;
    if (media) {
      meta.media = media;
    }
    document.head.appendChild(meta);
  }

  meta.content = content;
}

export function BrowserThemeMeta() {
  const { resolvedTheme, theme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === "dark";
    const activeThemeColor = isDark ? darkThemeColor : lightThemeColor;
    const isSystemTheme = !theme || theme === "system";

    upsertMeta("theme-color", isSystemTheme ? lightThemeColor : activeThemeColor, lightMedia);
    upsertMeta("theme-color", isSystemTheme ? darkThemeColor : activeThemeColor, darkMedia);

    upsertMeta("color-scheme", isSystemTheme ? "light dark" : isDark ? "dark" : "light");
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [resolvedTheme, theme]);

  return null;
}
