import React, { useState, useRef } from "react";
import Video from "twilio-video";

function App() {
  const [identity, setIdentity] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState(null);

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();

  const joinRoom = async () => {
    const res = await fetch("https://video-call-be-sooty.vercel.app/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity, room: roomName }),
    });

    const data = await res.json();

    Video.connect(data.token, {
      name: roomName,
      audio: true,
      video: { width: 640 },
    }).then(room => {
      setRoom(room);

      // Show local tracks
      Video.createLocalTracks().then(localTracks => {
        localTracks.forEach(track => {
          localMediaRef.current.appendChild(track.attach());
        });
      });

      // Show remote participant tracks
      room.on("participantConnected", participant => {
        participant.on("trackSubscribed", track => {
          remoteMediaRef.current.appendChild(track.attach());
        });
      });

      // Also show already connected participants
      room.participants.forEach(participant => {
        participant.tracks.forEach(publication => {
          if (publication.track) {
            remoteMediaRef.current.appendChild(publication.track.attach());
          }
        });
      });
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Twilio Video Call</h1>
      <input
        placeholder="Your Name"
        value={identity}
        onChange={(e) => setIdentity(e.target.value)}
      />
      <input
        placeholder="Room Name"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
      />
      <button onClick={joinRoom}>Join Room</button>

      <h2>Local Video</h2>
      <div ref={localMediaRef} />

      <h2>Remote Participants</h2>
      <div ref={remoteMediaRef} />
    </div>
  );
}

export default App;
