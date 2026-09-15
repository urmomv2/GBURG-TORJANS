import React, { useState } from "react";
import { Book, ExternalLink, Search } from "lucide-react";

interface EducationLink {
  title: string;
  description: string;
  url: string;
  category: string;
}

const EDUCATION_LINKS: EducationLink[] = [
  { title: "Khan Academy", description: "Free courses on math, science, history, and more.", url: "https://www.khanacademy.org", category: "General" },
  { title: "Coursera", description: "University-level courses from top institutions.", url: "https://www.coursera.org", category: "Courses" },
  { title: "MIT OpenCourseWare", description: "Free lecture notes, exams, and videos from MIT.", url: "https://ocw.mit.edu", category: "University" },
  { title: "Wikipedia", description: "The free encyclopedia anyone can edit.", url: "https://www.wikipedia.org", category: "Reference" },
  { title: "Wolfram Alpha", description: "Computational engine for math, science, and more.", url: "https://www.wolframalpha.com", category: "Tools" },
  { title: "Desmos", description: "Free online graphing calculator.", url: "https://www.desmos.com/calculator", category: "Tools" },
  { title: "Project Gutenberg", description: "70,000+ free eBooks.", url: "https://www.gutenberg.org", category: "Reading" },
  { title: "Crash Course", description: "Educational YouTube series on many subjects.", url: "https://www.youtube.com/user/crashcourse", category: "Video" },
];

const Education: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", ...Array.from(new Set(EDUCATION_LINKS.map((l) => l.category)))];

  const filtered = EDUCATION_LINKS.filter((link) => {
    const matchesSearch =
      link.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || link.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openLink = (url: string) => {
    window.location.href = `/embed.html#${url}`;
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Book size={28} /> Education
          </h1>
          <p className="text-gray-400 text-sm mt-1">Free learning resources, proxied for easy access.</p>
        </div>

        <div className="relative w-full md:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              selectedCategory === cat
                ? "bg-blue-600/30 border-blue-500/50 text-white"
                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-8 custom-scrollbar">
        {filtered.map((link) => (
          <button
            key={link.url}
            onClick={() => openLink(link.url)}
            className="text-left group bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-blue-500/40 rounded-xl p-5 transition"
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                {link.category}
              </span>
              <ExternalLink size={14} className="text-gray-500 group-hover:text-blue-400 transition" />
            </div>
            <h3 className="text-white font-semibold mb-1 group-hover:text-blue-300 transition">{link.title}</h3>
            <p className="text-gray-400 text-xs leading-relaxed">{link.description}</p>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-500">
          <Search size={48} className="mb-4 opacity-50" />
          <p>No resources match "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
};

export default Education;