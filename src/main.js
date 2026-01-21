const config = {
    type: Phaser.AUTO, // WebGL if available, else Canvas
    width: window.innerWidth, // Fullscreen canvas initially
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#1a1a1a',
    scene: [window.GameScene], // Load our GameScene
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade', // Not strictly used since we do GridPhysics manually, but good to have
        arcade: {
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

// Handle window resize dynamically if needed
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});
