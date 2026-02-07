'use client';

import { useEffect } from 'react';

/**
 * Debug helpers component that loads debugging utilities in development mode
 */
export default function DebugHelpers() {
  useEffect(() => {
    // Only load debug utilities in development
    if (process.env.NODE_ENV === 'development') {
      import('@/lib/utils/walletStorageDebug');
    }
  }, []);

  // This component doesn't render anything
  return null;
}