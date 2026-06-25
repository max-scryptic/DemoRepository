"use client";

import type { User } from "@supabase/supabase-js";
import { FolderKanban, Loader2, LogOut, Search, Settings } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from "@/components/ui/sidebar";

type ProjectSidebarProps = {
  activeView: "board" | "settings";
  onSearchChange: (query: string) => void;
  onSignOut: () => void;
  onViewChange: (view: "board" | "settings") => void;
  query: string;
  signOutLoading: boolean;
  user: User;
  userName: string;
};

export function ProjectSidebar({
  activeView,
  onSearchChange,
  onSignOut,
  onViewChange,
  query,
  signOutLoading,
  user,
  userName
}: ProjectSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-12 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!w-10" type="button">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                <Image
                  alt="Scryptic logo"
                  className="h-full w-full object-contain"
                  height={32}
                  src="/scryptic-logo-white.png"
                  width={32}
                />
              </div>
              <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-semibold">Scryptic</span>
                <span className="truncate text-xs font-normal text-sidebar-foreground/65">{userName}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <form>
          <SidebarGroup className="py-0">
            <SidebarGroupContent className="relative">
              <Label className="sr-only" htmlFor="sidebar-search">
                Search
              </Label>
              <SidebarInput
                className="pl-8 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-transparent group-data-[collapsible=icon]:placeholder:text-transparent"
                id="sidebar-search"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search cards..."
                value={query}
              />
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50 group-data-[collapsible=icon]:left-1/2 group-data-[collapsible=icon]:-translate-x-1/2" />
            </SidebarGroupContent>
          </SidebarGroup>
        </form>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeView === "board"}
                  onClick={() => onViewChange("board")}
                  type="button"
                >
                  <FolderKanban className="h-4 w-4" />
                  <span>Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activeView === "settings"}
              onClick={() => onViewChange("settings")}
              type="button"
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSeparator />
        <div className="rounded-lg border border-sidebar-border bg-background px-3 py-2 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{user.email}</p>
        </div>
        <Button
          className="justify-start rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          disabled={signOutLoading}
          onClick={onSignOut}
          title="Log out"
          type="button"
          variant="ghost"
        >
          {signOutLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          <span className="group-data-[collapsible=icon]:sr-only">Log out</span>
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
