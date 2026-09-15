import React from "react";
import { MessageCircle, ExternalLink } from "lucide-react";

const DISCORD_SERVER_ID = (import.meta as any).env?.VITE_DISCORD_SERVER_ID || "";
const DISCORD_INVITE = (import.meta as any).env?.VITE_DISCORD_INVITE || "";

const Chat: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MessageCircle size={28} /> Community Chat
          </h1>
          <p className="text-gray-400 text-sm mt-1">Join the Trojans community on Discord.</p>
        </div>
        {DISCORD_INVITE && (
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-lg transition"
          >
            <ExternalLink size={14} /> Open Discord
          </a>
        )}
      </div>

      {DISCORD_SERVER_ID ? (
        <div className="flex-1 bg-black/30 border border-white/10 rounded-xl overflow-hidden">
          <iframe
            title="Discord"
            src={`https://discord.com/widget?id=${DISCORD_SERVER_ID}&theme=dark`}
            width="100%"
            height="100%"
            frameBorder="0"
            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-black/30 border border-white/10 rounded-xl">
          <MessageCircle size={48} className="mb-4 opacity-40" />
          <p className="text-sm mb-2">Discord chat isn't configured yet.</p>
          <p className="text-xs text-gray-600">
            Set <code className="text-blue-400">VITE_DISCORD_SERVER_ID</code> in your root{" "}
            <code className="text-blue-400">.env</code> file.
          </p>
        </div>
      )}
    </div>
  );
};

export default Chat;