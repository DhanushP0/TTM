import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three-stdlib';

export default function PageNotFound() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const modelPath = '/monkey_d_luffy.glb';
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Scene objects stored in refs to be accessible across functions
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const animationMixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef(new THREE.Clock());

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Setup and handle the 3D scene
  useEffect(() => {
    const currentContainer = isFullscreen ? fullscreenContainerRef.current : containerRef.current;
    if (!currentContainer) return;
    
    // Initialize Three.js scene
    const initScene = () => {
      // Create scene if it doesn't exist yet
      if (!sceneRef.current) {
        sceneRef.current = new THREE.Scene();
        sceneRef.current.background = new THREE.Color(0x001c55); // Deep blue ocean color
      }

      // Camera
      if (!cameraRef.current) {
        cameraRef.current = new THREE.PerspectiveCamera(
          50,
          currentContainer.clientWidth / currentContainer.clientHeight,
          0.1,
          1000
        );
        cameraRef.current.position.set(0, 0, 5);
      } else {
        // Update camera aspect ratio
        cameraRef.current.aspect = currentContainer.clientWidth / currentContainer.clientHeight;
        cameraRef.current.updateProjectionMatrix();
      }

      // Renderer
      if (!rendererRef.current) {
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current.shadowMap.enabled = true;
        rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      
      rendererRef.current.setSize(currentContainer.clientWidth, currentContainer.clientHeight);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      
      // Clear previous canvas if it exists
      while (currentContainer.firstChild) {
        currentContainer.removeChild(currentContainer.firstChild);
      }
      currentContainer.appendChild(rendererRef.current.domElement);

      // Lighting setup
      if (sceneRef.current.children.length === 0) {
        // Main soft ambient light
        const ambientLight = new THREE.AmbientLight(0xccddff, 0.6);
        sceneRef.current.add(ambientLight);

        // Key light (main directional light)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(2, 2, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        sceneRef.current.add(directionalLight);

        // Fill light (opposite of key light)
        const fillLight = new THREE.DirectionalLight(0x8494ff, 0.5);
        fillLight.position.set(-2, 0, -1);
        sceneRef.current.add(fillLight);

        // Rim light (highlights the outline of the character)
        const rimLight = new THREE.DirectionalLight(0xffd6a5, 0.7);
        rimLight.position.set(0, 3, -2);
        sceneRef.current.add(rimLight);

        // Add ocean-themed fog
        sceneRef.current.fog = new THREE.FogExp2(0x001c55, 0.03);
      }

      // Controls
      if (!controlsRef.current) {
        controlsRef.current = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
        controlsRef.current.enableDamping = true;
        controlsRef.current.dampingFactor = 0.05;
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = 0.8;
        controlsRef.current.enableZoom = true;
      } else {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      // Load model if not already loaded
      if (!modelRef.current) {
        const loader = new GLTFLoader();
        
        interface GLTF {
          scene: THREE.Object3D;
          animations: THREE.AnimationClip[];
        }

        interface LoaderProgressEvent extends ProgressEvent<EventTarget> {
          loaded: number;
          total: number;
        }

        loader.load(
          modelPath,
          (gltf: GLTF) => {
            modelRef.current = gltf.scene;
            
            // Setup animations if they exist
            if (gltf.animations && gltf.animations.length) {
              animationMixerRef.current = new THREE.AnimationMixer(modelRef.current as THREE.Object3D);
              
              // Play all animations or specific ones
              gltf.animations.forEach((clip: THREE.AnimationClip) => {
                animationMixerRef.current!.clipAction(clip).play();
              });
            }
            
            // Center and scale the model
            const box = new THREE.Box3().setFromObject(modelRef.current as THREE.Object3D);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2.5 / maxDim;
            (modelRef.current as THREE.Object3D).scale.set(scale, scale, scale);
            
            (modelRef.current as THREE.Object3D).position.sub(center.multiplyScalar(scale));
            (modelRef.current as THREE.Object3D).position.y -= 0.5; // Slight adjustment for better framing
            
            // Ensure shadows are cast and received
            (modelRef.current as THREE.Object3D).traverse((node: THREE.Object3D) => {
              if ((node as any).isMesh) {
                (node as THREE.Mesh).castShadow = true;
                (node as THREE.Mesh).receiveShadow = true;
                
                // Improve material quality
                if ((node as THREE.Mesh).material) {
                  // @ts-expect-error: material may not have roughness/metalness, but most MeshStandardMaterial do
                  (node as THREE.Mesh).material.roughness = 0.8;
                  // @ts-expect-error: material may not have roughness/metalness, but most MeshStandardMaterial do
                  (node as THREE.Mesh).material.metalness = 0.2;
                }
              }
            });
            
            sceneRef.current!.add(modelRef.current as THREE.Object3D);
            setIsLoading(false);
          },
          (xhr: LoaderProgressEvent) => {
            setLoadingProgress((xhr.loaded / xhr.total) * 100);
          },
          (error: ErrorEvent | Error) => {
            console.error('Error loading 3D model:', error);
            setIsLoading(false);
          }
        );

        // Create stylized "Grand Line" ocean waves
        createOceanWaves();
        
        // Add One Piece themed particles (like tiny Jolly Rogers or stars)
        createThematicParticles();
      } else if (!sceneRef.current.children.includes(modelRef.current)) {
        // If model was loaded but removed from scene, add it back
        sceneRef.current.add(modelRef.current);
      }
    };

    // Create stylized ocean waves
    const createOceanWaves = () => {
      // Ocean plane
      const oceanGeometry = new THREE.PlaneGeometry(100, 100, 32, 32);
      
      // Custom shader material for animated waves
      const oceanMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a75ff,
        metalness: 0.3,
        roughness: 0.7,
        transparent: true,
        opacity: 0.8
      });
      
      const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
      ocean.rotation.x = -Math.PI / 2;
      ocean.position.y = -3;
      ocean.receiveShadow = true;
      if (sceneRef.current) {
        sceneRef.current.add(ocean);
      }
      
      // Animate ocean waves
      const waveAnimation = () => {
        const time = performance.now() * 0.001;
        const vertices = oceanGeometry.attributes.position.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
          // Skip boundary vertices to keep edges stable
          const x = vertices[i];
          const z = vertices[i + 2];
          
          // Only animate interior vertices
          if (Math.abs(x) < 48 && Math.abs(z) < 48) {
            vertices[i + 1] = 0.2 * Math.sin(x * 0.5 + time) * Math.cos(z * 0.5 + time);
          }
        }
        
        oceanGeometry.attributes.position.needsUpdate = true;
        requestAnimationFrame(waveAnimation);
      };
      
      waveAnimation();
    };

    // Create One Piece themed particles
    const createThematicParticles = () => {
      const particlesCount = 500;
      const particlesGeometry = new THREE.BufferGeometry();
      const posArray = new Float32Array(particlesCount * 3);
      
      // Create a sphere distribution for particles
      for (let i = 0; i < particlesCount; i++) {
        const i3 = i * 3;
        const radius = 15 + Math.random() * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        posArray[i3] = radius * Math.sin(phi) * Math.cos(theta);
        posArray[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        posArray[i3 + 2] = radius * Math.cos(phi);
      }
      
      particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      
      // Create star-like particles in One Piece colors
      const particlesMaterial = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xffd700, // Gold color like One Piece logo
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      
      const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
      if (sceneRef.current) {
        sceneRef.current.add(particlesMesh);
      }
      
      // Animate particles
      const animateParticles = () => {
        particlesMesh.rotation.y += 0.0005;
        requestAnimationFrame(animateParticles);
      };
      
      animateParticles();
    };

    // Handle window resize
    const onWindowResize = () => {
      if (!currentContainer) return;
      
      if (cameraRef.current) {
        cameraRef.current.aspect = currentContainer.clientWidth / currentContainer.clientHeight;
        cameraRef.current.updateProjectionMatrix();
      }
      if (rendererRef.current) {
        rendererRef.current.setSize(currentContainer.clientWidth, currentContainer.clientHeight);
      }
    };

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Update animations
      if (animationMixerRef.current) {
        const delta = clockRef.current.getDelta();
        animationMixerRef.current.update(delta);
      }
      
      // Render the scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    // Initialize and start animation
    initScene();
    const animationId = requestAnimationFrame(animate);
    window.addEventListener('resize', onWindowResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', onWindowResize);
      cancelAnimationFrame(animationId);
      
      if (isFullscreen) {
        setIsFullscreen(false);
      }
    };
  }, [isFullscreen]);

  // Key press handler for ESC to exit fullscreen
  useEffect(() => {
    interface KeyDownEvent extends KeyboardEvent {
      key: string;
    }

    const handleKeyDown = (event: KeyDownEvent): void => {
      if (event.key === 'Escape' && isFullscreen) {
      setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  return (
    <>
      {/* Fullscreen container - only visible when in fullscreen mode */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-indigo-950 flex flex-col items-center justify-center">
          <div 
            ref={fullscreenContainerRef} 
            className="w-full h-full"
          ></div>
          
          {/* Exit fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full transition-colors duration-200 shadow-lg z-10"
            aria-label="Exit fullscreen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-900/70 backdrop-blur-md">
              <div className="w-24 h-24 relative">
                <div className="absolute inset-0 border-4 border-t-yellow-400 border-r-red-500 border-b-blue-500 border-l-transparent rounded-full animate-spin"></div>
                <img 
                  src="/straw-hat-logo.png" 
                  alt="Straw Hat Pirates Logo" 
                  className="absolute inset-0 m-auto w-16 h-16"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="text-yellow-300 mt-4 text-xl font-bold">{Math.round(loadingProgress)}%</div>
              <p className="text-blue-300 mt-2 italic">Loading the adventure...</p>
            </div>
          )}
        </div>
      )}

      {/* Regular page content - hidden when in fullscreen mode */}
      {!isFullscreen && (
        <div className="min-h-screen bg-gradient-to-b from-blue-900 via-indigo-900 to-purple-900 flex flex-col items-center justify-center p-4 text-white relative overflow-hidden">
          {/* One Piece themed decorative elements */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Stylized ocean waves background */}
            <div className="absolute inset-0 opacity-10">
              <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="none">
                <path 
                  d="M0,800 C200,750 400,850 600,800 C800,750 1000,850 1200,800 V1000 H0 V800 Z" 
                  fill="url(#oceanGradient)" 
                />
                <path 
                  d="M0,820 C300,770 600,870 900,820 C1050,795 1150,845 1200,820 V1000 H0 V820 Z" 
                  fill="url(#oceanGradient)" 
                  opacity="0.5"
                />
                <defs>
                  <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4299e1" />
                    <stop offset="50%" stopColor="#3182ce" />
                    <stop offset="100%" stopColor="#2c5282" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            {/* Pirate themed decorative elements */}
            <div className="absolute top-10 left-10 w-24 h-24 opacity-20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#ffd700" strokeWidth="2" />
                <path d="M30,40 L70,40 L70,70 L50,90 L30,70 Z" fill="#ffd700" />
                <circle cx="40" cy="55" r="5" fill="#000" />
                <circle cx="60" cy="55" r="5" fill="#000" />
                <path d="M40,75 L60,75" stroke="#000" strokeWidth="3" />
              </svg>
            </div>
            
            <div className="absolute bottom-10 right-10 w-32 h-32 opacity-20 rotate-12">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#ffd700" strokeWidth="3" />
                <path d="M25,60 L75,60 M25,40 L75,40 M50,25 L50,75" stroke="#ffd700" strokeWidth="3" />
              </svg>
            </div>
          </div>

          <div className="z-10 w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Content side */}
            <div className="md:w-1/2 text-center md:text-left md:pr-8 space-y-6">
              <div className="inline-block px-4 py-2 rounded-full bg-red-600/70 backdrop-blur-sm border border-yellow-500/50 mb-4 transform -rotate-2">
                <span className="text-lg font-bold text-yellow-300">ERROR 404</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl font-bold font-pirate text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-red-500 to-yellow-300 transform -rotate-1">
                ISLAND NOT FOUND!
              </h1>
              
              <p className="text-blue-200 text-lg md:text-xl italic">
                "Yohohoho! Seems you've sailed to a mysterious island that doesn't exist on any map! Not even my eyes could see it... Though I don't have eyes! SKULL JOKE!"
              </p>
              
              <div className="flex flex-wrap gap-4 justify-center md:justify-start mt-6">
                <button
                  onClick={() => navigate('/')}
                  className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 border-2 border-yellow-500 rounded-lg shadow-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 flex items-center space-x-2 group"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="font-bold">Return to Ship</span>
                </button>
              </div>
            </div>
            
            {/* 3D model container */}
            <div className="md:w-1/2 w-full relative">
              <div className="absolute inset-0 bg-blue-900/30 rounded-2xl -rotate-1 translate-x-2 translate-y-2 border-2 border-blue-700/50"></div>
              
              <div 
                ref={containerRef} 
                className="w-full h-64 md:h-96 rounded-2xl overflow-hidden shadow-2xl shadow-indigo-900/50 border-2 border-yellow-500/70 bg-blue-900/40 relative z-10"
              ></div>
              
              {isLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/70 backdrop-blur-md rounded-2xl z-20">
                  <div className="w-20 h-20 relative">
                    <div className="absolute inset-0 border-4 border-t-yellow-400 border-r-red-500 border-b-blue-500 border-l-transparent rounded-full animate-spin"></div>
                    <img 
                      src="/straw-hat-logo.png" 
                      alt="Straw Hat Pirates Logo" 
                      className="absolute inset-0 m-auto w-12 h-12"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-yellow-300 mt-4 font-bold">{Math.round(loadingProgress)}%</div>
                  <p className="text-blue-300 mt-2 italic text-sm">Loading the adventure...</p>
                </div>
              )}
              
              {/* Maximize button */}
              <button
                onClick={toggleFullscreen}
                className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full transition-colors duration-200 shadow-lg z-20"
                aria-label="Maximize 3D model"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                </svg>
              </button>
              
              {/* One Piece themed decorative elements around the model */}
              <div className="absolute -top-6 -right-6 transform rotate-12">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="28" stroke="#ffd700" strokeWidth="2" fill="none" />
                  <circle cx="30" cy="30" r="24" stroke="#ffd700" strokeWidth="1" fill="none" />
                  <path d="M15,30 L45,30 M30,15 L30,45" stroke="#ffd700" strokeWidth="2" />
                </svg>
              </div>
              
              <div className="absolute -bottom-8 -left-8 transform -rotate-12">
                <svg width="80" height="80" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="38" stroke="#ffd700" strokeWidth="1" fill="none" />
                  <path d="M20,30 L60,30 L60,50 L40,70 L20,50 Z" fill="#ffd700" fillOpacity="0.2" stroke="#ffd700" strokeWidth="1" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Interactive hint */}
          <div className="absolute bottom-4 text-center text-yellow-300 text-sm flex items-center space-x-2 bg-blue-900/40 px-4 py-2 rounded-full backdrop-blur-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>Drag to explore • Press the expand button to maximize</span>
          </div>
          
          {/* One Piece styled footer signature */}
          <div className="absolute bottom-4 right-4 opacity-70">
            <svg xmlns="http://www.w3.org/2000/svg" width="120" height="30" viewBox="0 0 120 30">
              <path d="M5,15 C20,5 40,25 60,15 C80,5 100,25 115,15" stroke="#ffd700" strokeWidth="1" fill="none" />
              <text x="40" y="12" fontFamily="serif" fontSize="10" fill="#ffd700">STRAW HAT PIRATES</text>
            </svg>
          </div>
        </div>
      )}
    </>
  );
}