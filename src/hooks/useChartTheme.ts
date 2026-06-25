import { useMemo } from "react";

import { useTheme } from "@/lib/theme/theme-provider";

export type ChartThemeColors = {
  gridColor: string;
  textColor: string;
  tooltipBackground: string;
  tooltipText: string;
  tooltipBorder: string;
  accentStroke: string;
  accentFill: string;
};

export const AUTOMATION_CHART_THEME: ChartThemeColors = {
  gridColor: "rgba(51, 65, 85, 0.45)",
  textColor: "#94A3B8",
  tooltipBackground: "#1E293B",
  tooltipText: "#F8FAFC",
  tooltipBorder: "#334155",
  accentStroke: "#34A853",
  accentFill: "#34A853",
};

export function useChartTheme(): ChartThemeColors {
  const { theme } = useTheme();

  return useMemo(() => {
    if (theme === "light") {
      return {
        gridColor: "rgba(100, 116, 139, 0.2)",
        textColor: "#64748B",
        tooltipBackground: "#FFFFFF",
        tooltipText: "#0F172A",
        tooltipBorder: "#E2E8F0",
        accentStroke: "#D97706",
        accentFill: "#D97706",
      };
    }

    return {
      gridColor: "rgba(51, 65, 85, 0.45)",
      textColor: "#94A3B8",
      tooltipBackground: "#1E293B",
      tooltipText: "#F8FAFC",
      tooltipBorder: "#334155",
      accentStroke: "#34A853",
      accentFill: "#34A853",
    };
  }, [theme]);
}
