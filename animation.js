// Constellation Network Animation
// Static at rest, 3D movement on scroll, monochrome
// Full page background with large foreground nodes

(function() {
    const canvas = document.getElementById('constellation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 50 : 90,
        connectionDistance: 150,
        scrollDepthMultiplier: 1.2
    };

    let nodes = [];
    let scrollY = 0;
    let lastScrollY = 0;
    let needsRender = true;
    let pageHeight = 0;

    // Resize canvas to full page
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        pageHeight = document.documentElement.scrollHeight;
        initNodes();
        needsRender = true;
    }

    // Initialize nodes spread across entire page height
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 50 : 90;

        for (let i = 0; i < count; i++) {
            const depth = Math.random(); // 0 = far (subtle), 1 = near (bold)

            nodes.push({
                baseX: Math.random() * canvas.width,
                // Spread nodes across entire scrollable page
                baseY: Math.random() * pageHeight,
                z: depth,
                // Size: far = 1px, near = 25px (really large for close ones)
                size: 1 + depth * depth * 24,
                // Opacity: far = 0.08, near = 0.5
                opacity: 0.08 + depth * 0.42
            });
        }

        // Sort by depth so far nodes render first, close nodes render last (on top)
        nodes.sort((a, b) => a.z - b.z);
    }

    // Get scroll-adjusted position for 3D parallax
    function getNodePosition(node) {
        // Near nodes (z=1) move MORE with scroll, far nodes (z=0) move LESS
        // This creates the parallax effect where close things move faster
        const parallaxStrength = 1 - (node.z * config.scrollDepthMultiplier);
        const yOffset = scrollY * parallaxStrength;

        return {
            x: node.baseX,
            y: node.baseY - yOffset
        };
    }

    // Draw connections between nearby nodes
    function drawConnections() {
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
                    // Line opacity based on distance and average depth
                    const avgDepth = (nodeA.z + nodeB.z) / 2;
                    const distanceFade = 1 - distance / config.connectionDistance;
                    const opacity = distanceFade * avgDepth * 0.3;

                    ctx.beginPath();
                    ctx.moveTo(posA.x, posA.y);
                    ctx.lineTo(posB.x, posB.y);
                    ctx.strokeStyle = `rgba(100, 100, 100, ${opacity})`;
                    ctx.lineWidth = 0.5 + avgDepth * 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    // Draw nodes
    function drawNodes() {
        nodes.forEach(node => {
            const pos = getNodePosition(node);

            // Skip if off screen (with margin for large nodes)
            const margin = node.size * 4;
            if (pos.y < -margin || pos.y > canvas.height + margin) return;
            if (pos.x < -margin || pos.x > canvas.width + margin) return;

            // Glow for all nodes, larger glow for near nodes
            const glowSize = node.size * 2.5;
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, 0,
                pos.x, pos.y, glowSize
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${node.opacity * 0.4})`);
            gradient.addColorStop(0.5, `rgba(255, 255, 255, ${node.opacity * 0.1})`);
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

    // Animation loop - only renders when needed
    function animate() {
        if (scrollY !== lastScrollY) {
            needsRender = true;
            lastScrollY = scrollY;
        }

        if (needsRender) {
            render();
            needsRender = false;
        }

        requestAnimationFrame(animate);
    }

    // Handle scroll
    function handleScroll() {
        scrollY = window.scrollY;
    }

    // Initialize
    function init() {
        resize();

        window.addEventListener('resize', resize);
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Initial render
        render();
        animate();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
