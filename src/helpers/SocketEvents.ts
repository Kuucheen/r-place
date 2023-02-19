interface ServerToClientEvents {
    updateAll: (paths: Array<number>) => void;
}

interface ClientToServerEvents {
    mouseDown: (x: number, y: number, color: Array<number>) => void;
}

interface InterServerEvents {
    update: (x: number, y: number, color: Array<number>) => void;
}

interface SocketData {
}


export {
    ServerToClientEvents,
    ClientToServerEvents,
    InterServerEvents,
    SocketData,
};
