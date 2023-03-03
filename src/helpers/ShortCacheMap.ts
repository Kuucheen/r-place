import {log} from "./Logcat";

export class ShortCacheMap<K, V> extends Map<K, V> {
    private readonly ttl: number;

    constructor(ttl) {
        super();
        this.ttl = ttl;
    }

    set(key: K, value: V): this {
        super.set(key, value);
        setTimeout(() => {
            super.delete(key);
            log().debug("scm", "Deleted short cache entry", {key, value});
        }, this.ttl);
        return this;
    }
}