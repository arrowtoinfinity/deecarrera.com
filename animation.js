// Constellation Network Animation
// Scroll-reactive 3D node network with accent colors

(function() {
    const canvas = document.getElementById('constellation');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Configuration
    const config = {
        nodeCount: window.innerWidth < 768 ? 35 : 60,
        connectionDistance: 150,
        nodeSpeed: 0.3,
        scrollMultiplier: 0.5,
        colors: [
            { r: 230, g: 80, b: 80 },    // Tiempo red
            { r: 230, g: 220, b: 0 },    // Synesthesia yellow
            { r: 70, g: 140, b: 220 }    // Arrow blue
        ]
    };

    let nodes = [];
    let scrollY = 0;
    let animationId;

    // Resize canvas to fill hero section
    function resize() {
        const hero = canvas.parentElement;
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;

        // Reinitialize nodes on resize
        if (nodes.length === 0 || Math.abs(nodes.length - config.nodeCount) > 10) {
            initNodes();
        }
    }

    // Initialize nodes with random positions and properties
    function initNodes() {
        nodes = [];
        const count = window.innerWidth < 768 ? 35 : 60;

        for (let i = 0; i < count; i++) {
            const colorIndex = Math.floor(Math.random() * config.colors.length);
            const depth = Math.random(); // 0 = far, 1 = close

            nodes.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                z: depth,
                vx: (Math.random() - 0.5) * config.nodeSpeed,
                vy: (Math.random() - 0.5) * config.nodeSpeed,
                color: config.colors[colorIndex],
                size: 2 + depth * 2, // 2-4px based on depth
                opacity: 0.4 + depth * 0.6 // Closer = more opaque
            });
        }
    }

    // Update node positions
    function updateNodes() {
        nodes.forEach(node => {
            // Drift movement
            node.x += node.vx;
            node.y += node.vy;

            // Wrap around edges
            if (node.x < -50) node.x = canvas.width + 50;
            if (node.x > canvas.width + 50) node.x = -50;
            if (node.y < -50) node.y = canvas.height + 50;
            if (node.y > canvas.height + 50) node.y = -50;
        });
    }

    // Get scroll-adjusted Y position for parallax effect
    function getParallaxY(node) {
        const parallaxOffset = scrollY * config.scrollMultiplier * node.z;
        return node.y + parallaxOffset;
    }

    // Draw connections between nearby nodes
    function drawConnections() {
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];

                const ax = nodeA.x;
                const ay = getParallaxY(nodeA);
                const bx = nodeB.x;
                const by = getParallaxY(nodeB);

                const distance = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);

                if (distance < config.connectionDistance) {
                    const opacity = (1 - distance / config.connectionDistance) * 0.3;

                    ctx.beginPath();
                    ctx.moveTo(ax, ay);
                    ctx.lineTo(bx, by);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    // Draw nodes with glow effect
    function drawNodes() {
        nodes.forEach(node => {
            const x = node.x;
            const y = getParallaxY(node);
            const { r, g, b } = node.color;

            // Outer glow
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, node.size * 4);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${node.opacity * 0.5})`);
            gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${node.opacity * 0.2})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.beginPath();
            ctx.arc(x, y, node.size * 4, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(x, y, node.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${node.opacity})`;
            ctx.fill();
        });
    }

    // Main animation loop
    function animate() {
        // Skip if tab is hidden
        if (document.hidden) {
            animationId = requestAnimationFrame(animate);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        updateNodes();
        drawConnections();
        drawNodes();

        animationId = requestAnimationFrame(animate);
    }

    // Handle scroll for parallax
    function handleScroll() {
        scrollY = window.scrollY;
    }

    // Initialize
    function init() {
        resize();
        initNodes();

        window.addEventListener('resize', resize);
        window.addEventListener('scroll', handleScroll, { passive: true });

        animate();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
