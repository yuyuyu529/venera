// Venera 漫画源
class Dokiraw extends ComicSource {
    name = "Dokiraw"
    key = "dokiraw"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/dokiraw.js"

    static defaultBaseUrl = "dokiraw.guru"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    get headers() {
        return {
            "User-Agent": Dokiraw.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.9",
            "Referer": `${this.baseUrl}/`,
        }
    }

    static genres = [
        ["Ecchi", "Ecchi"],
        ["SF", "SF"],
        ["アクション", "アクション"],
        ["エロい", "エロい"],
        ["コメディ", "コメディ"],
        ["スポーツ", "スポーツ"],
        ["ファンタジー", "ファンタジー"],
        ["フルカラー", "フルカラー"],
        ["ロマンス", "ロマンス"],
        ["異世界", "異世界"]
    ]

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Dokiraw.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Dokiraw.defaultBaseUrl).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
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
        if (res && res.error) throw `Dokiraw 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Dokiraw 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        doc.querySelectorAll('a[href*="/manga/"]').forEach((a) => {
            const img = a.querySelector("img")
            if (!img) return
            const href = this.absoluteUrl(a.attributes["href"])
            if (!/\/manga\//.test(href)) return
            const title = String(img.attributes["alt"] || a.attributes["title"] || "").trim()
            const cover = this.absoluteUrl(img.attributes["data-original"] || img.attributes["data-src"] || img.attributes["src"])
            if (title && href && !out.some((c) => c.id === href)) {
                out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
            }
        })
        return out
    }

    explore = [
        { title: "热门", type: "multiPageComicList", load: async (page) => ({ comics: this.parseList(await this.getHtml("/hot")), maxPage: null }) },
    ]

    category = {
        title: "Dokiraw",
        parts: [{
            name: "题材",
            type: "fixed",
            categories: Dokiraw.genres.map((g) => g[1]),
            categoryParams: Dokiraw.genres.map((g) => g[0]),
            itemType: "category",
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getHtml(`/search/manga?genre=${encodeURIComponent(String(param || ""))}`)),
            maxPage: null,
        }),
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getHtml(`/search/manga?q=${encodeURIComponent(String(keyword || "").trim())}`)),
            maxPage: null,
        }),
    }

    comic = {
        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const html = await this.getHtml(url)
            const doc = new HtmlDocument(html)
            const tEl = doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            let cover = ""
            const og = String(html).match(/property=["']?og:image["']?\s+content=["']([^"']+)/i) || String(html).match(/content=["']([^"']+)["']\s+property=["']?og:image/i)
            if (og) cover = this.absoluteUrl(og[1])

            // 章节：a[href*=chapter] 内含 div[class*=manga-detail_chapter]（不用 parentElement）
            const arr = []
            doc.querySelectorAll('a[href*="/chapter"]').forEach((a) => {
                if (!a.querySelector("div[class*=manga-detail_chapter]")) return
                const href = this.absoluteUrl(a.attributes["href"])
                if (!href || arr.some((x) => x[0] === href)) return
                const sp = a.querySelector("span")
                const name = String((sp && sp.text) || a.text || "").trim() || href
                arr.push([href, name])
            })
            const chapters = new Map()
            for (let i = 0; i < arr.length; i++) chapters.set(arr[i][0], arr[i][1])

            return new ComicDetails({ title: title, cover: cover, description: "", tags: {}, chapters: chapters, url: url })
        },

        loadEp: async (comicId, epId) => {
            const doc = new HtmlDocument(await this.getHtml(epId))
            const images = []
            doc.querySelectorAll("div.page-chapter img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["src"] || img.attributes["data-src"])
                if (src && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "Dokiraw 章节没有返回图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Dokiraw.ua, "Referer": this.absoluteUrl(epId || comicId) },
        }),
    }
}
