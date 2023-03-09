import {height, image, width} from "./index.js";

export const minZoom = 20;
export const maxZoom = 200;

export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.canvas.width = this.canvas.getBoundingClientRect().width;
        this.canvas.height = this.canvas.getBoundingClientRect().height;
        this.offsetX = 0;
        this.offsetY = 0;
        this.zoom = minZoom;
    }

    async renderAll() {
        await image.requestVisibleChunks();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const negativeOffsetX = -this.offsetX;
        const negativeOffsetY = -this.offsetY;
        const maxViewWidth = window.innerWidth / this.zoom;
        const maxViewHeight = window.innerHeight / this.zoom;

        const promises = [];
        for (let i = clamp(Math.ceil(negativeOffsetX / this.zoom) - 1, 0, width);
             i < clamp(Math.ceil(negativeOffsetX / this.zoom + maxViewWidth), 0, width); i++)
            for (let j = clamp(Math.ceil(negativeOffsetY / this.zoom) - 1, 0, height);
                 j < clamp(Math.ceil(negativeOffsetY / this.zoom + maxViewHeight), 0, height); j++)
                promises.push(image.getPixel(i, j).then(c => this.renderPixel(i, j, c)));

        await Promise.all(promises);
        if (this.zoom < minZoom)
            return;

        await this.renderGrid();
    }

    async renderGrid() {
        let cWidth = this.canvas.width;
        let cHeight = this.canvas.height;
        this.ctx.strokeStyle = `rgba(100, 100, 100, ${remap(this.zoom, minZoom, maxZoom, .3, 1)})`;

        await Promise.all([
            new Promise(res => {
                for (let i = 0; i < cWidth; i += this.zoom)
                    this.ctx.strokeRect(clamp(i + this.offsetX % this.zoom, this.offsetX, this.offsetX + width * this.zoom), this.offsetY, 0, height * this.zoom);
                res();
            }),
            new Promise(res => {
                for (let i = 0; i < cHeight; i += this.zoom)
                    this.ctx.strokeRect(this.offsetX, clamp(i + this.offsetY % this.zoom, this.offsetY, this.offsetY + height * this.zoom), width * this.zoom, 0);
                res();
            })
        ]);
    }

    renderPixel(pixX, pixY, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(pixX * this.zoom + this.offsetX, pixY * this.zoom + this.offsetY, this.zoom, this.zoom);
    }
}