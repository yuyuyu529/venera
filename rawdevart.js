// Venera 漫画源
class Rawdevart extends ComicSource {
    name = "Rawdevart"
    key = "rawdevart"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/rawdevart.js"

    static defaultBaseUrl = "rawdevart.art"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Rawdevart.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Rawdevart.defaultBaseUrl).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": Rawdevart.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en,ja;q=0.9",
            "Referer": `${this.baseUrl}/`,
        }
    }

    // 章节页有「Continue」门控：带上 read=1 才能拿到图片列表
    get readHeaders() {
        return Object.assign({}, this.headers, { "Cookie": "read=1" })
    }


    static genres = [
        ["/genre/ne106/romance", "romance"],
        ["/genre/ne107/seinen", "seinen"],
        ["/genre/ne108/school%20life", "school life"],
        ["/genre/ne109/shounen%20ai", "shounen ai"],
        ["/genre/ne110/yuri", "yuri"],
        ["/genre/ne111/gender%20bender", "gender bender"],
        ["/genre/ne112/mature", "mature"],
        ["/genre/ne114/drama", "drama"],
        ["/genre/ne115/historical", "historical"],
        ["/genre/ne116/webtoons", "webtoons"],
        ["/genre/ne118/shounen", "shounen"],
        ["/genre/ne119/psychological", "psychological"],
        ["/genre/ne120/shoujo", "shoujo"],
        ["/genre/ne121/mystery", "mystery"],
        ["/genre/ne122/sci%20fi", "sci fi"],
        ["/genre/ne123/smut", "smut"],
        ["/genre/ne124/sports", "sports"],
        ["/genre/ne125/manhwa", "manhwa"],
        ["/genre/ne126/martial%20arts", "martial arts"],
        ["/genre/ne127/horror", "horror"],
        ["/genre/ne128/manhua", "manhua"],
        ["/genre/ne130/josei", "josei"],
        ["/genre/ne131/shoujo%20ai", "shoujo ai"],
        ["/genre/ne132/medical", "medical"],
        ["/genre/ne134/cooking", "cooking"],
        ["/genre/ne135/tragedy", "tragedy"],
        ["/genre/ne138/trap%20(crossdressing)", "trap (crossdressing)"],
        ["/genre/ne139/adult", "adult"],
        ["/genre/ne140/animated", "animated"],
        ["/genre/ne141/moe", "moe"],
        ["/genre/ne142/one%20shot", "one shot"],
        ["/genre/ne143/mecha", "mecha"],
        ["/genre/ne144/Isekai", "Isekai"],
        ["/genre/ne146/Sci-fi", "Sci-fi"],
        ["/genre/ne147/Updating", "Updating"],
        ["/genre/ne148/Lolicon", "Lolicon"],
        ["/genre/ne149/Alternative%20World", "Alternative World"],
        ["/genre/ne150/Elves", "Elves"],
        ["/genre/ne151/Magic", "Magic"],
        ["/genre/ne152/Food", "Food"],
        ["/genre/ne153/War", "War"],
        ["/genre/ne154/Shotacon", "Shotacon"],
        ["/genre/ne155/Game", "Game"],
        ["/genre/ne156/N%2FA", "N/A"],
        ["/genre/ne157/Oneshot", "Oneshot"],
        ["/genre/ne161/Yaoi", "Yaoi"],
        ["/genre/ne163/Adaptions", "Adaptions"],
        ["/genre/ne164/Thriller", "Thriller"],
        ["/genre/ne165/Crime", "Crime"],
        ["/genre/ne166/Police", "Police"],
        ["/genre/ne167/Girls%26apos%3B%20Love", "Girls' Love"],
        ["/genre/ne168/Animals", "Animals"],
        ["/genre/ne169/Hentai", "Hentai"],
        ["/genre/ne170/Philosophical", "Philosophical"],
        ["/genre/ne85/action", "action"],
        ["/genre/ne86/adventure", "adventure"],
        ["/genre/ne87/comedy", "comedy"],
        ["/genre/ne88/ecchi", "ecchi"],
        ["/genre/ne89/fantasy", "fantasy"],
        ["/genre/ne90/harem", "harem"],
        ["/genre/ne91/loli", "loli"],
        ["/genre/ne92/slice%20of%20life", "slice of life"],
        ["/genre/ne93/supernatural", "supernatural"]
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
        if (res && res.error) throw `Rawdevart 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Rawdevart 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        doc.querySelectorAll(".m-item").forEach((el) => {
            const a = el.querySelector('a[href*="/g/"]') || el.querySelector("a[href]")
            if (!a) return
            const href = this.absoluteUrl(a.attributes["href"])
            const img = el.querySelector("img")
            const title = String(a.attributes["title"] || (img && img.attributes["alt"]) || el.text || "").trim()
            const cover = img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"]) : ""
            if (title && /\/g\//.test(href) && !out.some((c) => c.id === href)) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        return out
    }

    explore = [
        { title: "最新更新", type: "multiPageComicList", load: async (page) => ({ comics: this.parseList(await this.getHtml(page > 1 ? `/page/${page}/` : "/")), maxPage: null }) },
    ]

    category = {
        title: "Rawdevart",
        parts: [{
            name: "题材",
            type: "fixed",
            categories: Rawdevart.genres.map((g) => g[1]),
            categoryParams: Rawdevart.genres.map((g) => g[0]),
            itemType: "category",
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => {
            const p = String(param || "").trim()
            const url = p.startsWith("/genre/") ? p : `/genre/${p}`
            return { comics: this.parseList(await this.getHtml(url + (page > 1 ? `?page=${page}` : ""))), maxPage: null }
        },
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getHtml(`/search?q=${encodeURIComponent(String(keyword || "").trim())}`)),
            maxPage: null,
        }),
    }

    comic = {
        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const doc = new HtmlDocument(await this.getHtml(url))
            const tEl = doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            const arr = []
            doc.querySelectorAll('a[href*="/read/"]').forEach((a) => {
                const href = this.absoluteUrl(a.attributes["href"])
                if (!href || arr.some((x) => x[0] === href)) return
                arr.push([href, String(a.attributes["title"] || a.text || "").trim() || href])
            })
            const chapters = new Map()
            for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])
            return new ComicDetails({ title: title, cover: "", description: "", tags: {}, chapters: chapters, url: url })
        },

        loadEp: async (comicId, epId) => {
            const chapterUrl = this.absoluteUrl(epId)
            const html = await this.getHtml(chapterUrl, this.readHeaders)
            const doc = new HtmlDocument(html)

            // 图片服务器基址（页面提供多个，取第一个）
            let server = ""
            const sEl = doc.querySelector(".servers a[data-server]") || doc.querySelector("[data-server]")
            if (sEl) server = String(sEl.attributes["data-server"] || "")
            if (!server) server = "https://s3.rawuwu.net/"

            const images = []
            this.qsa(doc, ".chapter-img img[data-src]| .chapter-imgs img[data-src]").forEach((img) => {
                const rel = String(img.attributes["data-src"] || "")
                if (!rel) return
                const abs = /^https?:\/\//i.test(rel) ? rel : server.replace(/\/+$/, "") + "/" + rel.replace(/^\/+/, "")
                if (images.indexOf(abs) < 0) images.push(abs)
            })
            if (images.length === 0) throw "Rawdevart 章节没有返回图片（可能被隐藏内容门控）"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Rawdevart.ua, "Referer": this.absoluteUrl(epId || comicId) },
        }),
    }
}
