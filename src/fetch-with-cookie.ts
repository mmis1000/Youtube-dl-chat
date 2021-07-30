import nodeFetch from 'node-fetch'
import fetchCookie from 'fetch-cookie'
import FileCookieStore from './file-cookie-store'

export const createFetchInstance = (cookieJarPath: string, saveCookie = false) => {
  return fetchCookie(nodeFetch, new fetchCookie.toughCookie.CookieJar(new FileCookieStore(cookieJarPath, {
    lockfile: saveCookie,
    auto_sync: saveCookie
  })))
}