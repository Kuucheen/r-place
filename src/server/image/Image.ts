import {Canvas, createCanvas} from 'canvas';
import {Context} from "vm";
import * as fs from "fs";
import {log} from '../../helpers/Logcat';

import dateFormat from "dateformat";

export class Image {
    private readonly _width: number;
    private readonly _height: number;
    private readonly canvas: Canvas;
    private readonly context: Context;

    constructor(width: number, height: number) {
        this._width = width;
        this._height = height;

        this.canvas = createCanvas(width, height);
        this.context = this.canvas.getContext("2d");

        this.context.fillStyle = "rgb(217, 217, 217)";
        this.context.fillRect(0, 0, this.width, this.height);

        setInterval(async () => this.saveBackupImage(), 1000 * 60);
    }

    setPixel(x: number, y: number, color: Array<number>): void {
        this.context.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
        this.context.fillRect(x, y, 1, 1);
    }

    getPixel(x: number, y: number): Array<number> {
        return this.context.getImageData(x, y, 1, 1).data;
    }

    getFullImage(): Promise<Array<number>> {
        return new Promise<Array<number>>(resolve =>
            resolve(this.context.getImageData(0, 0, this.width, this.height).data));
    }

    private async saveBackupImage() {
        const folder = `./cache/${dateFormat(new Date(), "yyyy-mm-dd h:MM:ss")}`;
        if (!fs.existsSync(folder))
            fs.mkdirSync(folder);

        const path = `${folder}/${Date.now()}.png`;
        log().info("image", "Saving image to " + path);

        const data = this.canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(data, "base64");

        fs.writeFile(path, buf, err => {
            if (!err)
                return;
            log().error("image", `Image ${path} couldn't get saved`, err);
        });
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }
}