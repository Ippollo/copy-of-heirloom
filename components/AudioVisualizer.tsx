
import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  analyser?: AnalyserNode | null;
  strokeColor?: string;
  mode?: 'wave' | 'bar' | 'circle' | 'orb';
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
    isRecording, 
    analyser,
    strokeColor = '#a18072',
    mode = 'wave'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle High DPI Displays
    const dpr = window.devicePixelRatio || 1;
    // Get display size
    const rect = canvas.getBoundingClientRect();
    
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;
    const centerX = width / 2;

    // Initialize buffer
    let dataArray: Uint8Array;
    if (analyser) {
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    }
    
    // Optimization: Define wave config outside loop
    const waves = [
        { alpha: 1.0, speed: 1.0, freq: 1.0, amp: 1.0 },
        { alpha: 0.5, speed: 0.7, freq: 0.8, amp: 0.7 },
        { alpha: 0.2, speed: 0.5, freq: 1.2, amp: 0.4 }
    ];

    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      // Clear
      ctx.clearRect(0, 0, width, height);

      if (!isRecording) {
         // Idle State: Gentle breathing line
         phaseRef.current += 0.05;
         ctx.beginPath();
         ctx.strokeStyle = strokeColor;
         ctx.lineWidth = 2 * dpr;
         ctx.globalAlpha = 0.5;
         
         for (let x = 0; x <= width; x += 20) { // Increased step for idle
             const y = centerY + Math.sin((x * 0.01) + phaseRef.current) * (10 * dpr);
             if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
         }
         ctx.stroke();
         ctx.globalAlpha = 1.0;
         return;
      }

      if (analyser) {
          if (mode === 'wave') {
              // --- CALMING WAVE ---
              analyser.getByteFrequencyData(dataArray);
              
              // Calculate Volume (RMS-ish) - Optimized loop
              const range = Math.floor(dataArray.length * 0.3); // Focus on voice freqs
              let sum = 0;
              for (let i = 0; i < range; i+=2) sum += dataArray[i]; // Sample every other bin
              const volume = (sum * 2) / range; // 0 - 255
              
              const normVol = Math.max(0.1, volume / 200); // Baseline 0.1 for visibility
              
              phaseRef.current += 0.15; // Speed
              
              const maxAmp = (height / 3);

              // Draw 3 overlapping waves
              for (let wIndex = 0; wIndex < 3; wIndex++) {
                  const w = waves[wIndex];
                  ctx.beginPath();
                  ctx.strokeStyle = strokeColor;
                  ctx.lineWidth = 3 * dpr;
                  ctx.globalAlpha = w.alpha;
                  
                  const wavePhase = phaseRef.current * w.speed;
                  const waveAmp = maxAmp * normVol * w.amp;
                  
                  // Use fewer points for smoother curve approximation (or just enough for screen)
                  for (let x = 0; x <= width; x += 10) {
                      const scaledX = x * 0.005 * w.freq;
                      const y = centerY + Math.sin(scaledX + wavePhase) * waveAmp;
                      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                  }
                  ctx.stroke();
              }
              ctx.globalAlpha = 1.0;

          } else if (mode === 'orb') {
              analyser.getByteFrequencyData(dataArray);
              
              const radius = 50 * dpr;
              
              // Core
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius * 0.8, 0, 2 * Math.PI);
              ctx.fillStyle = strokeColor;
              ctx.shadowBlur = 20 * dpr;
              ctx.shadowColor = strokeColor;
              ctx.fill();
              ctx.shadowBlur = 0;

              // Frequency Ring
              const bars = 40; // Reduced bar count for speed
              const step = (Math.PI * 2) / bars;
              
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = 2 * dpr;
              ctx.beginPath();
              for (let i = 0; i < bars; i++) {
                  const value = dataArray[i * 4]; // Sample wider range
                  const barHeight = (value / 255) * (50 * dpr);
                  
                  const angle = i * step;
                  const x1 = centerX + Math.cos(angle) * radius;
                  const y1 = centerY + Math.sin(angle) * radius;
                  const x2 = centerX + Math.cos(angle) * (radius + barHeight);
                  const y2 = centerY + Math.sin(angle) * (radius + barHeight);

                  ctx.moveTo(x1, y1);
                  ctx.lineTo(x2, y2);
              }
              ctx.stroke();

          } else if (mode === 'circle') {
             analyser.getByteTimeDomainData(dataArray);
             let sum = 0;
             // Sample optimization
             for(let i = 0; i < dataArray.length; i+=4) sum += Math.abs(dataArray[i] - 128);
             const average = (sum * 4) / dataArray.length;
             const scale = 1 + (average / 30);

             ctx.beginPath();
             ctx.arc(width / 2, height / 2, (40 * dpr) * scale, 0, 2 * Math.PI);
             ctx.strokeStyle = strokeColor;
             ctx.lineWidth = 2 * dpr;
             ctx.stroke();
             
             ctx.beginPath();
             ctx.arc(width / 2, height / 2, (35 * dpr) * scale, 0, 2 * Math.PI);
             ctx.fillStyle = strokeColor;
             ctx.globalAlpha = 0.2;
             ctx.fill();
             ctx.globalAlpha = 1.0;

          } else if (mode === 'bar') {
              analyser.getByteFrequencyData(dataArray);
              const barCount = 32; 
              const step = Math.floor(dataArray.length / barCount);
              const barWidth = (width / barCount) * 0.8;
              const gap = (width / barCount) * 0.2;
              
              ctx.fillStyle = strokeColor;
              ctx.beginPath();
              for (let i = 0; i < barCount; i++) {
                  const value = dataArray[i * step];
                  const barHeight = (value / 255) * height;
                  const x = i * (barWidth + gap) + (gap / 2);
                  
                  ctx.roundRect(x, height - barHeight, barWidth, barHeight, 4 * dpr);
              }
              ctx.fill();
          }
      }
    };

    animate();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRecording, analyser, strokeColor, mode]);

  return (
    <canvas 
        ref={canvasRef} 
        className="w-full h-full"
    />
  );
};

export default AudioVisualizer;
