import React from 'react';

export default function RecordingIndicator({ isRecording }: { isRecording: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {isRecording && (<div style={{ width: 12, height: 12, background: 'red', borderRadius: 12 }} />)}
      <div>{isRecording ? 'Recording' : 'Not recording'}</div>
    </div>
  );
}
