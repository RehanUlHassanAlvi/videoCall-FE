import React, { useState, useEffect, useRef } from "react";
import Video from "twilio-video";
import "./App.css"; 

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

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videos = devices.filter(d => d.kind === "videoinput");
      const audios = devices.filter(d => d.kind === "audioinput");
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
      deviceId: { exact: selectedVideoDevice },
    });
    const localAudioTrack = await Video.createLocalAudioTrack({
      deviceId: { exact: selectedAudioDevice },
    });

    const joinedRoom = await Video.connect(data.token, {
      name: roomName,
      tracks: [localAudioTrack, localVideoTrack],
    });

    setRoom(joinedRoom);

    localMediaRef.current.innerHTML = "";
    localMediaRef.current.appendChild(localVideoTrack.attach());

    const attachTrack = track => {
      remoteMediaRef.current.appendChild(track.attach());
    };

    joinedRoom.on("participantConnected", participant => {
      participant.on("trackSubscribed", attachTrack);
    });

    joinedRoom.participants.forEach(participant => {
      participant.tracks.forEach(pub => {
        if (pub.track) attachTrack(pub.track);
      });
    });
  };

  return (
    <div className="container">
      <h1>Twilio Video Chat</h1>

      <div className="form-section">
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

        <select
          value={selectedVideoDevice}
          onChange={(e) => setSelectedVideoDevice(e.target.value)}
        >
          {videoDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              🎥 {device.label || "Camera"}
            </option>
          ))}
        </select>

        <select
          value={selectedAudioDevice}
          onChange={(e) => setSelectedAudioDevice(e.target.value)}
        >
          {audioDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              🎤 {device.label || "Microphone"}
            </option>
          ))}
        </select>

        <button onClick={joinRoom}>Join Room</button>
      </div>

      <div className="video-section">
        <div className="video-wrapper">
          <h2>🧑‍💻 You</h2>
          <div className="video-box" ref={localMediaRef}></div>
        </div>

        <div className="video-wrapper">
          <h2>👥 Others</h2>
          <div className="video-box" ref={remoteMediaRef}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
