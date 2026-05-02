import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, Cpu, Zap, Mic, Gauge } from 'lucide-react';
import { VOXEL_PATTERNS } from './constants';
import { audioService } from './services/AudioService';

// Voxel settings
const VOXEL_SIZE = 0.5;
const GAP = 0.05;

const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(10);
  const [gameState, setGameState] = useState<'idle' | 'listening' | 'counting' | 'finished'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [shakeIntensity, setShakeIntensity] = useState(0);

  // Three.js Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const voxelGroupRef = useRef<THREE.Group | null>(null);
  const clockRef = useRef(new THREE.Clock());

  // Speech Recognition
  const recognitionRef = useRef<any>(null);

  // Initialize Audio & Speech
  const initProtocol = useCallback(async () => {
    audioService.init();
    setGameState('listening');

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        
        const commands = ['go', 'start', 'launch', 'begin', 'ready', 'ready to launch'];
        if (commands.some(cmd => transcript.includes(cmd))) {
          startCountdown();
          recognition.stop();
        }
      };

      recognition.onerror = () => setGameState('idle');
      recognition.start();
      recognitionRef.current = recognition;
    }
  }, []);

  // Initialize Three.js
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);

    const group = new THREE.Group();
    scene.add(group);
    voxelGroupRef.current = group;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0x00f3ff, 100);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const animate = () => {
      requestAnimationFrame(animate);
      const time = clockRef.current.getElapsedTime();

      if (group) {
        group.rotation.y = Math.sin(time * 0.5) * 0.1;
        // Jitter based on shake intensity
        if (shakeIntensity > 0) {
          group.position.x = (Math.random() - 0.5) * shakeIntensity * 0.2;
          group.position.y = (Math.random() - 0.5) * shakeIntensity * 0.2;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [shakeIntensity]);

  // Update Voxel Number
  useEffect(() => {
    if (!voxelGroupRef.current) return;
    const group = voxelGroupRef.current;
    
    // Clear previous
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
      group.remove(child);
    }

    // Do not render voxels once the sequence is finished or when count is 0
    if (gameState === 'finished' || count === 0) return;

    const pattern = VOXEL_PATTERNS[count.toString()];
    if (!pattern) return;
    const rows = pattern.length;
    const cols = pattern[0].length;
    const color = new THREE.Color(count <= 3 ? 0xff0033 : 0x00f3ff);

    const geometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
    pattern.forEach((row, y) => {
      row.forEach((active, x) => {
        if (active) {
          const material = new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: count <= 3 ? 8 : 4,
            metalness: 1,
            roughness: 0,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.x = (x - (cols - 1) / 2) * (VOXEL_SIZE + GAP);
          mesh.position.y = ((rows - 1 - y) - (rows - 1) / 2) * (VOXEL_SIZE + GAP);
          group.add(mesh);
        }
      });
    });
  }, [count, gameState]);

  const startCountdown = () => {
    setCount(10);
    setGameState('counting');
    if (!isMuted) {
      audioService.startCountdownSound();
      audioService.playTickSound(10);
    }
  };

  // Countdown Logic Loop
  useEffect(() => {
    if (gameState !== 'counting') return;

    if (count > 0) {
      const timer = setTimeout(() => {
        const next = count - 1;
        setCount(next);
        
        // Intensity increases
        const intensity = (11 - next) / 10;
        setShakeIntensity(intensity);
        
        if (!isMuted) {
          audioService.playTickSound(next);
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setGameState('finished');
      setShakeIntensity(0);
      if (!isMuted) {
        audioService.playFinalRevelation();
      }
    }
  }, [count, gameState, isMuted]);

  return (
    <div className={`relative w-full h-screen bg-dark-surface overflow-hidden transition-colors duration-500 ${count <= 3 && gameState === 'counting' ? 'bg-red-950/20' : ''}`}>
      {/* 3D View */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Cyber HUD Overlays */}
      <div className="absolute inset-0 z-10 p-8 flex flex-col pointer-events-none">
        
        {/* Top HUD */}
        <div className="flex justify-between items-start">
          <AnimatePresence>
            {(gameState === 'idle' || gameState === 'listening') && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                <div className="flex flex-col gap-0">
                  <div className="flex items-center gap-4">
                    <Cpu className="text-neon-cyan w-10 h-10 animate-pulse drop-shadow-[0_0_15px_#00f3ff]" />
                    <div className="flex flex-col">
                      <h1 className="font-sans font-black text-4xl md:text-5xl text-white tracking-tighter uppercase drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] leading-tight">
                        Google <span className="text-neon-cyan drop-shadow-[0_0_20px_#00f3ff]">Intelligence</span>
                      </h1>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 glass-card text-white/60 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>

        {/* Center Dashboard Elements */}
        <div className="flex-1 flex items-center justify-center relative">
          {gameState === 'idle' && (
            <motion.button 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              onClick={initProtocol}
              className="group relative z-50 pointer-events-auto px-16 py-8 rounded-full overflow-hidden"
            >
              <div className="absolute inset-0 bg-neon-cyan opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="absolute inset-x-0 bottom-0 h-1 bg-neon-cyan shadow-[0_0_20px_#00f3ff]" />
              <div className="flex flex-col items-center gap-3">
                <Mic className="text-neon-cyan w-8 h-8 animate-pulse" />
                <span className="font-sans font-black text-2xl text-white tracking-widest uppercase text-center">Initialize Link</span>
                <span className="font-mono text-[10px] text-neon-cyan/60 uppercase">Voice Auth Required</span>
              </div>
            </motion.button>
          )}

          {/* Circular Gauges */}
          {gameState !== 'finished' && (
            <svg className="absolute w-[85vh] h-[85vh] opacity-20 rotate-[-90deg]">
               <circle cx="50%" cy="50%" r="44%" stroke="white" strokeWidth="1" fill="none" strokeDasharray="2 20" />
               <motion.circle 
                 cx="50%" cy="50%" r="44%" 
                 stroke={count <= 3 ? "#ff0033" : "#00f3ff"} 
                 strokeWidth="4" fill="none" 
                 strokeDasharray="1 1"
                 animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.02, 1] }}
                 transition={{ duration: 1, repeat: Infinity }}
               />
            </svg>
          )}

          {/* Main Hero Number (Neon Overlay) */}
          <AnimatePresence mode="popLayout">
            {gameState === 'counting' && count > 0 && (
              <motion.div
                key={count}
                initial={{ scale: 2, opacity: 0, filter: 'blur(20px)' }}
                animate={{ 
                  scale: 1, 
                  opacity: 0.9, 
                  filter: 'blur(0px)',
                  x: (Math.random() - 0.5) * shakeIntensity * 60,
                  y: (Math.random() - 0.5) * shakeIntensity * 60 
                }}
                exit={{ scale: 0.4, opacity: 0, filter: 'blur(10px)' }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className={`absolute z-20 font-sans select-none leading-none pointer-events-none text-[35vw] font-black italic tracking-tighter ${
                  count <= 3 
                    ? 'text-red-500 drop-shadow-[0_0_50px_rgba(255,0,0,0.8)]' 
                    : 'text-neon-cyan drop-shadow-[0_0_50px_rgba(0,243,255,0.8)]'
                }`}
              >
                {count}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <AnimatePresence mode="wait">
            {gameState === 'finished' && (
              <div key="finished" className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible">
                 {/* Falling celebration sparkles - LARGER */}
                 {Array.from({length: 60}).map((_, i) => (
                   <div 
                     key={i}
                     className="absolute bg-neon-cyan rounded-full animate-sparkle-fall shadow-[0_0_15px_rgba(0,243,255,0.8)]"
                     style={{
                       width: `${Math.random() * 15 + 10}px`,
                       height: `${Math.random() * 15 + 10}px`,
                       left: `${Math.random() * 100}%`,
                       top: '-10%',
                       opacity: Math.random() * 0.9 + 0.1,
                       animationDelay: `${Math.random() * 6}s`,
                       animationDuration: `${2 + Math.random() * 3}s`
                     }}
                   />
                 ))}

                 {/* Left Flag (Upright Hanging) */}
                 <motion.div 
                   initial={{ y: -800, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ type: "spring", bounce: 0.4, duration: 1.5 }}
                   className="absolute left-10 top-0 flex flex-col items-center"
                 >
                    <div className="w-1.5 h-[60vh] bg-gradient-to-b from-white via-white/80 to-transparent rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                    <div className="absolute top-10 left-1 animate-wave origin-top-left">
                      <div className="grid grid-cols-4 grid-rows-4 w-56 h-36 border-2 border-white/20 shadow-2xl">
                        {Array.from({length: 16}).map((_, i) => (
                          <div key={i} className={(Math.floor(i/4) + i) % 2 === 0 ? 'bg-white' : 'bg-black'} />
                        ))}
                      </div>
                    </div>
                 </motion.div>

                 {/* Right Flag (Upright Hanging) */}
                 <motion.div 
                   initial={{ y: -800, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ type: "spring", bounce: 0.4, duration: 1.5 }}
                   className="absolute right-10 top-0 flex flex-col items-center"
                 >
                    <div className="w-1.5 h-[60vh] bg-gradient-to-b from-white via-white/80 to-transparent rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                    <div className="absolute top-10 right-1 animate-wave origin-top-right">
                      <div className="grid grid-cols-4 grid-rows-4 w-56 h-36 border-2 border-white/20 shadow-2xl">
                        {Array.from({length: 16}).map((_, i) => (
                          <div key={i} className={(Math.floor(i/4) + i) % 2 === 0 ? 'bg-white' : 'bg-black'} />
                        ))}
                      </div>
                    </div>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="relative z-50 text-center flex flex-col items-center justify-center gap-8 md:gap-12 max-h-[90vh]"
                 >
                   <div className="flex flex-col items-center gap-2 md:gap-4">
                      <span className="text-neon-cyan font-black text-lg md:text-2xl tracking-[0.6em] md:tracking-[0.8em] drop-shadow-[0_0_15px_#00f3ff] uppercase">Google Intelligence</span>
                      <div className="flex flex-col items-center gap-0">
                        <h2 className="text-[5rem] md:text-[8rem] font-sans font-black text-white drop-shadow-[0_0_60px_rgba(0,243,255,0.8)] tracking-tighter leading-none uppercase">
                          I/O
                        </h2>
                        <h2 className="text-[4rem] md:text-[6rem] font-sans font-black text-neon-cyan animate-pulse tracking-[0.1em] leading-none drop-shadow-[0_0_40px_#00f3ff] uppercase">
                          2026
                        </h2>
                      </div>
                   </div>
                   
                   <div className="text-neon-cyan font-black text-4xl md:text-6xl tracking-[0.2em] md:tracking-[0.4em] uppercase text-center drop-shadow-[0_0_30px_#00f3ff] animate-pulse italic">
                     Launched
                   </div>
                 </motion.div>
              </div>
            )}
          </AnimatePresence>


          {gameState === 'listening' && (
            <motion.div 
              animate={{ opacity: [0.3, 1, 0.3] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="text-neon-cyan font-mono text-xl tracking-[0.5em] flex items-center gap-4"
            >
              <Mic size={24} />
              SPEAK "GO" OR "LAUNCH"
            </motion.div>
          )}
        </div>

        {/* Footer Dashboard */}
        {gameState !== 'finished' && (
          <footer className="flex flex-col md:flex-row gap-12 items-end justify-center w-full">
            
            {/* Tachometer / Progress */}
            <div className="flex flex-col items-center gap-4 py-4">
               <div className="flex gap-2">
                  {Array.from({length: 10}).map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-12 w-4 rounded-sm transition-all duration-300 ${
                          i < (10 - count) 
                            ? (i > 7 ? 'bg-red-500 shadow-[0_0_15px_red]' : 'bg-neon-cyan shadow-[0_0_10px_cyan]') 
                            : 'bg-white/5 border border-white/10'
                        }`} 
                      />
                  ))}
               </div>
               <div className="flex items-center gap-2 text-white/40 font-mono text-xs tracking-widest uppercase">
                  <Gauge size={14} />
                  <span>Propulsion Pressure</span>
               </div>
            </div>

            {/* Output Stats */}
            <div className="glass-card p-6 space-y-4">
                  <div className="flex justify-between items-end border-b border-white/10 pb-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/40 uppercase">Thrust_Force</span>
                      <span className="text-3xl font-sans font-black text-white">{(1 - (count/10)) * 100}%</span>
                    </div>
                    <Zap size={24} className={count <= 3 ? "text-red-500 animate-bounce" : "text-neon-cyan"} />
                  </div>
              
              <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-white/40 uppercase">
                <div className="flex flex-col">
                  <span>Core.v</span>
                  <span className="text-white">{(1200 / (count + 1)).toFixed(2)} mach</span>
                </div>
                <div className="flex flex-col text-right">
                  <span>Temp.k</span>
                  <span className={count <= 3 ? "text-red-500" : "text-white"}>
                    {(1500 + (10 - count) * 200).toLocaleString()}°
                  </span>
                </div>
              </div>
            </div>

          </footer>
        )}

      </div>

      {/* Screen Effects */}
      <div className={`absolute inset-0 pointer-events-none z-30 transition-opacity duration-150 ${shakeIntensity > 0 ? 'opacity-10' : 'opacity-0'}`}>
        <div className="w-full h-full bg-white animate-pulse" />
      </div>
      
      {/* Vignette & Grain */}
      <div className="absolute inset-0 z-40 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)] opacity-60" />
    </div>
  );
};

export default App;

