"use client";

import type { User } from "@supabase/supabase-js";
import { FolderKanban, Loader2, LogOut } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from "@/components/ui/sidebar";

type ProjectSidebarProps = {
  activeView: "board" | "settings";
  onSignOut: () => void;
  onViewChange: (view: "board" | "settings") => void;
  signOutLoading: boolean;
  user: User;
  userName: string;
};

export function ProjectSidebar({
  activeView,
  onSignOut,
  onViewChange,
  signOutLoading,
  user,
  userName
}: ProjectSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="group-data-[collapsible=icon]:items-center">
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
                  <span>Project Board</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="group-data-[collapsible=icon]:items-center">
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
