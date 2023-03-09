import {height, renderer, socket, timeout, width} from "./index.js";

export class ChunkedImage {
    constructor() {
        this.chunks = [];
        this.chunkSize = 5;
    }

    placePixel(screenX, screenY, color) {
        if (window.location.search !== "?user=admin&userId=0" && timeout > Date.now() / 1000)
            return popup("Woah, slow down there! Wait till the timeout has worn off before you place a pixel again");

        const pixX = Math.floor((screenX - renderer.offsetX) / renderer.zoom),
            pixY = Math.floor((screenY - renderer.offsetY) / renderer.zoom);
        if (pixX < 0 || pixX >= width || pixY < 0 || pixY > height)
            return popup("You can't place pixels there!");

        const chunkX = Math.floor(pixX / this.chunkSize);
        const chunkY = Math.floor(pixY / this.chunkSize);
        const chunk = this.chunks[(chunkX * this.chunkSize + chunkY)];
        if (!chunk)
            return popup("This part of the image is still loading. Please wait a few seconds before placing there");

        socket.emit("mouseDown",
            pixX,
            pixY,
            hexToRgb(color)
        );
    }

    async getPixel(pixX, pixY) {
        const chunkX = Math.floor(pixX / this.chunkSize);
        const chunkY = Math.floor(pixY / this.chunkSize);
        let chunk = this.chunks[(chunkX * this.chunkSize + chunkY)];
        if (!chunk) return;

        const i = ((pixX % this.chunkSize) * this.chunkSize + pixY % this.chunkSize) * 4;
        return `rgb(${chunk[i]}, ${chunk[i + 1]}, ${chunk[i + 2]}`;
    }

    async requestVisibleChunks() {
        const chunkWidth = Math.ceil(window.innerWidth / renderer.zoom / this.chunkSize);
        const chunkHeight = Math.ceil(window.innerHeight / renderer.zoom / this.chunkSize);
        const chunkOffsetX = Math.floor(renderer.offsetX / this.chunkSize);
        const chunkOffsetY = Math.floor(renderer.offsetY / this.chunkSize);
        const chunks = width / this.chunkSize;
        const promises = [];

        for (let i = clamp(chunkOffsetX, 0, chunks); i < clamp(chunkWidth, chunkOffsetX, chunks); i++)
            for (let j = clamp(chunkOffsetY, 0, chunks); j < clamp(chunkHeight, chunkOffsetY, chunks); j++) {
                if (this.chunks[i * this.chunkSize + j] !== undefined)
                    continue;
                promises.push(this.requestChunk(i, j));
            }

        await Promise.all(promises);
    }

    requestChunk(chunkX, chunkY) {
        return new Promise(res => {
            socket.emit("getChunk", chunkX, chunkY);
            socket.on("postChunk", (cX, cY, chunk) => {
                if (chunkX !== cX || chunkY !== cY) return;
                this.chunks[(chunkX * this.chunkSize + chunkY)] = new Uint8Array(chunk);
                res(this.chunks[(chunkX * this.chunkSize + chunkY)]);
            });
        });
    }
}