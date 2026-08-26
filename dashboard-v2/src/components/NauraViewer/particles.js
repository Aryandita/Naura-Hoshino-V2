/**
 * particles.js - Sistem partikel cyber-anime untuk NauraViewer.
 *
 * Menghasilkan partikel bercahaya yang mengorbit di sekitar model,
 * menggunakan warna brand Naura (pink keunguan pastel).
 */

import * as THREE from 'three';

/**
 * Buat particle system.
 * @param {THREE.Group} modelScene - Objek model tempat partikel akan mengorbit
 * @returns {{ points: THREE.Points, update: (delta: number, elapsed: number) => void }}
 */
export function createParticleSystem(modelScene) {
    const particleCount = 250;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    // Data tambahan untuk animasi individual (fase, orbit speed, radius)
    const animData = [];

    const colorPink = new THREE.Color('#FFB6C1');
    const colorPurple = new THREE.Color('#C084FC');

    for (let i = 0; i < particleCount; i++) {
        // Sebar partikel dalam bentuk silinder/bola di sekitar model
        const theta = Math.random() * Math.PI * 2;
        const radius = 1.0 + Math.random() * 1.5;
        const y = (Math.random() - 0.5) * 3.0 + 1.0; // Offset Y agar menutupi seluruh tubuh

        positions[i * 3 + 0] = Math.cos(theta) * radius;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(theta) * radius;

        // Gradient acak antara pink dan ungu
        const mixedColor = colorPink.clone().lerp(colorPurple, Math.random());
        colors[i * 3 + 0] = mixedColor.r;
        colors[i * 3 + 1] = mixedColor.g;
        colors[i * 3 + 2] = mixedColor.b;

        sizes[i] = Math.random() * 0.05 + 0.02;

        animData.push({
            phase: Math.random() * Math.PI * 2,
            speed: (Math.random() - 0.5) * 0.5 + 0.1, // Orbit speed
            rY: (Math.random() - 0.5) * 0.2,          // Vertical drift
        });
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Shader material kustom sederhana untuk particle glowing
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                // Partikel berdenyut ukurannya
                float pulse = sin(time * 2.0 + position.y * 5.0) * 0.3 + 0.7;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * pulse * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                // Bentuk partikel bulat dengan soft edge
                float dist = distance(gl_PointCoord, vec2(0.5));
                if (dist > 0.5) discard;
                
                // Alpha fade di pinggir (glow)
                float alpha = (0.5 - dist) * 2.0;
                // Intensitas glow
                gl_FragColor = vec4(vColor, alpha * 0.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    // Masukkan ke dalam scene utama tapi bukan sebagai child langsung dari model
    // agar orbitnya independen dari rotasi model
    points.position.copy(modelScene.position);

    function update(delta, elapsed) {
        material.uniforms.time.value = elapsed;

        const pos = geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
            const data = animData[i];
            
            // Orbit manual (karena rotasi Points merotasi semua partikel searah)
            const x = pos[i * 3 + 0];
            const z = pos[i * 3 + 2];
            
            const cosA = Math.cos(data.speed * delta);
            const sinA = Math.sin(data.speed * delta);
            
            pos[i * 3 + 0] = x * cosA - z * sinA;
            pos[i * 3 + 2] = x * sinA + z * cosA;
            
            // Vertical drift
            pos[i * 3 + 1] += Math.sin(elapsed + data.phase) * data.rY * delta;
        }
        
        geometry.attributes.position.needsUpdate = true;
    }

    return { points, update };
}
