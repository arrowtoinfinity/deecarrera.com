// Constellation Network Animation
// Slow drifting nodes with dynamic connections
// Blue flash on new connections

(function() {
    const canvasBg = document.getElementById('constellation-bg');
    const canvasFg = document.getElementById('constellation-fg');
    if (!canvasBg || !canvasFg) return;

    const ctxBg = canvasBg.getContext('2d');
    const ctxFg = canvasFg.getContext('2d');

    // Size threshold for splitting foreground/background (only largest nodes in front)
    const SIZE_THRESHOLD = 25; // Nodes larger than this appear in front of 3D model

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 50 : 90,
        connectionDistance: 150,
        scrollDepthMultiplier: 1.2,
        driftSpeed: 0.25
    };

    let nodes = [];
    let scrollY = 0;
    let targetScrollY = 0;
    let pageHeight = 0;
    let activeConnections = new Set();
    let flashingConnections = new Map(); // connectionKey -> {intensity, color}
    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;
    let audioCircleMode = false; // When true, nodes are in circle formation

    // Flash color (blue only)
    const flashColor = { r: 135, g: 206, b: 250 };

    // Resize canvas only (no node regeneration)
    function resizeCanvas() {
        const oldWidth = canvasBg.width || window.innerWidth;
        const oldPageHeight = pageHeight || document.documentElement.scrollHeight;

        canvasBg.width = window.innerWidth;
        canvasBg.height = window.innerHeight;
        canvasFg.width = window.innerWidth;
        canvasFg.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;

        // Scale existing node positions to new dimensions
        if (nodes.length > 0 && oldWidth > 0 && oldPageHeight > 0) {
            const scaleX = canvasBg.width / oldWidth;
            const scaleY = pageHeight / oldPageHeight;

            nodes.forEach(node => {
                node.baseX *= scaleX;
                node.baseY *= scaleY;
            });
        }
    }

    // Debounced resize handler
    function handleResize() {
        // Immediate canvas resize for smooth visuals
        resizeCanvas();

        // Debounce full reinitialization only if screen size category changes
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isMobile = window.innerWidth < 768;
            const wasMobile = lastWidth < 768;

            // Only reinitialize nodes if crossing mobile/desktop threshold
            if (isMobile !== wasMobile && lastWidth > 0) {
                initNodes();
            }

            lastWidth = window.innerWidth;
            lastHeight = window.innerHeight;
        }, 250);
    }

    // Initialize nodes spread across entire page height
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 50 : 90;

        for (let i = 0; i < count; i++) {
            const depth = Math.random(); // 0 = far (subtle), 1 = near (bold)

            // Larger nodes (higher depth) move faster for parallax effect
            const speedMultiplier = 0.5 + depth * 1.5; // 0.5x to 2x speed based on depth

            nodes.push({
                baseX: Math.random() * canvasBg.width,
                baseY: Math.random() * pageHeight,
                // Drift velocity - faster for larger/closer nodes
                vx: (Math.random() - 0.5) * config.driftSpeed * speedMultiplier,
                vy: (Math.random() - 0.5) * config.driftSpeed * speedMultiplier,
                z: depth,
                size: 2 + depth * depth * (20 + Math.random() * 35),
                opacity: 0.08 + depth * 0.42
            });
        }

        // Sort by depth so far nodes render first
        nodes.sort((a, b) => a.z - b.z);
    }

    // Update node positions (drift)
    function updateNodes() {
        const audio = window.audioData;
        const audioActive = audio && audio.active;
        const musicCard = document.querySelector('.music-card');

        audioCircleMode = audioActive && musicCard;

        nodes.forEach((node, index) => {
            if (audioCircleMode) {
                // Get music card position (center) - in viewport coordinates
                const rect = musicCard.getBoundingClientRect();
                const cardCenterX = rect.left + rect.width / 2;
                const cardCenterY = rect.top + rect.height / 2;

                // Calculate target position in a circle around the card (viewport coords)
                const numNodes = nodes.length;
                const angle = (index / numNodes) * Math.PI * 2 - Math.PI / 2; // Start from top
                const baseRadius = 120 + node.z * 50; // Vary radius by depth
                const bassNormalized = audio.bass / 255;
                const pulseRadius = baseRadius + bassNormalized * 60; // Pulse with bass

                const targetX = cardCenterX + Math.cos(angle) * pulseRadius;
                const targetY = cardCenterY + Math.sin(angle) * pulseRadius;

                // Store viewport position directly (we'll skip parallax in render)
                node.circleX = targetX;
                node.circleY = targetY;

                // Smoothly interpolate
                if (node.renderX === undefined) {
                    node.renderX = node.baseX;
                    node.renderY = node.baseY - scrollY;
                }
                node.renderX += (targetX - node.renderX) * 0.08;
                node.renderY += (targetY - node.renderY) * 0.08;
            } else {
                // Clear circle mode render positions
                node.renderX = undefined;
                node.renderY = undefined;

                // Normal drifting behavior
                node.baseX += node.vx;
                node.baseY += node.vy;

                // Wrap around edges
                if (node.baseX < -50) node.baseX = canvasBg.width + 50;
                if (node.baseX > canvasBg.width + 50) node.baseX = -50;
                if (node.baseY < -50) node.baseY = pageHeight + 50;
                if (node.baseY > pageHeight + 50) node.baseY = -50;
            }
        });
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
        // In circle mode, use pre-calculated viewport positions
        if (audioCircleMode && node.renderX !== undefined) {
            return {
                x: node.renderX,
                y: node.renderY
            };
        }

        // Normal parallax mode
        const parallaxStrength = 1 - (node.z * config.scrollDepthMultiplier);
        const yOffset = scrollY * parallaxStrength;

        return {
            x: node.baseX,
            y: node.baseY - yOffset
        };
    }

    // Generate connection key
    function getConnectionKey(i, j) {
        return i < j ? `${i}-${j}` : `${j}-${i}`;
    }

    // Draw connections between nearby nodes
    function drawConnections() {
        const newConnections = new Set();

        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                const posA = getNodePosition(nodeA);
                const posB = getNodePosition(nodeB);

                const distance = Math.sqrt(
                    (posB.x - posA.x) ** 2 + (posB.y - posA.y) ** 2
                );

                if (distance < config.connectionDistance) {
                    const connectionKey = getConnectionKey(i, j);
                    newConnections.add(connectionKey);

                    // Check if this is a new connection
                    if (!activeConnections.has(connectionKey)) {
                        // Start flash with blue color
                        flashingConnections.set(connectionKey, { intensity: 0.4, color: flashColor });
                    }

                    // Line opacity based on distance and average depth
                    const avgDepth = (nodeA.z + nodeB.z) / 2;
                    const distanceFade = 1 - distance / config.connectionDistance;
                    const opacity = distanceFade * avgDepth * 0.3;

                    // Check for flash
                    const flash = flashingConnections.get(connectionKey);
                    const flashIntensity = flash ? flash.intensity : 0;
                    const currentFlashColor = flash ? flash.color : null;

                    // Choose canvas based on node sizes (larger nodes in front of 3D model)
                    const bothBackground = nodeA.size < SIZE_THRESHOLD && nodeB.size < SIZE_THRESHOLD;
                    const bothForeground = nodeA.size >= SIZE_THRESHOLD && nodeB.size >= SIZE_THRESHOLD;
                    const eitherForeground = nodeA.size >= SIZE_THRESHOLD || nodeB.size >= SIZE_THRESHOLD;
                    const ctx = bothForeground ? ctxFg : ctxBg;

                    // Draw line - darker gradient for large foreground nodes
                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);

                    if (eitherForeground) {
                        // Create gradient line from large node for depth effect
                        const gradient = ctx.createLinearGradient(posA.x, posA.y, posB.x, posB.y);
                        const largeNodeOpacity = Math.min(0.7, opacity * 3);
                        if (nodeA.size >= SIZE_THRESHOLD) {
                            gradient.addColorStop(0, `rgba(20, 20, 20, ${largeNodeOpacity})`);
                            gradient.addColorStop(1, `rgba(50, 50, 50, ${opacity * 0.5})`);
                        } else {
                            gradient.addColorStop(0, `rgba(50, 50, 50, ${opacity * 0.5})`);
                            gradient.addColorStop(1, `rgba(20, 20, 20, ${largeNodeOpacity})`);
                        }
                        ctx.strokeStyle = gradient;
                        ctx.lineWidth = 1 + avgDepth * 1.5;
                    } else {
                        ctx.strokeStyle = `rgba(50, 50, 50, ${opacity})`;
                        ctx.lineWidth = 0.5 + avgDepth * 0.5;
                    }
                    ctx.stroke();

                    // Draw colored glow circles at both nodes if flashing
                    if (flashIntensity > 0.01 && currentFlashColor) {
                        const { r, g, b } = currentFlashColor;

                        // Glow at node A - scale to node size
                        const glowRadiusA = nodeA.size * 2;
                        const flashGlowA = ctx.createRadialGradient(
                            posA.x, posA.y, 0,
                            posA.x, posA.y, glowRadiusA
                        );
                        flashGlowA.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.5})`);
                        flashGlowA.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.2})`);
                        flashGlowA.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.beginPath();
                        ctx.arc(posA.x, posA.y, glowRadiusA, 0, Math.PI * 2);
                        ctx.fillStyle = flashGlowA;
                        ctx.fill();

                        // Glow at node B - scale to node size
                        const glowRadiusB = nodeB.size * 2;
                        const flashGlowB = ctx.createRadialGradient(
                            posB.x, posB.y, 0,
                            posB.x, posB.y, glowRadiusB
                        );
                        flashGlowB.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.5})`);
                        flashGlowB.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${flashIntensity * 0.2})`);
                        flashGlowB.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

                        ctx.beginPath();
                        ctx.arc(posB.x, posB.y, glowRadiusB, 0, Math.PI * 2);
                        ctx.fillStyle = flashGlowB;
                        ctx.fill();
                    }
                }
            }
        }

        // Update active connections
        activeConnections = newConnections;

        // Decay flash intensity
        flashingConnections.forEach((flash, key) => {
            const newIntensity = flash.intensity * 0.96; // 2x longer duration
            if (newIntensity < 0.01) {
                flashingConnections.delete(key);
            } else {
                flashingConnections.set(key, { ...flash, intensity: newIntensity });
            }
        });
    }

    // Draw nodes
    function drawNodes() {
        // Get audio reactivity data if available
        const audio = window.audioData;
        const audioActive = audio && audio.active;
        const bassPulse = audioActive ? (audio.bass / 255) : 0;
        const trebleGlow = audioActive ? (audio.treble / 255) : 0;

        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Choose canvas based on size (larger nodes in front of 3D model)
            const ctx = node.size >= SIZE_THRESHOLD ? ctxFg : ctxBg;
            const canvas = node.size >= SIZE_THRESHOLD ? canvasFg : canvasBg;

            // Skip if off screen
            const margin = node.size * 4;
            if (pos.y < -margin || pos.y > canvas.height + margin) return;
            if (pos.x < -margin || pos.x > canvas.width + margin) return;

            // Audio-reactive size when music is playing
            const sizeMultiplier = audioActive ? (1 + bassPulse * 0.8) : 1;
            const reactiveSize = node.size * sizeMultiplier;

            // Audio-reactive glow
            const glowSize = reactiveSize * (3 + (audioActive ? trebleGlow * 2 : 0));
            const glowOpacity = audioActive ? (0.6 + trebleGlow * 0.4) : 0.6;

            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${glowOpacity})`);
            gradient.addColorStop(0.4, `rgba(255, 255, 255, ${glowOpacity * 0.33})`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, reactiveSize, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    // Render frame
    function render() {
        ctxBg.clearRect(0, 0, canvasBg.width, canvasBg.height);
        ctxFg.clearRect(0, 0, canvasFg.width, canvasFg.height);
        drawConnections();
        drawNodes();
    }

    // Animation loop - continuous
    function animate() {
        updateScroll();
        updateNodes();
        render();
        requestAnimationFrame(animate);
    }

    // Handle scroll
    function handleScroll() {
        // Clamp to 0 to handle iOS bounce/elastic scrolling
        targetScrollY = Math.max(0, window.scrollY);
    }

    // Smooth scroll interpolation
    function updateScroll() {
        // Lerp toward target for smooth mobile experience
        scrollY += (targetScrollY - scrollY) * 0.15;
    }

    // Initialize
    function init() {
        // Get initial scroll position
        targetScrollY = Math.max(0, window.scrollY);
        scrollY = targetScrollY;

        // Set initial dimensions
        canvasBg.width = window.innerWidth;
        canvasBg.height = window.innerHeight;
        canvasFg.width = window.innerWidth;
        canvasFg.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;
        lastWidth = window.innerWidth;
        lastHeight = window.innerHeight;

        // Initialize nodes once
        initNodes();

        // Recalculate page height after layout settles (fixes mobile)
        setTimeout(() => {
            pageHeight = document.documentElement.scrollHeight;
        }, 100);

        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleScroll, { passive: true });

        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
