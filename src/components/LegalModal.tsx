import React, { useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';

export type LegalTab = 'tos' | 'privacy' | 'dmca' | 'credits' | null;

interface Props {
  type: LegalTab;
  onClose: () => void;
}

const LegalModal: React.FC<Props> = ({ type, onClose }) => {
  useEffect(() => {
    if (type) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [type]);

  if (!type) return null;

  const getTitle = () => {
    switch (type) {
      case 'tos': return 'Terms of Service';
      case 'privacy': return 'Privacy Policy';
      case 'dmca': return 'DMCA / Copyright Policy';
      case 'credits': return 'Credits & Acknowledgments';
      default: return '';
    }
  };

  const getContent = () => {
    switch (type) {
      case 'tos':
        return (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Trojans Legal</h1>
              <h2 className="text-lg font-semibold text-gray-200">Terms of Service</h2>
              <p className="text-xs text-gray-500 mt-1">Effective September 9, 2026 · Version 2026-09-09</p>
            </div>
            <p>This Terms of Service describes how Trojans (the "Service," "we," "us") governs your use of our properties.</p>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">1. Acceptance of Terms</h3>
              <p>By accessing or using Trojans, you agree to be bound by these Terms. If you do not agree, please do not use the Service.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">2. Use of Service</h3>
              <p>Trojans is provided for educational and personal use only. You agree not to use the service for any illegal activities, including but not limited to hacking, distributing malware, or violating any local, state, or federal laws.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">3. No Hosting</h3>
              <p>Trojans does not host any of the content accessed through the proxy. All content is fetched from third-party servers. We are not responsible for the content of external sites.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">4. Disclaimer of Warranties</h3>
              <p>The service is provided "as is" without any warranties, express or implied. We do not guarantee uptime, speed, or that the service will be free of errors.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">5. Limitation of Liability</h3>
              <p>In no event shall Trojans be liable for any indirect, incidental, special, or consequential damages arising out of the use of the service.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">6. Contact</h3>
              <p>General: contact@trojans.proxy</p>
              <p>Community: https://discord.trojans.proxy</p>
            </div>
          </div>
        );
      case 'privacy':
        return (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Trojans Legal</h1>
              <h2 className="text-lg font-semibold text-gray-200">Privacy Policy</h2>
              <p className="text-xs text-gray-500 mt-1">Effective September 9, 2026 · Version 2026-09-09</p>
            </div>
            <p>This Privacy Policy describes how Trojans (the "Service," "we," "us") handles your data.</p>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">1. Data We Collect</h3>
              <p>Trojans does not log your browsing history, IP addresses, or personal information. We do not track which games you play or websites you visit through the proxy.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">2. Local Storage (Cache)</h3>
              <p>We use your browser's local storage to save your preferences (e.g., zoom level, enabled features). This data never leaves your device unless you enable cloud sync (if applicable).</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">3. Cookies</h3>
              <p>Trojans does not use tracking cookies. Any cookies set are strictly for functional purposes (e.g., maintaining a session).</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">4. Third-Party Services</h3>
              <p>We are not responsible for the privacy practices of the websites you access through the proxy. Please review their privacy policies.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">5. Contact</h3>
              <p>Privacy inquiries: privacy@trojans.proxy</p>
              <p>General: contact@trojans.proxy</p>
            </div>
          </div>
        );
      case 'dmca':
        return (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Trojans Legal</h1>
              <h2 className="text-lg font-semibold text-gray-200">DMCA / Copyright Policy</h2>
              <p className="text-xs text-gray-500 mt-1">Effective September 9, 2026 · Version 2026-09-09</p>
            </div>
            <p>This DMCA / Copyright Policy describes how Trojans (the "Service," "we," "us") responds to claims of copyright infringement involving material on or linked from our properties.</p>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">1. Respect for Copyright</h3>
              <p>We respect intellectual property rights. Games, applications, artwork, audio, video, brands, and other works accessible through the Service generally belong to their respective owners. Unless we expressly state otherwise, we do not claim ownership of third-party works.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">2. Role as Service Provider; Safe Harbor Intent</h3>
              <p>Where applicable, we intend to operate consistent with the notice-and-takedown framework of the U.S. Digital Millennium Copyright Act, 17 U.S.C. § 512, and analogous laws. To the extent we qualify as a service provider, we will act expeditiously to remove or disable access to material that is the subject of a valid infringement notice.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">3. What This Policy Covers</h3>
              <p>This Policy covers allegedly infringing material that we host or control (uploaded assets, mirrored files we store, user avatars, comments). It may also guide how we handle clear notices about embedded third-party players or deep links when removal on our side is technically feasible. We cannot control the entire public internet reachable through a proxy; for purely third-party sites you browse, send notices to that site's operator as well.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">4. Filing a DMCA Takedown Notice</h3>
              <p>To be valid under 17 U.S.C. § 512(c)(3), a notice must include substantially:</p>
              <ol className="list-decimal pl-5 space-y-1 mt-2">
                <li>Identification of the copyrighted work claimed to have been infringed;</li>
                <li>Identification of the material claimed to be infringing, and information reasonably sufficient to locate it (direct URLs, catalog titles, file names, timestamps);</li>
                <li>Your mailing address, telephone number, and email address;</li>
                <li>A statement that you have a good-faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law;</li>
                <li>A statement that the information in the notice is accurate, and under penalty of perjury, that you are authorized to act on behalf of the owner of an exclusive right that is allegedly infringed;</li>
                <li>Your physical or electronic signature (typed full legal name is acceptable for email).</li>
              </ol>
              <p className="mt-3">Send notices to:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Email: dmca@trojans.proxy</li>
                <li>CC (optional): contact@trojans.proxy</li>
                <li>Subject line: DMCA Takedown Notice</li>
              </ul>
              <p className="mt-3">We aim to review complete notices within approximately 48–72 hours of receipt, excluding weekends/holidays, but timing is not guaranteed.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">5. Counter-Notification</h3>
              <p>If you believe material was removed or disabled by mistake or misidentification, you may send a counter-notification meeting the requirements of 17 U.S.C. § 512(g).</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">6. Repeat Infringer Policy</h3>
              <p>In appropriate circumstances, we terminate accounts and access of users who are repeat infringers. We may also remove catalog items, mirrors, or embeds when we become aware of clear infringement.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">7. Misrepresentation (Section 512(f))</h3>
              <p>Knowingly materially misrepresenting that material is infringing — or was removed by mistake — may expose the notifier to liability for damages, including costs and attorneys' fees.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">8. Trademarks and Other Rights</h3>
              <p>For trademark, right-of-publicity, or similar complaints that are not pure DMCA copyright claims, email contact@trojans.proxy with "IP Complaint" in the subject.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">9. Games, Apps, Fan Content, and Audiovisual Media</h3>
              <p>Many titles in catalogs are third-party works. For film/TV/anime and similar audiovisual materials surfaced via third-party embeds or links, we typically do not host the underlying streams ourselves; valid notices should identify the precise URLs or UI locations on our Service that you want disabled.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">10. Proxy Browsing Disclaimer</h3>
              <p>Browsing arbitrary third-party websites through a proxy does not make us the host of that website's content. Notices solely about destinations we do not store should be directed to the destination operator.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">11. Fair Use and Other Defenses</h3>
              <p>Before filing, consider whether the use may be fair use, licensed, public domain, or otherwise authorized. When unsure, consult counsel. We are not your lawyer.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">12. Advertising Creatives</h3>
              <p>Ads are frequently served by Ad Partners. Copyright complaints about an ad creative should identify the creative and, where possible, be sent both to us and to the responsible ad network.</p>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">13. Contact</h3>
              <p>DMCA agent email: dmca@trojans.proxy</p>
              <p>General: contact@trojans.proxy</p>
              <p>Community: https://discord.trojans.proxy</p>
            </div>
          </div>
        );
      case 'credits':
        return (
          <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Trojans Legal</h1>
              <h2 className="text-lg font-semibold text-gray-200">Credits & Acknowledgments</h2>
              <p className="text-xs text-gray-500 mt-1">Built with ❤️ by the community</p>
            </div>
            <p>Trojans would not be possible without the incredible work of the open-source community. We would like to extend our deepest gratitude to the following projects, libraries, and individuals:</p>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">🎨 Frontend & UI</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>React & TypeScript</strong> – For providing the robust, type-safe foundation of our user interface.</li>
                <li><strong>Tailwind CSS</strong> – For the utility-first styling that enables our sleek, modern design.</li>
                <li><strong>Lucide Icons</strong> – For the beautiful, consistent iconography used throughout the hub.</li>
                <li><strong>Vite</strong> – For the blazing-fast build tool and development server.</li>
                <li><strong>PeteZah</strong> – For the original UI design inspiration that guided the look and feel of this project.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">⚙️ Backend & Proxy Engines</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Node.js & Express</strong> – For the fast, scalable backend API that powers the hub.</li>
                <li><strong>Ultraviolet</strong> – For the sophisticated service-worker based proxy engine.</li>
                <li><strong>Scramjet</strong> – For the experimental interception-based proxy transport.</li>
                <li><strong>BareMux & Bare Server</strong> – For the lightweight transport layer that makes proxying possible.</li>
                <li><strong>Epoxy & Libcurl</strong> – For additional transport flexibility and support.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">🛠️ Special Thanks</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>The <strong>Mercury Workshop</strong> team for their continuous innovation in proxy technology.</li>
                <li>All the <strong>contributors</strong> who have submitted pull requests, bug reports, and feature suggestions.</li>
                <li>Our <strong>community</strong> on Discord for their unwavering support and feedback.</li>
                <li>And most importantly, <strong>you</strong>, for using Trojans.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold text-base mt-6 mb-2">📬 Contact</h3>
              <p>If you believe your project should be credited here, please reach out to us at <strong>contact@trojans.proxy</strong>.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl max-h-[85vh] bg-[#111] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-[#161616]">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
            >
              <ArrowLeft size={16} /> Exit to Trojans
            </button>
            <div className="h-4 w-px bg-white/20"></div>
            <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition p-1 rounded-full hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {getContent()}
        </div>
        <div className="p-4 border-t border-white/10 flex justify-end bg-[#161616]">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
