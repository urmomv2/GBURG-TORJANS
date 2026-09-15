// src/hooks/useSettings.ts
import { useState, useEffect } from "react";

export interface UserSettings {
  zoom: number;
  showGames: boolean;
  showApps: boolean;
  showAI: boolean;
  showEducation: boolean;
  showMusic: boolean;
  showMovies: boolean;
  showVM: boolean;
  showChat: boolean;
  showTools: boolean;
  proxyEngine: string;
  browser: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  zoom: 100,
  showGames: true,
  showApps: true,
  showAI: true,
  showEducation: true,
  showMusic: true,
  showMovies: true,
  showVM: true,
  showChat: true,
  showTools: true,
  proxyEngine: "scramjet",
  browser: "chrome",
};

// Named export
export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cached = localStorage.getItem("trojans_settings");
      if (cached) {
        try { setSettings(JSON.parse(cached)); } catch {}
      }
      try {
        const res = await fetch("/api/user/settings");
        if (res.ok) {
          const apiSettings = await res.json();
          setSettings(apiSettings);
          localStorage.setItem("trojans_settings", JSON.stringify(apiSettings));
        }
      } catch {}
      setIsLoading(false);
    };
    load();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem("trojans_settings", JSON.stringify(updated));
    try {
      await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {}
  };

  return { settings, updateSettings, isLoading };
};

export default useSettings;