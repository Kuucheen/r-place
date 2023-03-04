import {query} from "../SQL";
import {v4 as uuidv4} from 'uuid';
import {log} from "../../helpers/Logcat";

export class User {
    private readonly _userID: number;
    private readonly _createdAt: number;
    private readonly _currentIp: string;
    private readonly _currentHash: string;


    private constructor(userID: number, currentIp: string, currentHash: string, createdAt: number) {
        this._userID = userID;
        this._createdAt = createdAt;
        this._currentHash = currentHash;
        this._currentIp = currentIp;
        this.updateLastSeen().then(_ => log().debug("users", "Updated users last seen"));
    }

    public static async createUser(ip: string, fingerprint: string): Promise<number | undefined> {
        const userName = uuidv4();

        await query(`INSERT INTO \`r/place\`.users (username, date_registered, last_seen, timeout, modified_pixels)
                     VALUES (?, DEFAULT, DEFAULT, DEFAULT, DEFAULT);`, [userName]);
        const {result} = await query(`SELECT id
                                      FROM \`r/place\`.users
                                      WHERE username = ?`, [userName]);
        if (!result || !result[0] || !result[0].id)
            return undefined;

        const userId = result[0].id;
        await this.setIPHashToUser(ip, fingerprint, userId);
        return userId;
    }

    public static async setIPHashToUser(ip: string, hash: string, userId: number): Promise<void> {
        await Promise.all([query(`INSERT INTO \`r/place\`.known_ips (ip, user)
                                  VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE user = ?;`, [ip, userId, userId]),
            query(`INSERT INTO \`r/place\`.known_fingerprints (fingerprint, user)
                   VALUES (?, ?)
                   ON DUPLICATE KEY UPDATE user = ?;`, [hash, userId, userId])
        ]);
    }

    public static async getUserID(ip: string, fingerprint: string): Promise<number | undefined> {
        const {result} = await query(`SELECT user
                                      FROM \`r/place\`.known_fingerprints
                                      WHERE fingerprint = ?
                                        AND EXISTS(SELECT user FROM \`r/place\`.known_ips WHERE ip = ?)`,
            [fingerprint, ip]);
        return result && result[0] ? result[0].user : undefined;
    }

    public static async getAnonymeUser(userId: number): Promise<User | undefined> {
        const {result} = await query(`SELECT date_registered
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [userId]);
        if (!result || !result[0] || !result[0].date_registered)
            return undefined;

        return new User(userId, "", "", new Date(result[0].date_registered).getTime() / 1000);
    }

    public static async getUser(ip: string, fingerprint: string): Promise<User | undefined> {
        const userId = await this.getUserID(ip, fingerprint);
        if (userId == undefined)
            return undefined;

        const {result} = await query(`SELECT date_registered
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [userId]);
        if (!result || !result[0] || !result[0].date_registered)
            return undefined;

        return new User(userId, ip, fingerprint, new Date(result[0].date_registered).getTime() / 1000);
    }

    async canPlacePixels(): Promise<boolean> {
        if (this.userID == 0 && (this._currentIp === "::ffff:127.0.0.1" ||
            this._currentIp === "::1"))
            return true;

        const timeout = await this.timeout();
        return Date.now() / 1000 >= timeout;
    }

    async username(): Promise<string> {
        const {result} = await query(`SELECT username
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [this._userID]);
        return !result || !result[0] || !result[0].username ? undefined : result[0].username;
    }

    async knownHashes(): Promise<Array<string>> {
        const {result} = await query(`SELECT fingerprint
                                      FROM \`r/place\`.known_fingerprints
                                      WHERE user = ?`, [this._userID]);
        return result.map(x => x.fingerprint);
    }

    async knownIps(): Promise<Array<string>> {
        const {result} = await query(`SELECT ip
                                      FROM \`r/place\`.known_ips
                                      WHERE user = ?`, [this._userID]);
        return result.map(x => x.ip);
    }

    async getLastSeen(): Promise<number> {
        const {result} = await query(`SELECT last_seen
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [this._userID]);
        return !result || !result[0] || !result[0].last_seen ? undefined : result[0].last_seen;
    }

    async modifiedPixels(): Promise<number> {
        const {result} = await query(`SELECT modified_pixels
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [this._userID]);
        return !result || !result[0] ? undefined : result[0].modified_pixels;
    }

    async modifyPixel() {
        await query(`UPDATE \`r/place\`.users
                     SET modified_pixels = modified_pixels + 1
                     WHERE id = ?`, [this._userID]);
    }

    async timeout(): Promise<number> {
        const {result} = await query(`SELECT timeout
                                      FROM \`r/place\`.users
                                      WHERE id = ?`, [this._userID]);
        return !result || !result[0] || !result[0].timeout ? undefined : new Date(result[0].timeout).getTime() / 1000;
    }

    async setTimeout() {
        await query(`UPDATE \`r/place\`.users
                     SET timeout = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE)
                     WHERE id = ?`, [this._userID]);
    }

    async updateLastSeen() {
        await query(`UPDATE \`r/place\`.users
                     SET last_seen = current_timestamp
                     WHERE id = ?`, [this._userID]);

    }

    get userID(): number {
        return this._userID;
    }

    get createdAt(): number {
        return this._createdAt;
    }

    get currentIp(): string {
        return this._currentIp;
    }

    get currentHash(): string {
        return this._currentHash;
    }
}