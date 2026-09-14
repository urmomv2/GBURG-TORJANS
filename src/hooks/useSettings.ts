import { useState, useEffect } from 'react';

export interface UserSettings {
  zoom: number;
  showGames: boolean;
  showApps: boolean;
  showAI: boolean;
  showMusic: boolean;
  showMovies: boolean;
  showVM: boolean;
  showChat: boolean;
  showTools: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  zoom: 100,
  showGames: true,
  showApps: true,
  showAI: true,
  showMusic: true,
  showMovies: true,
  showVM: true,
  showChat: true,
  showTools: true,
};

export const useSettings = () => {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      // 1. Try local cache first (Instant load)
      const cached = localStorage.getItem('trojans_settings');
      if (cached) {
        try {
          setSettings(JSON.parse(cached));
        } catch (e) {
          console.error('Failed to parse cached settings', e);
        }
      }

      // 2. Fetch from API to get the latest user data
      try {
        const res = await fetch('/api/user/settings');
        if (res.ok) {
          const apiSettings = await res.json();
          setSettings(apiSettings);
          localStorage.setItem('trojans_settings', JSON.stringify(apiSettings));
        }
      } catch (err) {
        console.log('API offline, using cached settings');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    
    // Save to cache immediately
    localStorage.setItem('trojans_settings', JSON.stringify(updated));

    // Sync to API in the background
    try {
      await fetch('/api/user/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error('Failed to sync settings to API', err);
    }
  };

  return { settings, updateSettings, isLoading };
};
