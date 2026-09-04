"use client";

import { motion } from "framer-motion";

interface AudioVisualizerProps {
  isRecording: boolean;
  volume: number; // 0 to 1
}

export function AudioVisualizer({ isRecording, volume }: AudioVisualizerProps) {
  // We'll create 5 concentric rings that react to volume
  const rings = [1, 2, 3, 4, 5];

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {rings.map((ring, idx) => {
        // Calculate dynamic scale based on volume and ring index
        // Inner rings react more aggressively than outer rings
        const baseScale = 1 + (idx * 0.2);
        const dynamicScale = isRecording 
          ? baseScale + (volume * (1 / (idx + 1))) 
          : baseScale;
          
        const opacity = isRecording 
          ? 0.4 - (idx * 0.05) + (volume * 0.2)
          : 0.1 - (idx * 0.01);

        return (
          <motion.div
            key={ring}
            animate={{
              scale: dynamicScale,
              opacity: opacity,
              borderColor: isRecording ? "rgba(6, 182, 212, 0.5)" : "rgba(100, 116, 139, 0.35)",
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 20,
              mass: 0.5,
            }}
            className="absolute rounded-full border-2"
            style={{
              width: "40px",
              height: "40px",
            }}
          />
        );
      })}

      {/* Core Node */}
      <motion.div
        animate={{
          scale: isRecording ? 1 + volume * 0.5 : 1,
          backgroundColor: isRecording ? "rgba(6, 182, 212, 1)" : "rgba(100, 116, 139, 0.5)",
          boxShadow: isRecording ? "0 0 40px rgba(251,108,0,0.8)" : "0 0 10px rgba(100,116,139,0.3)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
        className="w-4 h-4 rounded-full z-10"
      />
    </div>
  );
}
