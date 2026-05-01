import { useEffect, useRef, useState } from "react";

export default function WebcamCanvas({
  videoRef,
  canvasRef,
  isRunning,
  onReady,
}) {
  const [cameraError, setCameraError] = useState("");
  const streamRef = useRef(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    let cancelled = false;
    let videoEl = null;

    async function startCamera() {
      if (streamRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        videoEl = videoRef.current;
        if (!videoEl) return;

        videoEl.srcObject = stream;
        await videoEl.play();
        setCameraError("");
        if (onReadyRef.current) onReadyRef.current();
      } catch (err) {
        setCameraError(err?.message || "Camera access denied");
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoEl?.srcObject) {
        videoEl.srcObject = null;
      }
    };
  }, [videoRef]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 760,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #2a2a2a",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: "100%", display: "block", transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: "scaleX(-1)",
        }}
      />

      {cameraError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            color: "#ef5350",
            fontWeight: 700,
            fontSize: 14,
            padding: 16,
            textAlign: "center",
          }}
        >
          {cameraError}
        </div>
      )}

      {!isRunning && !cameraError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.35)",
            color: "#FF6B35",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Camera ready
        </div>
      )}
    </div>
  );
}
