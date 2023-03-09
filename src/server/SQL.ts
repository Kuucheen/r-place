import * as mysql from "mysql";
import {log} from "../helpers/Logcat";

interface QueryResult {
    result,
    fields
}

export const database = mysql.createPool({
    connectionLimit: 10,
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'r/place'
});

export function query(sql: string,
                      values = [],
                      timeout: number = 1000): Promise<QueryResult> {
    return new Promise<QueryResult>(resolve => {
        database.query({
            sql: sql,
            timeout: timeout,
            values: values
        }, (err, result, fields) => {
            if (err) {
                log().critical("database", "Failed to query data from database", err);
                return resolve({result: undefined, fields: undefined});
            }
            resolve({result, fields});
        });
    });
}

database.on("connection", conn =>
    log().debug("database", `Connection created`, conn.threadId));
database.on('enqueue', () => log().debug("database",
    "Query got enqueued for an available connection"));
