import {engine} from "express-handlebars";
import {join} from "path";
import {json, urlencoded} from "body-parser";
import {Server} from "socket.io";
import {DefaultEventsMap, EventsMap} from "socket.io/dist/typed-events";

const express = require('express')

export class Websocket<
    ListenEvents extends EventsMap = DefaultEventsMap,
    EmitEvents extends EventsMap = ListenEvents,
    ServerSideEvents extends EventsMap = DefaultEventsMap,
    SocketData = any> {
    protected port: number;
    protected app;
    protected server;
    protected socket: Server;

    constructor(port: number) {
        this.port = port;
        this.app = express();
        this.setupEngine();
        this.startServer();
    }

    protected startServer() {
        this.server = this.app.listen(this.port, () => console.log("Server is now reachable on port " + this.port));
        this.socket = new Server<ListenEvents, EmitEvents, ServerSideEvents, SocketData>(this.server);
    }

    private setupEngine(): void {
        this.app.engine('hbs', engine({
            extname: "hbs",
            defaultLayout: "layout",
            layoutsDir: "res/layouts"
        }));

        this.app.set('views', "res/views");
        this.app.set('view engine', "hbs");
        this.app.use(express.static('res/public'));
        this.app.use(urlencoded({extended: false}));
        this.app.use(json());
    }
}