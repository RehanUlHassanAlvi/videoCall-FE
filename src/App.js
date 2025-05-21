import React, { useState, useEffect, useRef } from "react";
import Video from "twilio-video";

function App() {
  const [identity, setIdentity] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState(null);

  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);

  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();

  // Fetch available devices
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videos = devices.filter(device => device.kind === "videoinput");
      const audios = devices.filter(device => device.kind === "audioinput");

      setVideoDevices(videos);
      setAudioDevices(audios);

      if (videos[0]) setSelectedVideoDevice(videos[0].deviceId);
      if (audios[0]) setSelectedAudioDevice(audios[0].deviceId);
    });
  }, []);

  const joinRoom = async () => {
    const res = await fetch("http://localhost:5000/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity, room: roomName }),
    });

    const data = await res.json();

    const localVideoTrack = await Video.createLocalVideoTrack({
      deviceId: { exact: selectedVideoDevice }
    });

    const localAudioTrack = await Video.createLocalAudioTrack({
      deviceId: { exact: selectedAudioDevice }
    });

    const room = await Video.connect(data.token, {
      name: roomName,
      tracks: [localAudioTrack, localVideoTrack],
    });

    setRoom(room);

    // Attach local tracks
    localMediaRef.current.innerHTML = "";
    localMediaRef.current.appendChild(localVideoTrack.attach());

    // Attach remote tracks
    const attachTrack = track => {
      remoteMediaRef.current.appendChild(track.attach());
    };

    room.on("participantConnected", participant => {
      participant.on("trackSubscribed", attachTrack);
    });

    room.participants.forEach(participant => {
      participant.tracks.forEach(publication => {
        if (publication.track) {
          attachTrack(publication.track);
        }
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

      <div>
        <label>Camera:</label>
        <select
          value={selectedVideoDevice}
          onChange={e => setSelectedVideoDevice(e.target.value)}
        >
          {videoDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Camera"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>Microphone:</label>
        <select
          value={selectedAudioDevice}
          onChange={e => setSelectedAudioDevice(e.target.value)}
        >
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || "Microphone"}
            </option>
          ))}
        </select>
      </div>

      <button onClick={joinRoom}>Join Room</button>

      <h2>Local Video</h2>
      <div ref={localMediaRef} />

      <h2>Remote Participants</h2>
      <div ref={remoteMediaRef} />
    </div>
  );
}

export default App;
