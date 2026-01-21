class GridPhysics {
    constructor(scene) {
        this.scene = scene;
        this.tileSize = 40; // Pixel size of grid tiles
    }

    /**
     * Attempt to move an entity in a direction.
     * @param {Phaser.GameObjects.Sprite} entity - The sprite to move.
     * @param {string} direction - 'left', 'right', 'up', 'down'.
     * @param {Array} grid - The layout grid (2D array).
     * @returns {boolean} - True if moved, False if blocked.
     */
    moveEntity(entity, direction, grid) {
        if (!entity.active) return false;

        const currentPos = this.getGridPosition(entity.x, entity.y);
        const nextPos = { x: currentPos.x, y: currentPos.y };

        if (direction === 'left') nextPos.x--;
        if (direction === 'right') nextPos.x++;
        if (direction === 'up') nextPos.y--;
        if (direction === 'down') nextPos.y++;

        if (this.isBlocked(nextPos, grid)) {
            return false;
        }

        // Check for dynamic obstacles (Boxes)
        // Note: In a full ECS, we'd query the entity manager. 
        // For now, let's assume `scene.getBoxAt(x, y)` exists or verify overlaps.
        // Simplified: Check if "3" (Box) is in the grid data.
        
        // Update Grid Logical State if it was a pushable block (not implemented in basic move)
        // For Player: Just Move.
        
        entity.currGridX = nextPos.x;
        entity.currGridY = nextPos.y;
        
        // Tween movement for visual smoothness
        this.scene.tweens.add({
            targets: entity,
            x: nextPos.x * this.tileSize + this.tileSize / 2,
            y: nextPos.y * this.tileSize + this.tileSize / 2,
            duration: 150,
            ease: 'Linear'
        });

        return true;
    }

    isBlocked(pos, grid) {
        // Bounds check
        if (pos.y < 0 || pos.y >= grid.length || pos.x < 0 || pos.x >= grid[0].length) {
            return true;
        }
        
        const tileType = grid[pos.y][pos.x];
        // 1 = Wall, 3 = Box (treated as static for naive check, need push logic later)
        if (tileType === 1) return true;
        
        return false;
    }

    getGridPosition(x, y) {
        return {
            x: Math.floor(x / this.tileSize),
            y: Math.floor(y / this.tileSize)
        };
    }
    
    // Check for "Causality"
    // If an object moves in gridA (Past), we might need to update gridB (Future)
    // For now, this will be handled in GameScene update loop.
}

window.GridPhysics = GridPhysics;
