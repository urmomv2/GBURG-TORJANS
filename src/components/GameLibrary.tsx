import React, { useState, useEffect } from 'react';
import { Search, X, Play } from 'lucide-react';
import ObfuscatedText from './ObfuscatedText';
import { useEndpoints } from '../hooks/useEndpoints';

interface GameData {
  label: string;
  imageUrl: string;
  url: string;
  categories: string[];
}

const GameLibrary: React.FC = () => {
  const [games, setGames] = useState<GameData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { endpoints } = useEndpoints();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const res = await fetch('/api/storage/games/api', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Trojans-Request': 'true',
          },
        });
        if (!res.ok) {
          if (res.status === 403) throw new Error('Access Denied');
          throw new Error(`Server error: ${res.status}`);
        }
        const data = await res.json();
        setGames(data.games || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load games');
      } finally {
        setLoading(false);
      }
    };
    fetchGames();
  }, []);

  const filteredGames = games.filter((game) =>
    game.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const launchGame = (game: GameData) => {
    if (!endpoints) return;
    let url = game.url;
    // Rewrite static paths that may have leaked into games.json
    url = url
      .replace('/scram-embed.html', `/${endpoints.scramEmbed}.html`)
      .replace('/embed.html', `/${endpoints.embedHtml}.html`)
      .replace('/youtube-embed.html', `/${endpoints.youtubeEmbed}.html`)
      .replace('/google-embed.html', `/${endpoints.googleEmbed}.html`)
      .replace('/libcurl-embed.html', `/${endpoints.libcurlEmbed}.html`);
    // "!!/" shortcut → embed
    if (url.includes('!!/')) {
      url = url.replace('!!/', `/${endpoints.embedHtml}.html#`);
    }
    setSelectedGame({ ...game, url });
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Game Library</h1>
          <p className="text-gray-400 text-sm mt-1">Play your favorite games directly in the proxy.</p>
        </div>
        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 text-blue-400">
          <p>Loading Games...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1 text-red-500">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-wrap justify-center gap-5 overflow-y-auto pb-8 custom-scrollbar">
          {filteredGames.map((game, index) => (
            <div
              key={index}
              className="relative bg-black rounded-[10px] w-[150px] h-[150px] flex justify-center items-center cursor-pointer overflow-hidden transition-transform duration-200 hover:scale-105 group"
              onClick={() => launchGame(game)}
            >
              <img
                src={game.imageUrl}
                alt={game.label}
                loading="lazy"
                className="w-full h-full object-cover rounded-[10px] transition-opacity duration-300 group-hover:opacity-50"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Image';
                }}
              />
              <ObfuscatedText
                as="div"
                className="absolute text-white font-['Nunito',_serif] text-[18px] text-center opacity-0 transition-opacity duration-300 pointer-events-none z-10 w-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 group-hover:opacity-100"
              >
                {game.label}
              </ObfuscatedText>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                <div className="w-12 h-12 rounded-full bg-blue-600/80 backdrop-blur-sm flex items-center justify-center transform scale-50 group-hover:scale-100 transition-transform duration-300">
                  <Play size={20} className="text-white ml-1" fill="white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredGames.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
          <Search size={48} className="mb-4 opacity-50" />
          <p>No games found matching "{searchQuery}"</p>
        </div>
      )}

      {selectedGame && (
        <div className="fixed inset-0 z-[200] bg-black flex flex-col">
          <div className="h-12 bg-[#111] border-b border-white/10 flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <ObfuscatedText as="span" className="text-white font-bold">
                {selectedGame.label}
              </ObfuscatedText>
              <span className="text-xs text-gray-500 bg-white/10 px-2 py-0.5 rounded">Proxied</span>
            </div>
            <button
              onClick={() => setSelectedGame(null)}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition bg-white/5 hover:bg-white/10 px-3 py-1 rounded-lg"
            >
              <X size={16} /> Close Game
            </button>
          </div>
          <iframe
            src={selectedGame.url}
            className="flex-1 w-full h-full border-0 bg-white"
            title={selectedGame.label}
            allow="fullscreen; autoplay; clipboard-write; encrypted-media; picture-in-picture; gamepad"
          />
        </div>
      )}
    </div>
  );
};

export default GameLibrary;