interface ServerToClientEvents {
    postStats: (width, height, chunkSize) => void;
    updateAll: (width, height, paths: Array<number>) => void;
    error: (error: string) => void;
    timeoutUpdated: (timestamp) => void;
    postChunk: (chunkX, chunkY, data: Array<number>) => void;
}

interface ClientToServerEvents {
    mouseDown: (x: number, y: number, color: Array<number>) => void;
    requestTimeout: () => void;
    getChunk: (chunkX, chunkY) => void;
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
