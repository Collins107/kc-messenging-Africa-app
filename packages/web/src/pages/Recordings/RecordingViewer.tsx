import React, { useEffect, useState } from 'react';

export default function RecordingViewer({ id }: { id: string }) {
  const [manifest, setManifest] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/recordings/${id}/manifest`).then((r) => r.json()).then((j) => setManifest(j.manifest ?? j));
  }, [id]);

  return (
    <div>
      <h3>Recording {id}</h3>
      {manifest ? (
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 12 }}>{manifest}</pre>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}
