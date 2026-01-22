export default class GridPhysics {
    constructor(scene) {
        this.scene = scene;
        this.tileSize = 40; // Pixel size of grid tiles
    }

    /**
     * Attempt to move an entity in a direction.
     * @param {Phaser.GameObjects.Sprite} entity - The sprite to move.
     * @param {string} direction - 'left', 'right', 'up', 'down'.
     * @param {Array} grid - The layout grid (2D array) for the current timeline.
     * @param {Array} otherGrid - The layout grid for the other timeline (for paradox prevention).
     * @returns {Object} - { moved: boolean, pushedBox: boolean, boxPos: {x, y}, newBoxPos: {x, y} }
     */
    moveEntity(entity, direction, grid, otherGrid = null, isSimulation = false) {
        if (!entity.active && !isSimulation) return { moved: false };

        let currentPos;
        if (isSimulation) {
            currentPos = { x: entity.currGridX, y: entity.currGridY };
        } else {
            currentPos = this.getGridPosition(entity.x, entity.y);
        }

        const nextPos = { x: currentPos.x, y: currentPos.y };

        if (direction === 'left') nextPos.x--;
        if (direction === 'right') nextPos.x++;
        if (direction === 'up') nextPos.y--;
        if (direction === 'down') nextPos.y++;

        // Bounds check
        if (nextPos.y < 0 || nextPos.y >= grid.length || nextPos.x < 0 || nextPos.x >= grid[0].length) {
            return { moved: false };
        }

        const tileType = grid[nextPos.y][nextPos.x];
        // console.log(`Attempt Move: ${direction} | Cur: ${currentPos.x},${currentPos.y} | Next: ${nextPos.x},${nextPos.y} | Tile: ${tileType}`);

        // Wall check
        if (tileType === 1) return { moved: false };

        // Box check
        let pushedBox = false;
        let boxPos = null;
        let newBoxPos = null;

        if (tileType === 3) {
            // Only Past can push (we assume entity is Past if otherGrid is provided)
            // Or we check entity texture? Better to just check if otherGrid is provided.
            if (!otherGrid) return { moved: false }; // Future cannot move boxes

            const boxNextPos = { x: nextPos.x, y: nextPos.y };
            if (direction === 'left') boxNextPos.x--;
            if (direction === 'right') boxNextPos.x++;
            if (direction === 'up') boxNextPos.y--;
            if (direction === 'down') boxNextPos.y++;

            // Bounds check for box
            if (boxNextPos.y < 0 || boxNextPos.y >= grid.length || boxNextPos.x < 0 || boxNextPos.x >= grid[0].length) {
                return { moved: false };
            }

            // Check if blocked in Past or Future
            const pastBlocked = grid[boxNextPos.y][boxNextPos.x] !== 0;
            const futureBlocked = otherGrid[boxNextPos.y][boxNextPos.x] !== 0;

            // Check collision with OTHER player (Paradox Prevention)
            // If pushing in Past, check if Future player is on the target tile
            let paradoxBlocked = false;
            if (this.scene.playerFuture) {
                const fx = this.scene.playerFuture.currGridX;
                const fy = this.scene.playerFuture.currGridY;
                if (fx === boxNextPos.x && fy === boxNextPos.y) paradoxBlocked = true;
            }

            if (pastBlocked || futureBlocked || paradoxBlocked) {
                return { moved: false }; // Paradox or blocked
            }

            pushedBox = true;
            boxPos = { x: nextPos.x, y: nextPos.y };
            newBoxPos = { x: boxNextPos.x, y: boxNextPos.y };
        }

        entity.currGridX = nextPos.x;
        entity.currGridY = nextPos.y;

        if (!isSimulation) {
            // Tween movement for visual smoothness
            this.scene.tweens.add({
                targets: entity,
                x: nextPos.x * this.tileSize + this.tileSize / 2,
                y: nextPos.y * this.tileSize + this.tileSize / 2,
                duration: 150,
                ease: 'Linear'
            });
        }

        return { moved: true, pushedBox, boxPos, newBoxPos };
    }

    isBlocked(pos, grid) {
        // Bounds check
        if (pos.y < 0 || pos.y >= grid.length || pos.x < 0 || pos.x >= grid[0].length) {
            return true;
        }

        const tileType = grid[pos.y][pos.x];
        // 1 = Wall, 3 = Box (treated as static if we hit it without pushing)
        if (tileType === 1 || tileType === 3) return true;

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


