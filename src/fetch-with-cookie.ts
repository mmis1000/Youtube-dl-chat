import nodeFetch from 'node-fetch'
import { toughCookie } from 'fetch-cookie'
import fetchCookie from 'fetch-cookie/node-fetch'
import FileCookieStore from './file-cookie-store'

export const createFetchInstance = (cookieJarPath: string, saveCookie = false) => {
  return fetchCookie(nodeFetch, new toughCookie.CookieJar(new FileCookieStore(cookieJarPath, {
    lockfile: saveCookie,
    auto_sync: saveCookie
  })))
}