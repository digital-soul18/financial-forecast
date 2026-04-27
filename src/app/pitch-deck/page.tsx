'use client';

import { Download, ExternalLink } from 'lucide-react';

const PDF_URL = '/ConversationalAI-Investor-Pack.pdf';

export default function PitchDeckPage() {
  return (
    /*
     * Fixed panel that fills exactly the available viewport space:
     *   Mobile:  top-14 (below the 56px fixed mobile header), left-0
     *   Desktop: top-0,  left-56 (right of the 224px sidebar)
     */
    <div className="fixed top-14 md:top-0 left-0 md:left-56 right-0 bottom-0 flex flex-col bg-gray-950 z-10">
      {/* Thin top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 shrink-0">
        <div>
          <p className="text-xs text-violet-400 uppercase tracking-widest font-semibold">Investor Materials</p>
          <h1 className="text-sm font-semibold text-gray-100 leading-tight">Pitch Deck — Conversational AI</h1>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in tab
          </a>
          <a
            href={PDF_URL}
            download="ConversationalAI-Investor-Pack.pdf"
            className="flex items-center gap-1.5 text-xs text-gray-200 bg-violet-700 hover:bg-violet-600 px-3 py-1.5 rounded-md transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      </div>

      {/* Full-bleed native PDF iframe */}
      <iframe
        src={`${PDF_URL}#toolbar=1&navpanes=0&pagemode=none&zoom=page-width`}
        className="flex-1 w-full border-0 bg-black"
        style={{ colorScheme: 'dark' }}
        title="Conversational AI Investor Pitch Deck"
      />
    </div>
  );
}
