import {Canvas, createCanvas, loadImage} from 'canvas';
import {Context} from "vm";
import {log} from '../../helpers/Logcat';
import * as tar from "tar";
import * as fs from "fs";
import {User} from "../user/User";
import {Server} from "socket.io";
import {ImageHistory} from "./ImageHistory";

const DateFormatter = require('date-and-time');

export class Image {
    private readonly _width: number;
    private readonly _height: number;
    private readonly canvas: Canvas;
    private readonly context: Context;
    private readonly socket: Server;
    private readonly history: ImageHistory;

    constructor(server: Server, width: number, height: number) {
        this._width = width;
        this._height = height;
        this.socket = server;
        this.history = new ImageHistory();

        this.canvas = createCanvas(width, height);
        this.context = this.canvas.getContext("2d");

        this.context.fillStyle = "rgb(217, 217, 217)";
        this.context.fillRect(0, 0, this.width, this.height);

        setInterval(() => this.compressOldBackups(), 1000 * 60 * 60 * 12);
        setInterval(() => this.saveBackupImage(), 1000 * 60 * 30);
        setInterval(async () => this.saveLatest(), 1000 * 60 * 5);
    }


    public async setPixel(user: User,
                          x: number,
                          y: number,
                          color: Array<number>): Promise<void> {
        await user.setTimeout();
        user.username().then(username => log().info("session", `Pixel placed`, {user: username, x, y, color}));

        this.context.fillStyle = 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
        this.context.fillRect(x, y, 1, 1);
        this.socket.emit("update", x, y, color);
        await user.modifyPixel();
        await this.history.logChange(user, x, y, color);
    }

    public getPixel(x: number, y: number): Array<number> {
        return this.context.getImageData(x, y, 1, 1).data;
    }

    public getFullImage(): Promise<Array<number>> {
        return new Promise<Array<number>>(resolve =>
            resolve(this.context.getImageData(0, 0, this.width, this.height).data));
    }

    public async loadLatestCanvas(): Promise<void> {
        if (!fs.existsSync("./cache/latest.jpg"))
            return
        setTimeout(() => log().info("Loaded lastest canvas from file"), 100);
        const image = await loadImage("./cache/latest.jpg");
        this.context.drawImage(image, 0, 0, this.width, this.height);
    }

    private async saveBackupImage() {
        const date = Date.now();
        const folder = `./cache/canvas/${DateFormatter.format(new Date(date), "YYYY-MM-DD")}`;
        if (!fs.existsSync(folder)) {
            log().debug("image", "Created folder " + folder);
            fs.mkdirSync(folder);
        }

        const path = `${folder}/${date}.jpg`;
        log().debug("image", "Saving image to " + path);

        const data = this.canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(data, "base64");

        fs.writeFile(path, buf, err => {
            if (!err)
                return;
            log().critical("image", `Image ${path} couldn't get saved`, err);
        });
    }

    private async saveLatest(): Promise<void> {
        const data = this.canvas.toDataURL().replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(data, "base64");

        fs.writeFile("./cache/latest.jpg", buf, err => {
            if (!err)
                return;
            log().critical("image", `Image ./cache/latest.jpg couldn't get saved`, err);
        });
    }

    private async compressOldBackups() {
        log().debug("image", "Searching for compressible folders");
        const newestFolder = DateFormatter.format(new Date(), "YYYY-MM-DD");
        fs.readdirSync(`./cache/canvas`).forEach(folder => {
            if (folder != newestFolder)
                this.compressFolder(folder);
        });
    }

    private async compressFolder(folder) {
        log().info("image", "Compressing", folder);
        tar.create(
            {
                gzip: {
                    level: 9
                },
                cwd: "./cache/canvas",
            },
            [folder]
        ).pipe(fs.createWriteStream(`./cache/canvas/${folder}.tar.gz`).once("finish", () => {
            log().info("image", "Deleting folder", folder);
            fs.rmSync(`./cache/canvas/${folder}`, {recursive: true});
        }));
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }
}