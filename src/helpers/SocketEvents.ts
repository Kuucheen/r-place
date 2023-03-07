interface ServerToClientEvents {
    updateAll: (width, height, paths: Array<number>) => void;
    error: (error: string) => void;
    timeoutUpdated: (timestamp) => void;
}

interface ClientToServerEvents {
    mouseDown: (x: number, y: number, color: Array<number>) => void;
    requestTimeout: () => void;
}

interface InterServerEvents {
    update: (x: number, y: number, color: Array<number>) => void;
}

interface SocketData {
    ip: string,
    hash: string,

}


export {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
};
