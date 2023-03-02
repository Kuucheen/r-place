import {Websocket} from "./Websocket";
import {ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData} from "../../helpers/SocketEvents";
import {Socket} from "socket.io/dist/socket";
import {Image} from "../image/Image";
import {log} from "../../helpers/Logcat";

function getIP(req): string {
    return req.header('x-forwarded-for') || req.socket.remoteAddress;
}

export class PlaceSocket extends Websocket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData> {
    static readonly width: number = 50;
    static readonly height: number = 50;
    private readonly image: Image;

    constructor(port: number) {
        super(port);
        this.image = new Image(PlaceSocket.width, PlaceSocket.height);
        this.register();
    }

    private register(): void {
        this.app.get('/', (req, res) => {
            res.render('index', {
                title: "HTL r/Place"
            });

            log().info("socket", "Client connected to the server. Sending index page", {
                ip: getIP(req),
                fingerprint: req.fingerprint.hash
            });
        });
        this.socket.on("connection", client => this.createConnection(client));
    }

    private createConnection(client: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>) {
        this.image.getFullImage().then(img => client.emit("updateAll", img));
        client.on("mouseDown", (x, y, color) => {
            this.image.setPixel(x, y, color); //Todo Validate incoming values
            this.socket.emit("update", x, y, color);
        });
    }
}