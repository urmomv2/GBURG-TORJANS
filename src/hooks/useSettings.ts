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
  proxyEngine: string;   // ← any engine id works
  browser: string;       // ← any browser id works
}