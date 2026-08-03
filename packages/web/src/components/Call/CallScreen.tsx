import React from 'react';
import ParticipantTile from '../components/Call/ParticipantTile';
import RecordingIndicator from '../components/Call/RecordingIndicator';
import { useSFU } from '../hooks/useSFU';

export default function CallScreen({ roomName, token }: { roomName: string; token: string | null }) {
  const { connected, participants, leave } = useSFU(roomName, token);
  const participantList = Object.values(participants);
  const isRecording = false; // wire to backend status

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Call: {roomName}</h3>
        <div>
          <RecordingIndicator isRecording={isRecording} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {participantList.map((p: any) => (<ParticipantTile key={p.id} participant={p} />))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={() => leave()}>Leave</button>
      </div>

      {!connected && <div>Connecting...</div>}
    </div>
  );
}
