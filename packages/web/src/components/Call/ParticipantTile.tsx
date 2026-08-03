import React from 'react';

export default function ParticipantTile({ participant }: { participant: any }) {
  return (
    <div className="participant-tile">
      <div className="video-placeholder" style={{ background: '#222', height: 120, borderRadius: 8 }} />
      <div className="meta">{participant?.name ?? 'Unknown'}</div>
    </div>
  );
}
