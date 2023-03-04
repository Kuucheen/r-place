const logger = require("cinovo-logger");

const endpoint = require("cinovo-logger-file")(true, true, true, true, "./logs", "log", ".txt", 1024 * 1000, 60 * 60 * 6, 25, () => {
});
logger.append(endpoint);
logger.append(require("cinovo-logger-console")(false, false, false, true));

export function log() {
    return logger;
}