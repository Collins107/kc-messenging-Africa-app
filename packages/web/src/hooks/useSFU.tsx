import { useEffect, useRef, useState } from 'react';

// Simple LiveKit client wrapper that uses mock behavior when LIVEKIT not configured
export function useSFU(roomName: string, token: string | null) {
  const [connected, setConnected] = useState(false);
  const participantsRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (!roomName || !token) return;
    // In CI/dev, we simulate connection
    const isMock = !process.env.REACT_APP_LIVEKIT_URL;
    if (isMock) {
      setTimeout(() => setConnected(true), 200);
      participantsRef.current['local'] = { id: 'local', name: 'You' };
      participantsRef.current['remote1'] = { id: 'remote1', name: 'Remote 1' };
    } else {
      // Real LiveKit client initialization would go here (deferred until credentials are provided)
      setConnected(true);
    }
    return () => { setConnected(false); };
  }, [roomName, token]);

  const publishTrack = async (_track: any) => { /* publish stub */ };
  const unpublishAll = async () => { /* stub */ };
  const leave = async () => { setConnected(false); };

  return { connected, participants: participantsRef.current, publishTrack, unpublishAll, leave };
}
