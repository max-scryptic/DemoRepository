"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Toggle theme"
          className="relative h-9 w-9 rounded-lg border border-border bg-background shadow-sm"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 text-muted-foreground transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 text-muted-foreground transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4" />
          <span className={theme === "light" ? "font-medium" : undefined}>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4" />
          <span className={theme === "dark" ? "font-medium" : undefined}>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onClick={() => setTheme("system")}>
          <Monitor className="h-4 w-4" />
          <span className={theme === "system" ? "font-medium" : undefined}>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
