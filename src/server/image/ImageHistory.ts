import {User} from "../user/User";
import * as fs from "fs";

const historyFolder = "./logs";

export class ImageHistory {
    public async logChange(user: User, x: number, y: number, color: Array<number>): Promise<void> {
        const date = new Date();
        await this.writeToFile(date, `{"x": ${x}, "y": ${y}, "color": [${color}], "user": ${user.userID}, "timestamp": ${date.getTime()}}\n`);
    }

    private writeToFile(date: Date, data: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const name = `pix${date.getUTCFullYear()}-${this.zeroPad(date.getUTCMonth() + 1, 2)}-${this.zeroPad(date.getUTCDate(), 2)}.hist`;
            const file = `${historyFolder}/${name}`;

            fs.writeFile(file, data, {flag: "a"}, err => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
    }

    private zeroPad(num, places): string {
        return String(num).padStart(places, '0');
    }
}