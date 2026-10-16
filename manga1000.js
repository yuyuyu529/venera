// Venera 漫画源
class Manga1000 extends ComicSource {
    name = "Manga1000"
    key = "manga1000"
    version = "1.0.1"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/yuyuyu529/venera@main/manga1000.js";

    static defaultBaseUrl = "hachiraw.win"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

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
            const cover = img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"]) : ""
            if (title && href && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        if (out.length === 0) {
            doc.querySelectorAll('a[href*="/manga-"]').forEach((a) => {
                const img = a.querySelector("img")
                const href = this.absoluteUrl(a.attributes["href"])
                const title = String((img && img.attributes["alt"]) || a.text || "").trim()
                if (title && href && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"]) : "", subTitle: "" }))
            })
        }
        return out
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
            const doc = new HtmlDocument(await this.getHtml(url))
            const tEl = doc.querySelector(".entry-title") || doc.querySelector("article h1") || doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            const arr = []
            doc.querySelectorAll('a[href*="/chapter/"]').forEach((a) => {
                const href = this.absoluteUrl(a.attributes["href"])
                if (!href || arr.some((x) => x[0] === href)) return
                arr.push([href, String(a.text || "").trim() || href])
            })
            const chapters = new Map()
            for (let i = 0; i < arr.length; i++) chapters.set(arr[i][0], arr[i][1])
            return new ComicDetails({ title: title, cover: "", description: "", tags: {}, chapters: chapters, url: url })
        },

        loadEp: async (comicId, epId) => {
            const doc = new HtmlDocument(await this.getHtml(epId))
            const images = []
            this.qsa(doc, "img[data-src]| .entry-content img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"])
                if (src && !/lazy\.png/.test(src) && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "Manga1000 章节没有返回图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Manga1000.ua, "Referer": this.absoluteUrl(epId || comicId) },
        }),
    }
}
