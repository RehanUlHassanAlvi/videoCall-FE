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

  const localMediaRef = useRef();
  const remoteMediaRef = useRef();
  const localVideoTrackRef = useRef(null);
  const localAudioTrackRef = useRef(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const videos = devices.filter((d) => d.kind === "videoinput");
      const audios = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(videos);
      setAudioDevices(audios);
      if (videos[0]) setSelectedVideoDevice(videos[0].deviceId);
      if (audios[0]) setSelectedAudioDevice(audios[0].deviceId);
    });

    // Cleanup on unmount
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  const attachTrack = (track, participantId) => {
    if (!track) return;
    const trackElement = track.attach();
    trackElement.setAttribute("data-participant-id", participantId); // Track participant ID
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
      const currentTrack = localVideoTrackRef.current;
      const newVideoTrack = await Video.createLocalVideoTrack({
        deviceId: { exact: deviceId },
      });

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
    }
  };

  const switchAudioDevice = async (deviceId) => {
    if (!room || !localAudioTrackRef.current) return;
    try {
      const currentTrack = localAudioTrackRef.current;
      const newAudioTrack = await Video.createLocalAudioTrack({
        deviceId: { exact: deviceId },
      });

      await room.localParticipant.unpublishTrack(currentTrack);
      await room.localParticipant.publishTrack(newAudioTrack);

      currentTrack.stop();
      localAudioTrackRef.current = newAudioTrack;
      setSelectedAudioDevice(deviceId);
    } catch (error) {
      console.error("Error switching audio device:", error);
    }
  };

  return (
    <div className="container">
      <h1>🎥 Twilio Video Chat</h1>

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
            <button onClick={toggleAudio} title="Toggle Microphone">
              {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
            </button>
            <button onClick={toggleVideo} title="Toggle Camera">
              {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
            </button>
            <select
              value={selectedVideoDevice}
              onChange={(e) => switchVideoDevice(e.target.value)}
              title="Select Camera"
            >
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  🎥 {device.label || "Camera"}
                </option>
              ))}
            </select>
            <select
              value={selectedAudioDevice}
              onChange={(e) => switchAudioDevice(e.target.value)}
              title="Select Microphone"
            >
              {audioDevices.map((device) => (
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