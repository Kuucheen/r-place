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

async function getUser(ip: string, fingerprint: string): Promise<number | undefined> {
    let userId = await User.getUserID(ip, fingerprint);
    if (!userId)
        userId = await User.createUser(ip, fingerprint);
    return userId;
}

export class PlaceSocket extends Websocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    static readonly width: number = 50;
    static readonly height: number = 50;
    private readonly image: Image;
    private readonly ipHashes: ShortCacheMap<string, string>;

    constructor(port: number) {
        super(port);
        this.image = new Image(this.socket, PlaceSocket.width, PlaceSocket.height);
        this.ipHashes = new ShortCacheMap<string, string>(30 * 1000);
        this.register();
    }

    private register(): void {
        this.app.get('/', async (req, res) => {
            res.render('index', {
                title: "HTL r/Place"
            });

            const ip = getIP(req);
            const hash = req.fingerprint.hash;
            this.ipHashes.set(ip, hash);

            log().info("socket", "Client connected", {
                ip: ip,
                fingerprint: hash
            });
        });
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
            log().info("users", "No fingerprint provided", {ip, fingerprint: hash});
            client.emit("error", "invalidHash");
            return;
        }

        const userId = await getUser(ip, hash);
        if (!userId) {
            log().info("users", "Couldn't get userId", {ip, fingerprint: hash});
            client.emit("error", "missingUser");
            return;
        }

        const user = await User.getUser(userId);
        log().debug("socket", "Client established socket.io connection", {ip, userId, hash});

        this.image.getFullImage().then(img => client.emit("updateAll", img));
        user.timeout().then(timeout => client.emit("timeoutUpdated", timeout));

        client.on("mouseDown", async (x, y, color) => {
            if (!(await user.canPlacePixels())) {
                log().info("edit-session", "User sent pixel modification request while in timeout", {
                    userId,
                    ip,
                    hash,
                    x,
                    y,
                    color
                });
                return;
            }


            await this.image.setPixel(user, x, y, color); //Todo Validate incoming values
            client.emit("timeoutUpdated", await user.timeout());
        });
    }
}