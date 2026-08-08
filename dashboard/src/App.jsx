import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import './index.css';

function App() {
  const [logs, setLogs] = useState([]);
  const [isAnomaly, setIsAnomaly] = useState(false);
  const [stats, setStats] = useState({
    activeConnections: 0,
    blockedIPs: new Set(),
    globalEntropy: 0.85,
    lastEvent: "SISTEMA INICIALIZADO (MODO Q-BALAM)"
  });

  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  // Referencias mutables para el renderizador 3D
  const sceneRef = useRef(null);
  const nodesMapRef = useRef(new Map()); // IP -> Group { mesh, line, particles }
  const coreRef = useRef(null);
  const activeLogsRef = useRef([]);

  // 1. Conexión WebSocket en tiempo real con el backend de Q-Balam
  useEffect(() => {
    const connectWS = () => {
      const ws = new WebSocket('ws://127.0.0.1:8081');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('📡 Conectado al stream de Q-Balam (127.0.0.1:8081)');
        setStats(prev => ({ ...prev, lastEvent: "CONECTADO AL MOTOR Q-BALAM" }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const timestamp = new Date().toLocaleTimeString();

          if (data.event_type === 'TRAFFIC_FLOW') {
            const ip = `${data.source_ip}:${Math.floor(data.coordinates.x)}`;
            
            // Registrar log en tabla
            const newLog = {
              id: Math.random(),
              x_ip: ip,
              y_bytes: data.coordinates.y,
              z_entropy: data.entropy_score.toFixed(2),
              t_time: timestamp,
              status: 'SECURED'
            };

            setLogs(prev => [newLog, ...prev].slice(0, 10));

            // Actualizar métricas
            setStats(prev => ({
              ...prev,
              globalEntropy: data.entropy_score / 8.0, // Convertir escala 0-8 a 0-1
              lastEvent: `Tráfico desde ${ip}`
            }));

            // Generar o refrescar nodo 3D
            trigger3DNodeTelemetry(ip, data.coordinates.y, data.entropy_score / 8.0);

          } else if (data.event_type === 'ATR_KILL_SWITCH') {
            const ip = `${data.source_ip}:${Math.floor(data.coordinates.x)}`;
            setIsAnomaly(true);
            setTimeout(() => setIsAnomaly(false), 4000);

            // Registrar log en tabla
            const newLog = {
              id: Math.random(),
              x_ip: ip,
              y_bytes: data.coordinates.y,
              z_entropy: '0.00',
              t_time: timestamp,
              status: 'BLOCKED'
            };
            setLogs(prev => [newLog, ...prev].slice(0, 10));

            setStats(prev => {
              const updatedBlocked = new Set(prev.blockedIPs);
              updatedBlocked.add(ip);
              return {
                ...prev,
                blockedIPs: updatedBlocked,
                lastEvent: `⚠️ BLOQUEADO: ${ip}`
              };
            });

            // Detonar explosión 3D
            trigger3DNodeBlock(ip);
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket desconectado. Reconectando...');
        setStats(prev => ({ ...prev, lastEvent: "CONEXIÓN PERDIDA. RECONECTANDO..." }));
        setTimeout(connectWS, 2000);
      };
    };

    connectWS();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // 2. Inicialización de la Escena 3D (Three.js)
  useEffect(() => {
    if (!canvasRef.current) return;

    // Escena, Cámara y Renderizador
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x05050f, 0.08);

    const camera = new THREE.PerspectiveCamera(60, canvasRef.current.clientWidth / canvasRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 4, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true });
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Iluminación
    const ambientLight = new THREE.AmbientLight(0x111133);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00ffff, 1.5);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xff00ff, 2, 20);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // El Núcleo Central (Base de Datos protegida)
    const coreGeometry = new THREE.IcosahedronGeometry(1.2, 2);
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0x00d2ff,
      wireframe: true,
      emissive: 0x001133,
      shininess: 100
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    scene.add(core);
    coreRef.current = core;

    // Partículas de fondo (El campo cuántico)
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 500;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 30;
    }
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMaterial = new THREE.PointsMaterial({ color: 0x555599, size: 0.08 });
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);

    // Bucle de Animación
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Rotación del núcleo central
      if (coreRef.current) {
        coreRef.current.rotation.y = elapsedTime * 0.2;
        coreRef.current.rotation.x = elapsedTime * 0.15;
        // Efecto respiración
        const scale = 1 + Math.sin(elapsedTime * 2) * 0.05;
        coreRef.current.scale.set(scale, scale, scale);
      }

      // Rotación del campo cuántico de fondo
      starField.rotation.y = elapsedTime * 0.02;

      // Animar nodos de red y sus partículas
      const nodesMap = nodesMapRef.current;
      setStats(prev => ({ ...prev, activeConnections: nodesMap.size }));

      nodesMap.forEach((nodeGroup, ip) => {
        // Rotar orbitales
        const angle = elapsedTime * nodeGroup.orbitSpeed + nodeGroup.initialAngle;
        nodeGroup.mesh.position.x = Math.cos(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.z = Math.sin(angle) * nodeGroup.orbitRadius;
        nodeGroup.mesh.position.y = Math.sin(angle * 2) * 0.5;

        // Actualizar línea de conexión al núcleo
        const positions = new Float32Array([
          0, 0, 0, // Origen (Núcleo)
          nodeGroup.mesh.position.x, nodeGroup.mesh.position.y, nodeGroup.mesh.position.z // Destino (IP cliente)
        ]);
        nodeGroup.line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Animar flujo de partículas (datos) de la IP al núcleo
        const particlePositions = nodeGroup.particles.geometry.attributes.position.array;
        for (let i = 0; i < nodeGroup.particlesCount; i++) {
          nodeGroup.particlesProgress[i] -= 0.02 * (1 + nodeGroup.entropy); // Flujo basado en entropía
          if (nodeGroup.particlesProgress[i] <= 0) {
            nodeGroup.particlesProgress[i] = 1.0; // Reset
          }

          // Interpolación lineal entre IP y Núcleo
          const progress = nodeGroup.particlesProgress[i];
          particlePositions[i * 3 + 0] = nodeGroup.mesh.position.x * progress;
          particlePositions[i * 3 + 1] = nodeGroup.mesh.position.y * progress;
          particlePositions[i * 3 + 2] = nodeGroup.mesh.position.z * progress;
        }
        nodeGroup.particles.geometry.attributes.position.needsUpdate = true;

        // Auto-eliminar nodos inactivos (si no ha recibido datos en 5 segundos y no está bloqueado)
        if (Date.now() - nodeGroup.lastActive > 5000 && !nodeGroup.blocked) {
          scene.remove(nodeGroup.mesh);
          scene.remove(nodeGroup.line);
          scene.remove(nodeGroup.particles);
          nodesMap.delete(ip);
        }
      });

      // Animar ondas de choque del Kill-Switch
      scene.children.forEach(child => {
        if (child.name === "shockwave") {
          child.scale.addScalar(0.2);
          child.material.opacity -= 0.015;
          if (child.material.opacity <= 0) {
            scene.remove(child);
          }
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!canvasRef.current) return;
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 3. Crear/Actualizar Nodos en vivo desde el WebSocket
  const trigger3DNodeTelemetry = (ip, magnitude, entropy) => {
    const scene = sceneRef.current;
    if (!scene) return;

    let nodeGroup = nodesMapRef.current.get(ip);

    if (!nodeGroup) {
      // Crear un nuevo nodo orbital
      const orbitRadius = 3.5 + Math.random() * 2.0;
      const initialAngle = Math.random() * Math.PI * 2;
      const orbitSpeed = 0.3 + Math.random() * 0.4;

      // Geometría del satélite
      const geom = new THREE.OctahedronGeometry(0.18);
      const mat = new THREE.MeshPhongMaterial({
        color: 0x00ffcc,
        emissive: 0x004422,
        shininess: 30
      });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      // Línea de conexión al núcleo
      const lineGeom = new THREE.BufferGeometry();
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00ffff,
        transparent: true,
        opacity: 0.3
      });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      // Flujo de datos (Partículas)
      const particlesCount = 8;
      const particleGeom = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particlesCount * 3);
      const particlesProgress = [];

      for (let i = 0; i < particlesCount; i++) {
        particlesProgress.push(i / particlesCount); // Distribuidas uniformemente a lo largo de la línea
      }

      particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0x00ffaa,
        size: 0.12,
        transparent: true,
        opacity: 0.8
      });
      const particles = new THREE.Points(particleGeom, particleMat);
      scene.add(particles);

      nodeGroup = {
        mesh,
        line,
        particles,
        particlesCount,
        particlesProgress,
        orbitRadius,
        orbitSpeed,
        initialAngle,
        entropy,
        blocked: false,
        lastActive: Date.now()
      };

      nodesMapRef.current.set(ip, nodeGroup);
    }

    // Actualizar actividad y entropía
    nodeGroup.lastActive = Date.now();
    nodeGroup.entropy = entropy;

    // Cambiar color/brillo temporalmente según el tamaño del paquete
    const flashIntensity = Math.min(magnitude / 2000, 1.0);
    nodeGroup.mesh.material.color.setRGB(0.0, 1.0, 1.0 - flashIntensity);
    nodeGroup.mesh.scale.setScalar(1 + flashIntensity * 0.5);

    setTimeout(() => {
      if (nodeGroup && !nodeGroup.blocked) {
        nodeGroup.mesh.material.color.setHex(0x00ffcc);
        nodeGroup.mesh.scale.setScalar(1.0);
      }
    }, 150);
  };

  // 4. Detonar Bloqueo visual del Kill-Switch
  const trigger3DNodeBlock = (ip) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const nodeGroup = nodesMapRef.current.get(ip);
    if (!nodeGroup) return;

    nodeGroup.blocked = true;
    nodeGroup.lastActive = Date.now() + 100000; // Mantenerlo en escena para ver la desconexión

    // Cambiar a Rojo e inflarlo
    nodeGroup.mesh.material.color.setHex(0xff0033);
    nodeGroup.mesh.material.emissive.setHex(0x440000);
    nodeGroup.mesh.scale.setScalar(2.2);

    // Cambiar la línea a roja
    nodeGroup.line.material.color.setHex(0xff0033);
    nodeGroup.line.material.opacity = 0.8;

    // Partículas de datos a rojo
    nodeGroup.particles.material.color.setHex(0xff0033);

    // Detonar onda de choque esférica desde el centro hacia afuera
    const waveGeom = new THREE.RingGeometry(0.9, 1.0, 32);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xff0033,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const shockwave = new THREE.Mesh(waveGeom, waveMat);
    shockwave.rotation.x = Math.PI / 2;
    shockwave.name = "shockwave";
    scene.add(shockwave);

    // Desconectar / Desintegrar nodo en 3 segundos
    setTimeout(() => {
      const activeNode = nodesMapRef.current.get(ip);
      if (activeNode) {
        scene.remove(activeNode.mesh);
        scene.remove(activeNode.line);
        scene.remove(activeNode.particles);
        nodesMapRef.current.delete(ip);
      }
    }, 3500);
  };

  return (
    <div className={`dashboard-container ${isAnomaly ? 'screen-flash-alert' : ''}`}>
      {/* 3D Canvas de Fondo */}
      <canvas ref={canvasRef} className="three-canvas" />

      {/* Capa de Información y Control (Glassmorphism) */}
      <header className="header">
        <div className="brand">
          <h1>TZANiX Q-Balam</h1>
          <p className="subtitle">Visualizador Holográfico de Red 3D</p>
        </div>
        <div className={`status-badge ${isAnomaly ? 'alert' : ''}`}>
          <span className="dot">●</span>
          {isAnomaly ? 'ANOMALÍA DETECTADA (KILL-SWITCH ACTIVADO)' : 'SISTEMA PROTEGIDO (Q-SECURE)'}
        </div>
      </header>

      <main className="grid">
        {/* Tarjeta de Estadísticas en Vivo */}
        <div className="card glass">
          <h2>Monitoreo de Telemetría</h2>
          <div className="stat-row">
            <span className="stat-label">Conexiones Activas:</span>
            <span className="stat-val color-cyan">{stats.activeConnections}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Nivel de Ruido (Z):</span>
            <span className="stat-val color-green">{(stats.globalEntropy * 100).toFixed(0)}%</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">IPs Bloqueadas:</span>
            <span className="stat-val color-red">{stats.blockedIPs.size}</span>
          </div>
          <div className="event-log">
            <span className="event-tag">LOG EVENT:</span>
            <p className="event-text">{stats.lastEvent}</p>
          </div>
        </div>

        {/* Tarjeta del Algoritmo ATR */}
        <div className="card glass">
          <h2>Volatilidad Dinámica (ATR)</h2>
          <p className="description">
            El proxy calcula la volatilidad de los paquetes entrantes ($Y$) basándose en una media móvil inercial. Si una IP supera las bandas de seguridad, es desconectada.
          </p>
          <div className="limit-gauge">
            <span className="gauge-label">Límite ATR de Exfiltración:</span>
            <span className="gauge-val">{isAnomaly ? 'SUPERADO' : 'NORMAL'}</span>
          </div>
        </div>

        {/* Tabla de Mapeo Tesseract */}
        <div className="card glass col-span-2">
          <h2>Flujos de Datos del Tesseract ($X, Y, Z, T$)</h2>
          <div className="table-container">
            <table className="log-table">
              <thead>
                <tr>
                  <th>IP Cliente (X)</th>
                  <th>Carga Útil (Y)</th>
                  <th>Entropía (Z)</th>
                  <th>Timestamp (T)</th>
                  <th>Capa Defensiva</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">Esperando tráfico desde el proxy Q-Balam...</td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.id} className={log.status === 'BLOCKED' ? 'row-blocked' : ''}>
                      <td>{log.x_ip}</td>
                      <td>{log.y_bytes.toLocaleString()} Bytes</td>
                      <td>{log.z_entropy}</td>
                      <td>{log.t_time}</td>
                      <td className={log.status === 'BLOCKED' ? 'text-red' : 'text-green'}>
                        {log.status === 'BLOCKED' ? '🛑 BLOCKED' : '🛡️ SHIELDED'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
