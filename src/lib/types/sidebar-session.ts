export type SidebarRiskState = "safe" | "watch" | "imminent" | "live" | "active" | "low";

export interface SidebarEconomicEvent {
  id: string;
  title: string;
  country?: string;
  impact: "low" | "medium" | "high" | "critical";
  timestamp: number;
  isLive: boolean;
  minutesToEvent: number;
}

export interface SidebarSessionIntel {
  sessionName: string;
  sessionShortName: string;
  isOverlap: boolean;
  overlapWith?: string;
  nextEvent: SidebarEconomicEvent | null;
  riskState: SidebarRiskState;
  recommendation: string;
  updatedAt: number;
}

