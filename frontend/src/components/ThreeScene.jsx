import { useEffect, useRef, useContext } from 'react';
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ThemeContext } from '../App';

const ThreeScene = () => {
  const mountRef = useRef(null);
  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    // Set size and background color based on theme
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setClearColor(theme === 'dark' ? 0x000033 : 0xf0f4f8, 0.5);

    // Create particles
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 5000;
    
    // FIX: Initialize position array properly to avoid NaN values
    const posArray = new Float32Array(particlesCount * 3); // Only 3 values per particle (x, y, z)
    
    // Set random positions ensuring they are valid numbers
    for(let i = 0; i < particlesCount * 3; i++) {
      // Generate random values between -5 and 5
      posArray[i] = (Math.random() - 0.5) * 10;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    // Create material with color based on theme
    const particlesMaterial = new THREE.PointsMaterial({
      size: 0.005,
      color: theme === 'dark' ? '#cc2b5e' : '#9c2148', // Slightly darker for light theme
      blending: THREE.AdditiveBlending,
      transparent: true
    });

    // Create particle system
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Add ambient light with intensity based on theme
    const ambientLight = new THREE.AmbientLight(0xffffff, theme === 'dark' ? 0.5 : 0.8);
    scene.add(ambientLight);

    // Camera position
    camera.position.z = 2;

    // Mouse movement effect
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (event) => {
      mouseX = event.clientX / window.innerWidth - 0.5;
      mouseY = event.clientY / window.innerHeight - 0.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);

      // Rotate particles
      particlesMesh.rotation.y += 0.001;
      particlesMesh.rotation.x += 0.001;

      // Mouse follow effect
      gsap.to(particlesMesh.rotation, {
        x: -mouseY * 0.5,
        y: mouseX * 0.5,
        duration: 2
      });

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    // Mount
    if (mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    // Cleanup/Unmount
    return () => {
      if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      particlesGeometry.dispose();
      particlesMaterial.dispose();
    };
  }, [theme]); // Add theme as dependency to re-render when it changes

  return <div ref={mountRef} className="w-full h-full" />;
};

export default ThreeScene;