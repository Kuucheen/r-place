import {Websocket} from "./Websocket";
import {ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData} from "../../helpers/SocketEvents";
import {Socket} from "socket.io/dist/socket";
import {Image} from "../image/Image";
import {log} from "../../helpers/Logcat";
import {User} from "../user/User";
import {ShortCacheMap} from "../../helpers/ShortCacheMap";

function getIP(req): string {
    return req.header('x-forwarded-for') || req.socket.remoteAddress;
}

async function getCreateUser(ip: string, fingerprint: string): Promise<User | undefined> {
    let user = await User.getUser(ip, fingerprint);
    if (!user) {
        await User.createUser(ip, fingerprint);
        return User.getUser(ip, fingerprint);
    }
    return user;
}

export class PlaceSocket extends Websocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    static readonly width: number = 50;
    static readonly height: number = 50;
    static readonly chunkSize: number = PlaceSocket.width / 10;
    private readonly image: Image;
    private readonly ipHashes: ShortCacheMap<string, string>;

    constructor(port: number) {
        super(port);
        log().info("Started socket");
        this.image = new Image(this.socket, PlaceSocket.width, PlaceSocket.height);
        this.ipHashes = new ShortCacheMap<string, string>(30 * 1000);
        this.register().then(() => console.log("Registered"));
    }

    private async register(): Promise<void> {
        await this.image.loadLatestCanvas();
        this.app.get('/', (req, res) => {
            const ip = getIP(req);
            const hash = req.fingerprint.hash;

            if (req.query.user === "admin" && req.query.userId == 0 && (ip === "::1" || ip === "::ffff:127.0.0.1")) {
                log().critical("users", "User connected as admin", {ip, hash});
                this.ipHashes.set(ip, "admin");
            } else this.ipHashes.set(ip, hash);


            log().info("socket", "Client connected", {
                ip: ip,
                fingerprint: hash
            });
            res.render('index', {
                title: "HTL r/Place"
            });
        })
        this.app.post("/error", (req, res) => {
            res.render('error', {
                title: "HTL r/Place",
                err: req.body.error
            });
        });
        this.socket.on("connection", client => this.createConnection(client));
    }

    private async createConnection(client: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
        const ip = client.handshake.address;
        const hash = this.ipHashes.get(ip);
        if (!hash) {
            log().error("users", "No fingerprint provided", {ip, fingerprint: hash});
            client.emit("error", "invalidHash");
            return;
        }

        const user = await getCreateUser(ip, hash);
        if (!user) {
            log().error("users", "Couldn't get user", {ip, fingerprint: hash});
            client.emit("error", "missingUser");
            return;
        }
        log().debug("socket", "Client established socket.io connection", {ip, userId: user.userID, hash});

        user.timeout().then(timeout => client.emit("timeoutUpdated", timeout));

        client.on("getChunk", async (chunkX, chunkY) => {
            // ToDo Validate values
            const data = await this.image.getChunk(chunkX, chunkY);
            client.emit("postChunk", chunkX, chunkY, data);
        });
        client.on("mouseDown", (x, y, color) =>
            this.mouseDown(client, user, x, y, color));

        client.emit("postStats", PlaceSocket.width, PlaceSocket.height, PlaceSocket.chunkSize);
    }

    private async mouseDown(client: Socket,
                            user: User,
                            x: any | undefined | null,
                            y: any | undefined | null,
                            color: any | undefined | null) {
        if (typeof x != "number" || typeof y != "number" || color == undefined || !color[0] || !color[1] || !color[2])
            return log().error("edit-session", "User sent invalid types", {
                userId: user.userID,
                ip: user.currentIp,
                hash: user.currentHash,
                x,
                y,
                color
            });
        if (x < 0 || x >= PlaceSocket.width || y < 0 || y > PlaceSocket.height) return log().error("edit-session",
            "User tried to place pixel outside of canvas", {
                userId: user.userID,
                ip: user.currentIp,
                hash: user.currentHash,
                x,
                y,
                color
            });


        if (!(await user.canPlacePixels())) return log().error("edit-session",
            "User sent pixel modification request while in timeout", {
                userId: user.userID,
                ip: user.currentIp,
                hash: user.currentHash,
                x,
                y,
                color
            });

        await this.image.setPixel(user, x, y, color);
        client.emit("timeoutUpdated", await user.timeout());
    }
}