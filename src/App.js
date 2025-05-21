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
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();
  const localVideoTrackRef = useRef(null);
  const localAudioTrackRef = useRef(null);

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
    const res = await fetch("https://video-call-be-sooty.vercel.app/api/token", {
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

    localVideoTrackRef.current = localVideoTrack;
    localAudioTrackRef.current = localAudioTrack;

    const joinedRoom = await Video.connect(data.token, {
      name: roomName,
      tracks: [localAudioTrack, localVideoTrack],
    });

    setRoom(joinedRoom);

    localMediaRef.current.innerHTML = "";
    const videoElement = localVideoTrack.attach();
    videoElement.setAttribute("controls", "false");
    localMediaRef.current.appendChild(videoElement);

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

  const toggleVideo = () => {
    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.enable(!isVideoEnabled);
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.enable(!isAudioEnabled);
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const switchVideoDevice = async (deviceId) => {
    if (!room || !localVideoTrackRef.current) return;
    const currentTrack = localVideoTrackRef.current;
    const newVideoTrack = await Video.createLocalVideoTrack({
      deviceId: { exact: deviceId },
    });

    // Replace the track in the room
    room.localParticipant.unpublishTrack(currentTrack);
    room.localParticipant.publishTrack(newVideoTrack);

    // Update the video element
    localMediaRef.current.innerHTML = "";
    const videoElement = newVideoTrack.attach();
    videoElement.setAttribute("controls", "false");
    localMediaRef.current.appendChild(videoElement);

    // Clean up old track
    currentTrack.stop();
    localVideoTrackRef.current = newVideoTrack;
    setSelectedVideoDevice(deviceId);
  };

  const switchAudioDevice = async (deviceId) => {
    if (!room || !localAudioTrackRef.current) return;
    const currentTrack = localAudioTrackRef.current;
    const newAudioTrack = await Video.createLocalAudioTrack({
      deviceId: { exact: deviceId },
    });

    // Replace the track in the room
    room.localParticipant.unpublishTrack(currentTrack);
    room.localParticipant.publishTrack(newAudioTrack);

    // Clean up old track
    currentTrack.stop();
    localAudioTrackRef.current = newAudioTrack;
    setSelectedAudioDevice(deviceId);
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
        <button onClick={joinRoom}>Join Room</button>
      </div>

      <div className="video-section">
        <div className="video-wrapper">
          <h2>🧑‍💻 You</h2>
          <div className="video-box" ref={localMediaRef}></div>
          <div className="video-controls">
            <button
              onClick={toggleAudio}
              aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              {isAudioEnabled ? "Mute Mic" : "Unmute Mic"}
            </button>
            <button
              onClick={toggleVideo}
              aria-label={isVideoEnabled ? "Turn off video" : "Turn on video"}
            >
              {isVideoEnabled ? "Turn Off Video" : "Turn On Video"}
            </button>
            <select
              value={selectedVideoDevice}
              onChange={(e) => switchVideoDevice(e.target.value)}
              aria-label="Select camera"
            >
              {videoDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  🎥 {device.label || "Camera"}
                </option>
              ))}
            </select>
            <select
              value={selectedAudioDevice}
              onChange={(e) => switchAudioDevice(e.target.value)}
              aria-label="Select microphone"
            >
              {audioDevices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  🎤 {device.label || "Microphone"}
                </option>
              ))}
            </select>
          </div>
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