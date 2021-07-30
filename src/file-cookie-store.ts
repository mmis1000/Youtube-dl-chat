declare module 'fetch-cookie' {
    export const toughCookie: typeof import('tough-cookie')
}

import { readFile, writeFile, promises as fs } from 'fs';
import { inspect as _inspect, promisify } from 'util';
import { lock, unlock } from 'lockfile';

import { toughCookie } from 'fetch-cookie'

const {
    canonicalDomain,
    permuteDomain,
    permutePath,
} = toughCookie;

type Cookie = import('tough-cookie').Cookie
const Cookie = toughCookie.Cookie as new (...args: ConstructorParameters<typeof import('tough-cookie').Cookie>) => Cookie;
type Store = import('tough-cookie').Store
const Store = toughCookie.Store as new (...args: ConstructorParameters<typeof import('tough-cookie').Store>) => Store

type DropLast<T> =
    T extends [infer U1, infer U2, infer U3, infer U4, infer U5, any] ? [U1, U2, U3, U4, U5]
    : T extends [infer U1, infer U2, infer U3, infer U4, any] ? [U1, U2, U3, U4]
    : T extends [infer U1, infer U2, infer U3, any] ? [U1, U2, U3]
    : T extends [infer UI, infer U2, any] ? [UI, U2]
    : T extends [infer U1, any] ? [U1]
    : never

type ParametersByLength<Fn extends (...args: any[]) => any, T extends number> =
    T extends 4 ? (Fn extends ((A0: infer U0, A1: infer U1, A2: infer U2, A3: infer U3) => any) ? [U0, U1, U2, U3] : never)
    : T extends 3 ? (Fn extends ((A0: infer U0, A1: infer U1, A2: infer U2) => any) ? [U0, U1, U2] : never)
    : T extends 2 ? (Fn extends ((A0: infer U0, A1: infer U1) => any) ? [U0, U1] : never)
    : T extends 1 ? (Fn extends ((A0: infer U0) => any) ? [U0] : never)
    : (Fn extends ((...args: infer U) => any) ? U : never)

type A = DropLast<Parameters<typeof readFile>>;

const nbind = <T extends (...args: any[]) => any>(
    fn: T,
    self?: ThisType<T>
): (...args: DropLast<Parameters<T>>) => Promise<ReturnType<T>> => {
    return promisify(fn.bind(self));
}

const nfcall = <T extends (...args: any[]) => any>(
    fn: T,
    ...args: any[]
): Promise<ReturnType<T>> => {
    const wrapped = promisify(fn) as (...args: any[]) => any
    return wrapped(...args) as any;
}

const Q = <T = void>(arg?: T) => Promise.resolve(arg)

const all = Promise.all

function isString(str: any): str is string | String {
    return typeof str === 'string' || str instanceof String;
}

function noop() { }

function lockFileName(file_name: string) {
    return file_name + '.lock';
}

interface FileCookieStoreOptions {
    force_parse?: boolean
    lockfile?: boolean
    mode?: number
    http_only_extension?: boolean
    lockfile_retries?: number
    auto_sync?: boolean
    no_file_error?: boolean
}
interface WriteOptions {
    disable_lock: boolean
}
interface DomainData {
    [path: string]: {
        [key: string]: import('tough-cookie').Cookie
    }
}

type ContinueCallback = (err?: any, self?: FileCookieStore) => void

class FileCookieStore extends Store {
    private force_parse: boolean
    private lockfile: boolean
    private mode: number
    private http_only_extension: boolean
    private lockfile_retries: number
    private auto_sync: boolean
    private no_file_error: boolean

    private readed: boolean = false
    private idx: { [key: string]: DomainData }

    public readonly synchronous: false = false

