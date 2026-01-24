// Constellation Network Animation
// Slow drifting nodes with dynamic connections
// Blue flash on new connections

(function() {
    const canvas = document.getElementById('constellation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

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

    // Flash color (blue only)
    const flashColor = { r: 135, g: 206, b: 250 };

    // Resize canvas only (no node regeneration)
    function resizeCanvas() {
        const oldWidth = canvas.width || window.innerWidth;
        const oldPageHeight = pageHeight || document.documentElement.scrollHeight;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;

        // Scale existing node positions to new dimensions
        if (nodes.length > 0 && oldWidth > 0 && oldPageHeight > 0) {
            const scaleX = canvas.width / oldWidth;
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

            nodes.push({
                baseX: Math.random() * canvas.width,
                baseY: Math.random() * pageHeight,
                // Drift velocity
                vx: (Math.random() - 0.5) * config.driftSpeed,
                vy: (Math.random() - 0.5) * config.driftSpeed,
                z: depth,
                size: 1 + depth * depth * (15 + Math.random() * 30),
                opacity: 0.08 + depth * 0.42
            });
        }

        // Sort by depth so far nodes render first
        nodes.sort((a, b) => a.z - b.z);
    }

    // Update node positions (drift)
    function updateNodes() {
        nodes.forEach(node => {
            node.baseX += node.vx;
            node.baseY += node.vy;

            // Wrap around edges
            if (node.baseX < -50) node.baseX = canvas.width + 50;
            if (node.baseX > canvas.width + 50) node.baseX = -50;
            if (node.baseY < -50) node.baseY = pageHeight + 50;
            if (node.baseY > pageHeight + 50) node.baseY = -50;
        });
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
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

                    // Draw line
                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);
                    ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`;
                    ctx.lineWidth = 0.5 + avgDepth * 0.5;
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
        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Skip if off screen
            const margin = node.size * 4;
            if (pos.y < -margin || pos.y > canvas.height + margin) return;
            if (pos.x < -margin || pos.x > canvas.width + margin) return;

            // White glow/shadow - always visible
            const glowSize = node.size * 3;
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, 0.6)`);
            gradient.addColorStop(0.4, `rgba(255, 255, 255, 0.2)`);
            gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, node.size, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    // Render frame
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
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
