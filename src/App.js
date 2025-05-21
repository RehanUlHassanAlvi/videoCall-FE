import React, { useState, useEffect, useRef } from "react";
import Video from "twilio-video";
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
} from "react-icons/fa";
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
  const [error, setError] = useState(null);

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();
  const localVideoTrackRef = useRef(null);
  const localAudioTrackRef = useRef(null);

  // Update device list and handle device changes
  const updateDevices = async () => {
    try {
      // Request permissions to ensure device labels are available
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter((d) => d.kind === "videoinput");
      const audios = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(videos);
      setAudioDevices(audios);

      // Set default devices if none selected or if selected device is no longer available
      if (!selectedVideoDevice || !videos.find((d) => d.deviceId === selectedVideoDevice)) {
        setSelectedVideoDevice(videos[0]?.deviceId || "");
      }
      if (!selectedAudioDevice || !audios.find((d) => d.deviceId === selectedAudioDevice)) {
        setSelectedAudioDevice(audios[0]?.deviceId || "");
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
      setError("Failed to access media devices. Please check permissions.");
    }
  };

  useEffect(() => {
    updateDevices();

    // Listen for device changes (e.g., camera plugged/unplugged)
    navigator.mediaDevices.addEventListener("devicechange", updateDevices);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", updateDevices);
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const attachTrack = (track, participantId) => {
    if (!track) return;
    const trackElement = track.attach();
    trackElement.setAttribute("data-participant-id", participantId);
    trackElement.style.width = "100%";
    trackElement.style.height = "100%";
    remoteMediaRef.current.appendChild(trackElement);
  };

  const detachTrack = (track) => {
    if (track) {
      const elements = track.detach();
      elements.forEach((element) => element.remove());
    }
  };

  const joinRoom = async () => {
    try {
      setError(null);
      const res = await fetch("https://video-call-be-sooty.vercel.app/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, room: roomName }),
      });
      const data = await res.json();

      // Create tracks with fallback if deviceId is invalid
      let localVideoTrack = null;
      let localAudioTrack = null;
      try {
        localVideoTrack = await Video.createLocalVideoTrack(
          selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : {}
        );
      } catch (err) {
        console.warn("Failed to create video track with selected device, falling back:", err);
        localVideoTrack = await Video.createLocalVideoTrack(); // Fallback to default
      }

      try {
        localAudioTrack = await Video.createLocalAudioTrack(
          selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : {}
        );
      } catch (err) {
        console.warn("Failed to create audio track with selected device, falling back:", err);
        localAudioTrack = await Video.createLocalAudioTrack(); // Fallback to default
      }

      localVideoTrackRef.current = localVideoTrack;
      localAudioTrackRef.current = localAudioTrack;

      const joinedRoom = await Video.connect(data.token, {
        name: roomName,
        tracks: [localAudioTrack, localVideoTrack],
      });

      setRoom(joinedRoom);

      // Attach local video
      localMediaRef.current.innerHTML = "";
      const videoElement = localVideoTrack.attach();
      videoElement.setAttribute("controls", "false");
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      localMediaRef.current.appendChild(videoElement);

      // Handle existing participants
      joinedRoom.participants.forEach((participant) => {
        participant.tracks.forEach((publication) => {
          if (publication.isSubscribed && publication.track) {
            attachTrack(publication.track, participant.sid);
          }
        });
        participant.on("trackSubscribed", (track) => {
          attachTrack(track, participant.sid);
        });
        participant.on("trackUnsubscribed", detachTrack);
      });

      // Handle new participants
      joinedRoom.on("participantConnected", (participant) => {
        participant.tracks.forEach((publication) => {
          if (publication.isSubscribed && publication.track) {
            attachTrack(publication.track, participant.sid);
          }
        });
        participant.on("trackSubscribed", (track) => {
          attachTrack(track, participant.sid);
        });
        participant.on("trackUnsubscribed", detachTrack);
      });

      // Handle participant disconnection
      joinedRoom.on("participantDisconnected", (participant) => {
        const elements = remoteMediaRef.current.querySelectorAll(
          `[data-participant-id="${participant.sid}"]`
        );
        elements.forEach((element) => element.remove());
      });

      // Handle track disabled/enabled
      joinedRoom.on("trackDisabled", (track, participant) => {
        const elements = remoteMediaRef.current.querySelectorAll(
          `[data-participant-id="${participant.sid}"]`
        );
        elements.forEach((element) => {
          if (track.kind === "video") element.style.display = "none";
        });
      });

      joinedRoom.on("trackEnabled", (track, participant) => {
        const elements = remoteMediaRef.current.querySelectorAll(
          `[data-participant-id="${participant.sid}"]`
        );
        elements.forEach((element) => {
          if (track.kind === "video") element.style.display = "block";
        });
      });
    } catch (error) {
      console.error("Error joining room:", error);
      setError(`Failed to join room: ${error.message}`);
    }
  };

  const disconnectRoom = () => {
    if (!room) return;
    try {
      // Stop and detach local tracks
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.stop();
        localVideoTrackRef.current.detach().forEach((element) => element.remove());
        localVideoTrackRef.current = null;
      }
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current.detach().forEach((element) => element.remove());
        localAudioTrackRef.current = null;
      }

      // Disconnect the room
      room.disconnect();
      setRoom(null);

      // Clear media containers
      localMediaRef.current.innerHTML = "";
      remoteMediaRef.current.innerHTML = "";

      // Reset video and audio enabled states
      setIsVideoEnabled(true);
      setIsAudioEnabled(true);

      setError(null);
    } catch (error) {
      console.error("Error disconnecting from room:", error);
      setError(`Failed to disconnect: ${error.message}`);
    }
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
    try {
      setError(null);
      const currentTrack = localVideoTrackRef.current;
      let newVideoTrack;
      try {
        newVideoTrack = await Video.createLocalVideoTrack({
          deviceId: { exact: deviceId },
        });
      } catch (err) {
        console.warn("Failed to switch video device, falling back:", err);
        newVideoTrack = await Video.createLocalVideoTrack(); // Fallback to default
      }

      await room.localParticipant.unpublishTrack(currentTrack);
      await room.localParticipant.publishTrack(newVideoTrack);

      localMediaRef.current.innerHTML = "";
      const videoElement = newVideoTrack.attach();
      videoElement.setAttribute("controls", "false");
      videoElement.style.width = "100%";
      videoElement.style.height = "100%";
      localMediaRef.current.appendChild(videoElement);

      currentTrack.stop();
      localVideoTrackRef.current = newVideoTrack;
      setSelectedVideoDevice(deviceId);
    } catch (error) {
      console.error("Error switching video device:", error);
      setError(`Failed to switch video device: ${error.message}`);
    }
  };

  const switchAudioDevice = async (deviceId) => {
    if (!room || !localAudioTrackRef.current) return;
    try {
      setError(null);
      const currentTrack = localAudioTrackRef.current;
      let newAudioTrack;
      try {
        newAudioTrack = await Video.createLocalAudioTrack({
          deviceId: { exact: deviceId },
        });
      } catch (err) {
        console.warn("Failed to switch audio device, falling back:", err);
        newAudioTrack = await Video.createLocalAudioTrack(); // Fallback to default
      }

      await room.localParticipant.unpublishTrack(currentTrack);
      await room.localParticipant.publishTrack(newAudioTrack);

      currentTrack.stop();
      localAudioTrackRef.current = newAudioTrack;
      setSelectedAudioDevice(deviceId);
    } catch (error) {
      console.error("Error switching audio device:", error);
      setError(`Failed to switch audio device: ${error.message}`);
    }
  };

  return (
    <div className="container">
      <h1>🎥 Twilio Video Chat</h1>

      {error && <div className="error-message">{error}</div>}

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
        <button onClick={joinRoom} disabled={room}>Join Room</button>
        <button onClick={disconnectRoom} disabled={!room}>Disconnect</button>
      </div>

      <div className="video-section">
        <div className="video-wrapper">
          <h2>🧑‍💻 You</h2>
          <div className="video-box" ref={localMediaRef}></div>
          <div className="video-controls">
            <button onClick={toggleAudio} title="Toggle Microphone" disabled={!room}>
              {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
            <button onClick={toggleVideo} title="Toggle Camera" disabled={!room}>
              {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
            </button>
            <select
              value={selectedVideoDevice}
              onChange={(e) => switchVideoDevice(e.target.value)}
              title="Select Camera"
              disabled={!videoDevices.length || !room}
            >
              {videoDevices.length ? (
                videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    🎥 {device.label || "Camera"}
                  </option>
                ))
              ) : (
                <option value="">No cameras available</option>
              )}
            </select>
            <select
              value={selectedAudioDevice}
              onChange={(e) => switchAudioDevice(e.target.value)}
              title="Select Microphone"
              disabled={!audioDevices.length || !room}
            >
              {audioDevices.length ? (
                audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    🎤 {device.label || "Microphone"}
                  </option>
                ))
              ) : (
                <option value="">No microphones available</option>
              )}
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