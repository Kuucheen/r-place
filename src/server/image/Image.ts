import {Canvas, createCanvas} from 'canvas';
import {Context} from "vm";
import * as fs from "fs";

export class Image {
    private readonly _width: number;
    private readonly _height: number;
    private readonly canvas: Canvas;
    private readonly context: Context;
    private readonly unsavedPixels: Map<{ x: number, y: number }, Array<number>>;

    constructor(width: number, height: number) {
        this._width = width;
        this._height = height;
        this.unsavedPixels = new Map<{ x: number; y: number }, Array<number>>();

        this.canvas = createCanvas(width, height);
        this.context = this.canvas.getContext("2d");

        this.context.fillStyle = "rgb(217, 217, 217)";
        this.context.fillRect(0, 0, this.width, this.height);

        setInterval(() => {
            for (let [{x, y}, color] of this.unsavedPixels.entries()) {
                this.context.beginPath();
                this.context.rect(x, y, 1, 1);
                this.context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]}`;
                this.context.fill();
                this.context.closePath();
            }

            const data = this.canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");

            const buf = Buffer.from(data, "base64");
            fs.writeFileSync(`res/cache/image-${Date.now()}.png`, buf);
            this.unsavedPixels.clear();
        }, 1000 * 60 * 5);
    }

    setPixel(x: number, y: number, color: Array<number>): void {
        this.unsavedPixels.set({x, y}, color);
    }

    getPixel(x: number, y: number): Array<number> {
        const pair = {x, y};
        if (this.unsavedPixels.has(pair))
            return this.unsavedPixels.get(pair);
        return this.context.getImageData(x, y, 1, 1).data;
    }

    getFullImage(): Promise<Array<number>> {
        return new Promise<Array<number>>(resolve => {
            const data = this.context.getImageData(0, 0, this.width, this.height).data;
            this.unsavedPixels.forEach((color, point) => {
                const i = (point.x * this._width + point.y) * 4;

                data[i] = color[0];
                data[i + 1] = color[1];
                data[i + 2] = color[2];
            });
            resolve(data);
        });
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }
}