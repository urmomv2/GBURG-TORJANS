// src/hooks/useEndpoints.ts
import { useState, useEffect } from 'react';

export interface Endpoints {
  scramjet: string;
  ultraviolet: string;
  alloy: string;
  titanium: string;
  wisp: string;
  bare: string;
  sw: string;
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