    constructor(private file: string, opt: FileCookieStoreOptions = {}) {
        super()

        this.file = file;
        this.force_parse = opt.force_parse ?? false;
        this.lockfile = opt.lockfile ?? true;
        this.mode = opt.mode ?? 438;
        this.http_only_extension = opt.http_only_extension ?? true;
        this.lockfile_retries = opt.lockfile_retries ?? 200;
        this.auto_sync = opt.auto_sync ?? true;
        this.no_file_error = opt.no_file_error ?? false;

        if (!this.file || !isString(this.file)) {
            throw new Error("Unknown file for read/write cookies");
        }

        this.idx = {};
    }
    inspect() {
        return "{ idx: " + _inspect(this.idx, false, 2) + ' }';
    }
    _readFile(cb: ContinueCallback) {
        fs.readFile(this.file, 'utf8').
            then((data) => {
                this.readed = true;
                if (!data) { return cb(null, this); }
                this.deserialize(<string>data)
                cb(null, this);
            }).
            catch((err) => {
                if (!(err.code && err.code === 'ENOENT' && !this.no_file_error))
                    cb(err);

                else
                    cb();
            })
    }
    _read(cb: ContinueCallback) {
        this._readFile(cb);
    }
    _get_lock_func(disable_lock: boolean) {
        var lock_file = lockFileName(this.file);

        type a = ParametersByLength<typeof lock, 3>

        return !disable_lock && this.lockfile ? nfcall(lock, lock_file, {
            retries: this.lockfile_retries,
            retryWait: 50
        }) : Q();
    }
    _get_unlock_func(disable_lock: boolean) {
        var lock_file = lockFileName(this.file);
        return !disable_lock && this.lockfile ? nfcall(unlock, lock_file)
            : Q();
    }
    _write(options_: WriteOptions | null, cb: ContinueCallback) {
        var data = this.serialize(this.idx);
        const options = options_ ?? <WriteOptions>{};
        cb = cb || noop;
        this._get_lock_func(options.disable_lock).
            then(() => {
                return nfcall(writeFile, this.file, data, { mode: this.mode });
            }).
            then(() => {
                cb();
            }).
            catch((err) => {
                cb(err);
            }).
            finally(() => {
                return this._get_unlock_func(options.disable_lock);
            })
    }
    _update(updateFunc: () => void, cb: ContinueCallback) {
        this._get_lock_func(!this.auto_sync).
            then(() => {
                return nbind(this._read, this)();
            }).
            then(() => {
                updateFunc();
                return this.auto_sync ? nbind(this._write, this)({ disable_lock: true }) : Q();
            }).
            then(() => {
                cb();
            }).
            catch((err) => {
                cb(err);
            }).
            finally(() => {
                return this._get_unlock_func(!this.auto_sync);
            })
    }
    serialize(idx: Record<string, DomainData>) {
        var data = "# Netscape HTTP Cookie File\n" +
            "# http://www.netscape.com/newsref/std/cookie_spec.html\n" +
            "# This is a generated file!  Do not edit.\n\n";

        for (var domain in idx) {
            if (!idx.hasOwnProperty(domain))
                continue;
            for (var path in idx[domain]) {
                if (!idx[domain].hasOwnProperty(path))
                    continue;
                for (var key in idx[domain][path]) {
                    if (!idx[domain][path].hasOwnProperty(key))
                        continue;
                    var cookie = idx[domain][path][key];
                    if (cookie) {

                        var cookie_domain = cookie.domain;
                        if (!cookie.hostOnly) {
                            cookie_domain = '.' + cookie_domain;
                        }
                        var line = [this.http_only_extension && cookie.httpOnly ? '#HttpOnly_' + cookie_domain : cookie_domain,
                        /^\./.test(cookie_domain ?? '') ? "TRUE" : "FALSE",
                        cookie.path,
                        cookie.secure ? "TRUE" : "FALSE",
                        cookie.expires && cookie.expires != 'Infinity' ? Math.round(cookie.expires.getTime() / 1000) : '0',
                        encodeURIComponent(cookie.key),
                        encodeURIComponent(cookie.value),
                        ].join("\t") + "\n";
                        data += line;

                    }
                }
            }
        }
        return data;
    }
    /**
     *
     * @param {String} raw_data
     * @throws {Error} will throw error if file invalid and force_parse - false
     * @returns {Array}
     */
    deserialize(raw_data: string) {
        var data_by_line = raw_data.split(/\r\n|\n/), self = this, line_num = 0, parsed, http_only = false, magic = data_by_line.length ? data_by_line[0] : '';

        if ((!magic || !/^\#(?: Netscape)? HTTP Cookie File/.test(magic)) && !self.force_parse)
            throw new Error(this.file + " does not look like a netscape cookies file");

        data_by_line.forEach(function (line) {
            ++line_num;
            if (!(/^\s*$/.test(line) || (/^\s*\#/.test(line) &&
                !/^#HttpOnly_/.test(line)))) {

                if (self.http_only_extension && /^#HttpOnly_/.test(line)) {
                    http_only = true;
                    line = line.replace(/^#HttpOnly_(.*)/, "$1");
                } else {
                    http_only = false;
                }

                parsed = line.split(/\t/);
                if (parsed.length != 7)
                    if (!self.force_parse) {
                        throw new Error("Line " + line_num + " is not valid");
                    }

                    else
                        return;

                var domain = parsed[0], can_domain = canonicalDomain(domain);

                var cookie = new Cookie({
                    domain: can_domain,
                    path: parsed[2],
                    secure: parsed[3] == 'TRUE' ? true : false,
                    //expires : parseInt(parsed[4]) ? new Date(parsed[4] * 1000) : undefined,
                    expires: parseInt(parsed[4]) ? new Date(Number(parsed[4]) * 1000) : new Date(0),
                    key: decodeURIComponent(parsed[5]),
                    value: decodeURIComponent(parsed[6]),
                    httpOnly: http_only,
                    hostOnly: /^\./.test(domain) ? false : true
                });

                self._addCookie(cookie);
            }
        });
    }
    save(cb: ContinueCallback) {
        this._write(null, cb);
    }
    findCookie(domain: string, path: string, key: string, cb: (err: Error | null, cookie: Cookie | null) => void) {
        var self = this;
        this._read(function (err) {
            if (err)
                return cb(err, null);
            var can_domain = canonicalDomain(domain);

            if (!self.idx[can_domain]) {
                return cb(null, null);
            }

            if (!self.idx[can_domain][path]) {
                return cb(null, null);
            }

            return cb(null, self.idx[can_domain][path][key] || null);
        });
    }
    findCookies(domain: string, path: string, allowSpecialUseDomain: boolean, cb: (err: Error | null, cookie: Cookie[]) => void) {
        var self = this, results: Cookie[] = [];
        if (!domain)
            return cb(null, []);

        var can_domain = canonicalDomain(domain);
        this._read(function (err) {
            if (err)
                return cb(err, []);

            var pathMatcher: (index: DomainData) => void;
            if (!path) {
                // null or '/' means "all paths"
                pathMatcher = function matchAll(domainIndex: DomainData) {
                    for (var curPath in domainIndex) {
                        if (domainIndex.hasOwnProperty(curPath)) {
                            var pathIndex = domainIndex[curPath];
                            for (var key in pathIndex) {
                                if (pathIndex.hasOwnProperty(key)) {
                                    results.push(pathIndex[key]);
                                }
                            }
                        }
                    }
                };
            } else if (path === '/') {
                pathMatcher = function matchSlash(domainIndex: DomainData) {
                    var pathIndex = domainIndex['/'];
                    if (!pathIndex) {
                        return;
                    }
                    for (var key in pathIndex) {
                        if (pathIndex.hasOwnProperty(key)) {
                            results.push(pathIndex[key]);
                        }
                    }
                };
            } else {
                var paths = permutePath(path) || [path];
                pathMatcher = function matchRFC(domainIndex: DomainData) {
                    paths.forEach(function (curPath) {
                        var pathIndex = domainIndex[curPath];
                        if (!pathIndex) {
                            return;
                        }
                        for (var key in pathIndex) {
                            results.push(pathIndex[key]);
                        }
                    });
                };
            }

            var domains = permuteDomain(can_domain) || [can_domain];
            var idx = self.idx;
            domains.forEach(function (curDomain) {
                var domainIndex = idx[curDomain];
                if (!domainIndex) {
                    return;
                }
                pathMatcher(domainIndex);
            });
            cb(null, results);
        });
    }
    _addCookie(cookie: Cookie) {
        var domain = cookie.canonicalizedDomain() ?? '';
        if (!this.idx[domain]) {
            this.idx[domain] = {};
        }
        if (!this.idx[domain][cookie.path ?? '']) {
            this.idx[domain][cookie.path ?? ''] = {};
        }
        this.idx[domain][cookie.path ?? ''][cookie.key] = cookie;
    }
    putCookie(cookie: Cookie, cb: ContinueCallback) {
        this._update(() => {
            this._addCookie(cookie);
        }, cb);
    }
    updateCookie(oldCookie: Cookie, newCookie: Cookie, cb: ContinueCallback) {
        this.putCookie(newCookie, cb);
    }
    removeCookie(domain: string, path: string, key: string, cb: ContinueCallback) {
        this._update(() => {
            var can_domain = canonicalDomain(domain);
            if (this.idx[can_domain] && this.idx[can_domain][path] && this.idx[can_domain][path][key]) {
                delete this.idx[can_domain][path][key];
            }
        }, cb);
    }
    removeCookies(domain: string, path: string, cb: ContinueCallback) {
        this._update(() => {
            var can_domain = canonicalDomain(domain);
            if (this.idx[can_domain]) {
                if (path) {
                    delete this.idx[can_domain][path];
                } else {
                    delete this.idx[can_domain];
                }
            }
        }, cb);
    }
    export(cookie_store: (err: Error | null, cookies: Cookie[]) => void): void
    export(cookie_store: FileCookieStore, cb: (err: Error | null, cookies: Cookie[]) => void): void
    export(cookie_store: any, cb?: any) {
        var self = this;
        if (arguments.length < 2) {
            cb = cookie_store;
            cookie_store = null;
        }
        if (!cookie_store) {
            cookie_store = [];
        }
        this._read(function (err) {
            var fns = [];
            var idx = self.idx;
            for (var domain in idx) {
                if (!idx.hasOwnProperty(domain))
                    continue;
                for (var path in idx[domain]) {
                    if (!idx[domain].hasOwnProperty(path))
                        continue;
                    for (var key in idx[domain][path]) {
                        if (!idx[domain][path].hasOwnProperty(key))
                            continue;
                        var cookie = idx[domain][path][key];
                        if (cookie) {
                            if (cookie_store instanceof Store) {
                                var func = nbind(cookie_store.putCookie, cookie_store);
                                fns.push(func(cookie));
                            } else {
                                cookie_store.push(cookie);
                            }
                        }
                    }
                }
            }

            if (fns.length) {
                all(fns).then(function () {
                    cb(null, cookie_store);
                }).
                    catch(function (err) {
                        cb(err);
                    })
            } else {
                cb(null, cookie_store);
            }
        });

        return cookie_store;
    }
    getAllCookies(cb: (err: Error | null, cookies: Cookie[]) => void) {
        this.export(function (err, cookies) {
            if (err) {
                cb(err, []);
            } else {
                cookies.sort(function (a, b) {
                    return (a.creationIndex || 0) - (b.creationIndex || 0);
                });
                cb(null, cookies);
            }
        });
    }
}

export default FileCookieStore;
