"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

// Helper to generate a random hex hash of variable length
const generateHash = () => {
  const length = Math.floor(Math.random() * 12) + 4; // 4 to 16 characters
  let hash = '0x';
  while (hash.length < length + 2) {
    hash += Math.random().toString(16).substr(2);
  }
  return hash.substring(0, length + 2).toUpperCase();
};

export default function BackgroundEffects() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Number of hashes to display based on screen size
    const numHashes = Math.floor((window.innerWidth * window.innerHeight) / 35000);
    
    // Clear existing
    if (containerRef.current) {
        containerRef.current.innerHTML = '';
    }
    
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < numHashes; i++) {
      const hashEl = document.createElement("div");
      hashEl.classList.add("hash-value");
      hashEl.innerText = generateHash();
      
      // Random positioning
      hashEl.style.position = "absolute";
      hashEl.style.left = `${Math.random() * 100}%`;
      hashEl.style.top = `${Math.random() * 100}%`;
      
      // Random rotation to make it feel more scattered
      const rotation = Math.random() > 0.5 ? 90 : 0;
      
    // Styling
      hashEl.style.fontFamily = "monospace";
      hashEl.style.fontSize = `${Math.random() * 12 + 12}px`; // 12px to 24px
      hashEl.style.color = "rgba(180, 240, 255, 0.5)"; // Lightened, softer cyan/white
      hashEl.style.opacity = "0"; 
      hashEl.style.pointerEvents = "none";
      hashEl.style.transform = `rotate(${rotation}deg)`;
      
      fragment.appendChild(hashEl);
    }
    
    if (containerRef.current) {
        containerRef.current.appendChild(fragment);
    }

    // Mutate the text slowly at a uniform pace
    const interval = setInterval(() => {
      if (!containerRef.current) return;
      const elements = containerRef.current.querySelectorAll('.hash-value');
      elements.forEach((el) => {
        (el as HTMLElement).innerText = generateHash();
      });
    }, 1000);

    // Animate the hashes drifting slowly while fading
    animate('.hash-value', {
      translateY: () => {
        const drift = Math.random() * 100 + 50; 
        return [drift, -drift]; // Drift upwards
      },
      translateX: () => {
        const drift = Math.random() * 40 - 20; 
        return [drift, -drift]; // Slight horizontal drift
      },
      opacity: [0, 0.4, 0], // Softer opacity
      duration: 12000, // Uniform, slow pace
      easing: 'linear', // Linear movement feels more like a continuous data stream
      delay: stagger(200, { start: 0, from: 'random' }),
      loop: true
    });

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 bg-gradient-to-br from-indigo-950/40 via-background to-cyan-950/40">
      {/* Anime.js Hashes */}
      <div ref={containerRef} className="absolute inset-0" />
      
      {/* Ambient static mesh for deep lighting - Made larger and softer */}
      <div className="absolute top-[-30%] left-[-20%] w-[120%] h-[120%] rounded-full bg-cyan-800/15 blur-[150px] mix-blend-screen" />
      <div className="absolute bottom-[-30%] right-[-20%] w-[100%] h-[100%] rounded-full bg-indigo-800/20 blur-[150px] mix-blend-screen" />
      <div className="absolute top-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-700/10 blur-[150px] mix-blend-screen" />
    </div>
  );
}
