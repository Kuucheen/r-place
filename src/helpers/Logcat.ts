const logger = require("cinovo-logger");

require("cinovo-logger-file")(true, true, true, true, "./logs", "log", ".txt", 1024 * 1000, 60 * 60 * 6, 25, () => {
}).then(e => logger.append(e));
logger.append(require("cinovo-logger-console")(false, false, false, true));

export function log() {
    return logger;
}