// version
var VERSION = '1.0.0'
// pre cache name
var PRE_CACHE_NAME = 'HUHU_PRE_CACHE_' + VERSION
// white cache name
var WHITE_CACHE_NAME = 'HUHU_WHITE_CACHE_' + VERSION
// 是否缓存当前源的文件
var CACHE_SAME_ORIGIN_FILE = false
// 需要预缓存文件,只能是同源的文件
var PRE_CACHE_FILES = [
  // html
  '/',
  '/404.html',

  // css
  '/style/style.css',

  // img
  '/images/favicon.ico',
  '/screen/icon-48x48.png',

  // js
  '/scripts/app.js',
  '/scripts/iconfont.js',
  '/scripts/registerSW.js',
  '/scripts/search.js',
  '/scripts/share.js',
  '/scripts/util.js',
  '/scripts/cdn/Valine.min.js',

  // font
  '/font/demo.woff2'
]
// 白名单缓存文件，不能所有请求都做缓存，cache会爆炸
var WHITE_CACHE_FILES = [
  'css.min.js',
  'av-min.js',
  'require.min.js',
  'jquery.min.js',
  'jquery.pjax.min.js',
  'jquery-confirm.min.js',
  'jquery.fancybox.min.js',
  'search_children.js'
]

// 监听message
self.addEventListener('message', function(event) {
  console.log('sw receive message---', event.data)
  event.waitUntil(Promise.all([deleteCache(), fetchPreCache()]))
})

// sw.js被安装时会触发 install 事件
self.addEventListener('install', event => {
  /**
   * event.waitUtil 用于在安装成功之前执行一些预装逻辑
   * 但是建议只做一些轻量级和非常重要资源的缓存，减少安装失败的概率
   * 安装成功后 ServiceWorker 状态会从 installing 变为 installed
   */
  event.waitUntil(self.skipWaiting()) // 执行skipWaiting跳过waiting状态，进入activate状态
})

// 监听activate
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // 当一个 service worker 被初始注册时
      // 页面在下次加载之前不会使用它。
      // claim() 方法会立即控制这些页面
      self.clients.claim(),
      // 清理旧版本
      deleteCache()
    ])
  )
})

function fetchCacheFile(path, cache) {
  return cache.add(path).catch(error => {
    console.warn('fetch' + path + 'failed', error || {})
    return Promise.resolve()
  })
}

function fetchPreCache() {
  if (!PRE_CACHE_FILES || PRE_CACHE_FILES.length === 0) {
    return Promise.resolve()
  } else {
    return caches
      .open(PRE_CACHE_NAME)
      .then(cache => {
        var promiseArr = []
        PRE_CACHE_FILES.forEach(item => {
          promiseArr.push(fetchCacheFile(item, cache))
        })

        console.time(`fetch pre file used time:`)

        return Promise.all(promiseArr)
          .then(() => console.log('pre cache file success'))
          .catch(e => {
            console.warn('pre cache file failed----', e || {})
            return Promise.resolve()
          })
          .finally(() => {
            console.timeEnd(`fetch pre file used time:`)
          })
      })
      .catch(e => {
        console.warn('pre cache file failed----', e || {})
        return Promise.resolve()
      })
  }
}

function deleteCache() {
  return caches.keys().then(list => {
    return Promise.all(
      list.map(key => {
        if (!~key.indexOf(VERSION)) {
          console.log('delete sw key---', key)
          return caches.delete(key).catch(e => {
            console.log('delete sw cache failed----', e || {})
            return Promise.resolve()
          })
        }
        return Promise.resolve()
      })
    )
  })
}

// 监听所有scope下的网络请求
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => {
      // 返回缓存中命中的文件
      if (resp) {
        return resp
      }

      var respToFetch = event.request.clone()
      return onlineRequest(respToFetch)
    })
  )
})

// 联网状态下执行
function onlineRequest(respToFetch) {
  var options = {}

  respToFetch &&
    respToFetch.request &&
    respToFetch.request.mode === 'cors' &&
    (options = { mode: 'cors' })

  return fetch(respToFetch, options)
    .then(response => {
      // 成功的GET请求
      let succeedGetResp =
        response &&
        (response.status === 0 || response.status === 200) &&
        respToFetch.method === 'GET'

      if (
        succeedGetResp &&
        (matchWhiteCache(respToFetch.url) ||
          (CACHE_SAME_ORIGIN_FILE && matchSameOrigin(respToFetch.url)))
      ) {
        var respToCache = response.clone()
        caches.open(WHITE_CACHE_NAME).then(cache => {
          cache.put(respToFetch, respToCache)
        })
        return response
      }

      return response
    })
    .catch(e => console.warn('fetch failed----', e))
}

/**
 * 缓存同源的文件
 */
function matchSameOrigin(url) {
  // 匹配访问地址开头是否是当前origin
  if (url && url.indexOf(location.origin) === 0) {
    return true
  }
  return false
}

/**
 * 是否白名单缓存
 */
function matchWhiteCache(url) {
  var flag = false
  if (url && WHITE_CACHE_FILES && WHITE_CACHE_FILES.length > 0) {
    // forEach map 中不能使用break，会报错
    // return false 也只是跳出当前循环
    // 可以throw抛出异常，在外层try catch获取错误，来跳出整个循环
    for (var i = 0; i < WHITE_CACHE_FILES.length; i++) {
      if (~url.indexOf(WHITE_CACHE_FILES[i])) {
        flag = true
        break
      }
    }
  }
  return flag
}

// 监听error
self.onerror = (errorMessage, scriptURI, lineNumber, columnNumber, error) => {
  if (error) {
    reportError(error)
  } else {
    reportError({
      message: errorMessage,
      script: scriptURI,
      line: lineNumber,
      column: columnNumber
    })
  }
}

// 监听unhandledrejection
self.addEventListener('unhandledrejection', function(event) {
  reportError({
    message: event.reason
  })
})

function reportError(e) {
  console.warn(e)
}
