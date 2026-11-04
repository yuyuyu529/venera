// Venera 漫画源
class Manga1000 extends ComicSource {
    name = "Manga1000"
    key = "manga1000"
    version = "1.1.0"
    minAppVersion = "1.0.0"
    url = "https://gcore.jsdelivr.net/gh/yuyuyu529/venera@main/manga1000.js";

    // 分类名中文翻译（官方 translation 字段）
    translation = {
        'zh_CN': {
            "Action": "动作",
            "Adult": "成人",
            "Ecchi": "擦边",
            "Fantasy": "奇幻",
            "Harem": "后宫"
        },
        'zh_TW': {
            "Action": "动作",
            "Adult": "成人",
            "Ecchi": "擦边",
            "Fantasy": "奇幻",
            "Harem": "后宫"
        },
    }


    static defaultBaseUrl = "hachiraw.win"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    // 站点自己的一张图，仅在完全取不到封面时兜底，避免下载任务卡在「下载封面」这一步
    static fallbackCover = "/themes/hachiraw/img/lazy.png"

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Manga1000.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Manga1000.defaultBaseUrl).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": Manga1000.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.9",
        }
    }


    static genres = [
        ["6", "Action"],
        ["7", "Adult"],
        ["11", "Ecchi"],
        ["12", "Fantasy"],
        ["14", "Harem"]
    ]

    absoluteUrl(u) {
        const s = String(u || "").trim()
        if (!s) return ""
        if (/^https?:\/\//i.test(s)) return s
        return `${this.baseUrl}${s.startsWith("/") ? "" : "/"}${s}`
    }

    errorMessage(e) { return String((e && (e.message || e)) || e) }

    // Venera 的 HtmlDocument 不支持逗号组合选择器，这里拆开依次查询
    qsa(root, selectors) {
        const out = []
        String(selectors).split("|").forEach((s) => {
            const sel = s.trim()
            if (!sel) return
            try { root.querySelectorAll(sel).forEach((e) => { if (out.indexOf(e) < 0) out.push(e) }) } catch (_) {}
        })
        return out
    }

    isLazy(u) { return !u || /lazy\.png|placeholder|loading\.gif|blank\.(gif|png)$/i.test(String(u)) }

    // <img data-src="真图" src="lazy.png"> 是本站的懒加载写法
    imgSrc(img) {
        if (!img) return ""
        const ds = img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["data-lazy-src"]
        if (ds && !this.isLazy(ds)) return this.absoluteUrl(ds)
        const src = img.attributes["src"]
        if (src && !this.isLazy(src)) return this.absoluteUrl(src)
        return ""
    }


    async getHtml(path, headers) {
        const res = await Network.get(this.absoluteUrl(path), headers || this.headers)
        if (res && res.error) throw `Manga1000 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Manga1000 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        this.qsa(doc, ".article-wrap-inner| article").forEach((el) => {
            const a = el.querySelector('a[href*="/manga-"]')
            if (!a) return
            const href = this.absoluteUrl(a.attributes["href"])
            const img = el.querySelector("img")
            const title = String((img && img.attributes["alt"]) || a.text || "").trim()
            const cover = this.imgSrc(img)
            if (title && href && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        if (out.length === 0) {
            doc.querySelectorAll('a[href*="/manga-"]').forEach((a) => {
                const img = a.querySelector("img")
                const href = this.absoluteUrl(a.attributes["href"])
                const title = String((img && img.attributes["alt"]) || a.text || "").trim()
                if (title && href && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: this.imgSrc(img), subTitle: "" }))
            })
        }
        return out
    }

    // 详情页封面：漫画页第一张图就是系列封面（.wp-block-image 里的懒加载图）
    parseCover(doc) {
        const selectors = [
            ".wp-block-image img",
            ".entry-content img",
            "article img",
            "img",
        ]
        for (const sel of selectors) {
            let imgs = []
            try { imgs = doc.querySelectorAll(sel) } catch (_) { imgs = [] }
            for (const img of imgs) {
                const src = this.imgSrc(img)
                if (src) return src
            }
        }
        const meta = doc.querySelector('meta[property="og:image"]') || doc.querySelector('meta[name="og:image"]')
        if (meta && meta.attributes["content"]) return this.absoluteUrl(meta.attributes["content"])
        return ""
    }

    explore = [
        { title: "最新更新", type: "multiPageComicList", load: async (page) => ({ comics: this.parseList(await this.getHtml(page > 1 ? `/page/${page}/` : "/")), maxPage: null }) },
    ]

    category = {
        title: "Manga1000",
        parts: [{
            name: "分类",
            type: "fixed",
            categories: Manga1000.genres.map((g) => g[1]),
            categoryParams: Manga1000.genres.map((g) => g[0]),
            itemType: "category",
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getHtml(`/category/${encodeURIComponent(String(param || ""))}/` + (page > 1 ? `page/${page}/` : ""))),
            maxPage: null,
        }),
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getHtml(`/search?query=${encodeURIComponent(String(keyword || "").trim())}`)),
            maxPage: null,
        }),
    }

    comic = {
        // 支持粘贴漫画网址直接打开
        idMatch: "https?://[^/]*hachiraw[^/]*/manga-[^/]+",
        link: {
            domains: ["hachiraw.win"],
            linkToId: (url) => {
                const m = String(url || "").match(/\/(manga-[^/?#]+)/)
                return m ? `/${m[1]}/` : null
            },
        },

        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const html = await this.getHtml(url)
            const doc = new HtmlDocument(html)
            const tEl = doc.querySelector(".entry-title") || doc.querySelector("article h1") || doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            const arr = []
            doc.querySelectorAll('a[href*="/chapter/"]').forEach((a) => {
                const href = this.absoluteUrl(a.attributes["href"])
                if (!href || arr.some((x) => x[0] === href)) return
                arr.push([href, String(a.text || "").trim() || href])
            })
            const chapters = new Map()
            // 站点顺序是最新→最老，倒过来让第 1 话在最前
            for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])

            const cover = this.parseCover(doc) || this.absoluteUrl(Manga1000.fallbackCover)

            // 简介 / 作者 / 状态 / 题材（页面只有这些结构化信息，没有长简介）
            const paras = []
            try { doc.querySelectorAll(".entry-content p").forEach((p) => paras.push(String(p.text || "").trim())) } catch (_) {}
            const authorM = paras.find((x) => /^Author\s*[:：]/i.test(x))
            const author = authorM ? authorM.replace(/^Author\s*[:：]\s*/i, "").trim() : ""
            const statusM = paras.find((x) => /^(Updating|Completed|Ongoing|Finished|Publishing)$/i.test(x))
            const status = statusM ? statusM.trim() : ""

            const tags = {}
            const tagLinks = []
            try {
                doc.querySelectorAll('.entry-content a[href*="/category/"]').forEach((a) => {
                    const t = String(a.text || "").trim()
                    if (t && tagLinks.indexOf(t) < 0) tagLinks.push(t)
                })
            } catch (_) {}
            if (tagLinks.length) tags["题材"] = tagLinks

            const descParts = []
            if (author) descParts.push(`作者：${author}`)
            if (tagLinks.length) descParts.push(`题材：${tagLinks.join(" / ")}`)
            if (status) descParts.push(`状态：${status}`)
            const description = descParts.join("\n")

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                uploader: author || undefined,
                subtitle: status || undefined,
                subTitle: status || undefined,
                url: url,
            })
        },

        loadEp: async (comicId, epId) => {
            const doc = new HtmlDocument(await this.getHtml(epId))
            const images = []
            const push = (u) => {
                const s = this.imgSrc(u)
                if (s && images.indexOf(s) < 0) images.push(s)
            }
            // 优先 .entry-content 里的懒加载图，兜底扫全页图
            const main = this.qsa(doc, ".entry-content img| #TopPage img")
            main.forEach(push)
            if (images.length === 0) {
                doc.querySelectorAll("img").forEach(push)
            }
            // 去掉站点 logo / 统计像素之类
            const cleaned = images.filter((u) => !/\/img\/(logo|lazy|loading)|mc\.yandex|cloudflareinsights/i.test(u))
            if (cleaned.length === 0) throw "Manga1000 章节没有返回图片"
            return { images: cleaned }
        },

        onImageLoad: (url, comicId, epId) => {
            const chapterUrl = this.absoluteUrl(epId || comicId)
            const base = { "User-Agent": Manga1000.ua, "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8" }
            // 章节图在 tiktokcdn 上：第三方 Referer 反而可能被拒；站点自己的图带上正常 Referer
            const isCdn = /tiktokcdn\.com|ibytedtos\.com/i.test(url)
            const cfg = {
                url: url,
                headers: Object.assign({}, base, isCdn ? {} : { "Referer": chapterUrl }),
            }
            // 失败时换一套头再试（有无 Referer 互换），修「下载报错」
            cfg.onLoadFailed = () => ({
                url: url,
                headers: Object.assign({}, base, isCdn ? { "Referer": chapterUrl } : {}),
            })
            return cfg
        },

        onThumbnailLoad: (url) => {
            const u = url || this.absoluteUrl(Manga1000.fallbackCover)
            return {
                url: u,
                headers: { "User-Agent": Manga1000.ua, "Referer": this.baseUrl + "/" },
            }
        },
    }
}
