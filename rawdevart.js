// Rawdevart（rawdevart.art）— Venera 漫画源
// 依据 Keiyoushi 扩展 Rawdevartart.kt 的 JSON API，并逐项实测
class Rawdevart extends ComicSource {
    name = "Rawdevart"
    key = "rawdevart"
    version = "1.1.1"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/yuyuyu529/venera@main/rawdevart.js";

    static defaultBaseUrl = "rawdevart.art"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    // 题材表：[id, 名称]，取自 /genre/all 的 <a id="..." title="...">
    static genres = [
        ["85", "action"],
        ["163", "Adaptions"],
        ["139", "adult"],
        ["86", "adventure"],
        ["149", "Alternative World"],
        ["168", "Animals"],
        ["140", "animated"],
        ["87", "comedy"],
        ["134", "cooking"],
        ["165", "Crime"],
        ["114", "drama"],
        ["88", "ecchi"],
        ["150", "Elves"],
        ["89", "fantasy"],
        ["152", "Food"],
        ["155", "Game"],
        ["111", "gender bender"],
        ["167", "Girls' Love"],
        ["90", "harem"],
        ["169", "Hentai"],
        ["115", "historical"],
        ["127", "horror"],
        ["144", "Isekai"],
        ["130", "josei"],
        ["91", "loli"],
        ["148", "Lolicon"],
        ["151", "Magic"],
        ["128", "manhua"],
        ["125", "manhwa"],
        ["126", "martial arts"],
        ["112", "mature"],
        ["143", "mecha"],
        ["132", "medical"],
        ["141", "moe"],
        ["121", "mystery"],
        ["156", "N/A"],
        ["142", "one shot"],
        ["157", "Oneshot"],
        ["170", "Philosophical"],
        ["166", "Police"],
        ["119", "psychological"],
        ["106", "romance"],
        ["108", "school life"],
        ["122", "sci fi"],
        ["146", "Sci-fi"],
        ["107", "seinen"],
        ["154", "Shotacon"],
        ["120", "shoujo"],
        ["131", "shoujo ai"],
        ["118", "shounen"],
        ["109", "shounen ai"],
        ["92", "slice of life"],
        ["123", "smut"],
        ["124", "sports"],
        ["93", "supernatural"],
        ["164", "Thriller"],
        ["135", "tragedy"],
        ["138", "trap (crossdressing)"],
        ["147", "Updating"],
        ["153", "War"],
        ["116", "webtoons"],
        ["161", "Yaoi"],
        ["110", "yuri"]
    ]

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
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en,ja;q=0.9",
            "Referer": `${this.baseUrl}/`,
        }
    }

    absoluteUrl(u) {
        const s = String(u || "").trim()
        if (!s) return ""
        if (/^https?:\/\//i.test(s)) return s
        return `${this.baseUrl}${s.startsWith("/") ? "" : "/"}${s}`
    }

    errorMessage(e) { return String((e && (e.message || e)) || e) }

    async getJson(path) {
        const res = await Network.get(this.absoluteUrl(path), this.headers)
        if (res && res.error) throw `Rawdevart 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Rawdevart 请求失败（HTTP ${res && res.status}）`
        try { return JSON.parse(String(res.body || "")) } catch (_) { throw "Rawdevart 返回的不是 JSON" }
    }

    parseList(json) {
        const out = []
        const list = (json && json.manga_list) || []
        list.forEach((m) => {
            if (!m || !m.manga_id) return
            out.push(new Comic({
                id: String(m.manga_id),
                title: String(m.manga_name || ""),
                cover: this.absoluteUrl(m.manga_cover_img || m.manga_cover_img_normal || ""),
                subTitle: "",
            }))
        })
        return out
    }

    explore = [
        { title: "最新更新", type: "multiPageComicList",
          load: async (page) => ({ comics: this.parseList(await this.getJson(`/spa/latest-manga?page=${Math.max(1, page)}`)), maxPage: null }) },
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
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getJson(`/spa/genre/${encodeURIComponent(String(param || "all"))}?page=${Math.max(1, page)}`)),
            maxPage: null,
        }),
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getJson(`/spa/search?query=${encodeURIComponent(String(keyword || "").trim())}&page=${Math.max(1, page)}`)),
            maxPage: null,
        }),
    }

    comic = {
        // 点题材直接搜索
        onClickTag: (namespace, tag) => ({ action: "search", keyword: String(tag || "") }),

        // 支持粘贴漫画网址直接打开（/g/ne<id>）
        idMatch: "https?://[^/]*rawdevart[^/]*/g/ne(\\d+)",
        link: {
            domains: ["rawdevart.art"],
            linkToId: (url) => {
                const m = String(url || "").match(/\/g\/ne(\d+)/)
                return m ? m[1] : null
            },
        },

        loadInfo: async (id) => {
            const j = await this.getJson(`/spa/manga/${encodeURIComponent(String(id))}`)
            const d = j.detail || {}
            const tags = (j.tags || []).map((t) => String(t.tag_name || "")).filter(Boolean)

            // 章节：站点 JSON 就是「最新 → 最老」，与其它源保持一致，不再反转
            const chapters = new Map()
            ;(j.chapters || []).forEach((c) => {
                const num = String(c.chapter_number === undefined ? "" : c.chapter_number).replace(/\.0$/, "")
                if (!num) return
                const title = String(c.chapter_title || "").trim()
                chapters.set(`${id}/${num}`, "Chapter " + num + (title ? ": " + title : ""))
            })

            let cover = d.manga_cover_img_full || d.manga_cover_img || ""
            const description = String(d.manga_description || "").replace(/\s+/g, " ").trim()

            return new ComicDetails({
                title: String(d.manga_name || ""),
                cover: this.absoluteUrl(cover),
                description: description,
                tags: tags.length ? { "题材": tags } : {},
                chapters: chapters,
                url: `${this.baseUrl}/g/ne${id}`,
            })
        },

        loadEp: async (comicId, epId) => {
            const j = await this.getJson(`/spa/manga/${epId}`)
            const cd = j.chapter_detail || {}
            let server = String(cd.server || "").replace(/\/+$/, "")
            if (!server) server = this.baseUrl

            const images = []
            const doc = new HtmlDocument(String(cd.chapter_content || ""))
            doc.querySelectorAll("img[data-src]").forEach((img) => {
                const rel = String(img.attributes["data-src"] || "")
                if (!rel) return
                const abs = /^https?:\/\//i.test(rel) ? rel : server + "/" + rel.replace(/^\/+/, "")
                if (images.indexOf(abs) < 0) images.push(abs)
            })
            if (images.length === 0) throw "Rawdevart 章节没有返回图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Rawdevart.ua, "Referer": `${this.baseUrl}/` },
        }),
    }
}
