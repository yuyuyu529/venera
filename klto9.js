// Venera 漫画源
class Klto9 extends ComicSource {
    name = "Klto9"
    key = "klto9"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/klto9.js"

    static defaultBaseUrl = "klto9.com"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Klto9.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Klto9.defaultBaseUrl).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": Klto9.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.9",
            "Referer": `${this.baseUrl}/`,
        }
    }

    get xhrHeaders() {
        return Object.assign({}, this.headers, { "X-Requested-With": "XMLHttpRequest", "Accept": "*/*" })
    }

    static genres = [
        ["Action", "Action"],
        ["Adult", "Adult"],
        ["Adventure", "Adventure"],
        ["Comedy", "Comedy"],
        ["Demons", "Demons"],
        ["Drama", "Drama"],
        ["Ecchi", "Ecchi"],
        ["Fantasy", "Fantasy"],
        ["Gender-Bender", "Gender Bender"],
        ["Harem", "Harem"],
        ["Historical", "Historical"],
        ["Horror", "Horror"],
        ["Isekai", "Isekai"],
        ["Josei", "Josei"],
        ["Magic", "Magic"],
        ["Mature", "Mature"],
        ["Mecha", "Mecha"],
        ["Mystery", "Mystery"],
        ["Psychological", "Psychological"],
        ["Romance", "Romance"],
        ["School-Life", "School Life"],
        ["Sci-fi", "Sci-fi"],
        ["Seinen", "Seinen"],
        ["Shoujo", "Shoujo"],
        ["Shounen", "Shounen"],
        ["Shounen-Ai", "Shounen Ai"],
        ["Slice-of-Life", "Slice of Life"],
        ["Smut", "Smut"],
        ["Sports", "Sports"],
        ["Super-Power", "Super Power"],
        ["Supernatural", "Supernatural"],
        ["Tragedy", "Tragedy"],
        ["Yaoi", "Yaoi"],
        ["Yuri", "Yuri"]
    ]

    static rand(n) {
        const s = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        let r = ""
        for (let i = 0; i < n; i++) r += s.charAt(Math.floor(Math.random() * s.length))
        return r
    }


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
        if (res && res.error) throw `Klto9 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Klto9 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        doc.querySelectorAll(".thumb-item-flow").forEach((el) => {
            const a = el.querySelector(".series-title a") || el.querySelector("a[href*='/manga-']")
            if (!a) return
            const href = this.absoluteUrl(a.attributes["href"])
            const title = String(a.attributes["title"] || a.text || "").trim()
            const img = el.querySelector("img")
            const cover = img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"]) : ""
            if (title && href && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        return out
    }

    explore = [
        { title: "最新更新", type: "multiPageComicList",
          load: async (page) => ({ comics: this.parseList(await this.getHtml(`/manga-list.html?listType=pagination&page=${Math.max(1, page)}&sort=last_update&sort_type=DESC`)), maxPage: null }) },
    ]

    category = {
        title: "Klto9",
        parts: [{
            name: "题材",
            type: "fixed",
            categories: Klto9.genres.map((g) => g[1]),
            categoryParams: Klto9.genres.map((g) => g[0]),
            itemType: "category",
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getHtml(`/manga-list-genre-${encodeURIComponent(String(param || ""))}.html?page=${Math.max(1, page)}`)),
            maxPage: null,
        }),
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getHtml(`/manga-list.html?name=${encodeURIComponent(String(keyword || "").trim())}&page=${Math.max(1, page)}`)),
            maxPage: null,
        }),
    }

    comic = {
        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const html = await this.getHtml(url)
            const doc = new HtmlDocument(html)
            const tEl = doc.querySelector(".manga-info h3") || doc.querySelector(".manga-info h1") || doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""

            // 站点用 dataL 变量存 slug（章节接口需要它）
            const m = String(html).match(/dataL\s*=\s*"([^"]+)"/)
            const slug = m ? m[1] : ""

            // 章节接口：GET /<random>.lstc?slug=<slug>（需要 Referer）
            const chapters = new Map()
            if (slug) {
                try {
                    const res = await Network.get(this.absoluteUrl(`/${Klto9.rand(25)}.lstc?slug=${encodeURIComponent(slug)}`), this.xhrHeaders)
                    if (res && Number(res.status) === 200) {
                        const cd = new HtmlDocument(String(res.body || ""))
                        const arr = []
                        cd.querySelectorAll('a[href*="chapter"]').forEach((a) => {
                            const href = this.absoluteUrl(a.attributes["href"])
                            if (!href || arr.some((x) => x[0] === href)) return
                            arr.push([href, String(a.attributes["title"] || a.text || "").trim() || href])
                        })
                        for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])
                    }
                } catch (_) {}
            }

            return new ComicDetails({ title: title, cover: "", description: "", tags: {}, chapters: chapters, url: url })
        },

        loadEp: async (comicId, epId) => {
            const chapterUrl = this.absoluteUrl(epId)
            const html = await this.getHtml(chapterUrl, this.xhrHeaders)
            const m = String(html).match(/value=["']?(\d+)["']?[^>]*id=["']chapter["']/) ||
                      String(html).match(/id=["']chapter["'][^>]*value=["']?(\d+)/)
            if (!m) throw "Klto9 章节页未找到 chapter id"

            const res = await Network.get(this.absoluteUrl(`/${Klto9.rand(30)}.iog?cid=${m[1]}`), this.xhrHeaders)
            if (res && res.error) throw `Klto9 图片接口错误：${this.errorMessage(res.error)}`
            if (!res || Number(res.status) !== 200) throw `Klto9 图片接口失败（HTTP ${res && res.status}）`

            const images = []
            const doc = new HtmlDocument(String(res.body || ""))
            this.qsa(doc, "img.chapter-img| img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["src"] || img.attributes["data-src"] || img.attributes["data-aload"])
                if (src && !/lzloader|pagespeed/.test(src) && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "Klto9 章节没有返回图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Klto9.ua, "Referer": this.absoluteUrl(epId || comicId) },
        }),
    }
}
