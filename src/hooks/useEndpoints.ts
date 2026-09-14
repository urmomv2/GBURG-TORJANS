// src/hooks/useEndpoints.ts
import { useState, useEffect } from 'react';

export interface Endpoints {
  // Folders
  scramjet: string;
  ultraviolet: string;
  alloy: string;
  titanium: string;
  libcurl: string;
  google: string;
  youtube: string;
  tor: string;
  wisp: string;
  bare: string;
  sw: string;

  // UV core
  uvBundle: string;
  uvClient: string;
  uvConfig: string;
  uvHandler: string;
  uvSw: string;

  // Scramjet core
  scramBundle: string;
  scramSync: string;
  scramWasm: string;
  scramAll: string;
  sjBundle: string;
  sjSync: string;
  sjWasm: string;
  sjAll: string;
  startAll: string;

  resMain: string;
  resSync: string;
  resBin: string;

  kernelAll: string;
  kernelBundle: string;
  kernelSync: string;
  kernelWasm: string;

  // Public wrappers
  uvJs: string;
  uvSwJs: string;
  scramEmbed: string;
  youtubeEmbed: string;
  youtubeRegisterSw: string;
  ytRegisterSw: string;
  googleEmbed: string;
  googleConfig: string;
  libcurlEmbed: string;
  embedHtml: string;
  embedJs: string;
  loaderJs: string;
  pageJs: string;
  searchJs: string;
  indexJs: string;
  registerSw: string;
  swJs: string;
}

let cached: Endpoints | null = null;

export const useEndpoints = () => {
  const [endpoints, setEndpoints] = useState<Endpoints | null>(cached);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;
    fetch('/api/endpoints')
      .then((r) => r.json())
      .then((data) => {
        cached = data;
        setEndpoints(data);
      })
      .catch((err) => console.error('Failed to load endpoints', err))
      .finally(() => setLoading(false));
  }, []);

  return { endpoints, loading };
};