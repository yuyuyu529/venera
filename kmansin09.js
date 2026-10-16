// K-Mansin（kmansin09）— Venera 漫画源
// 站点：Madara WordPress（NoAjax 列表 + MangaAjax 章节），无图片加密
// 接口与选择器依据：Keiyoushi 扩展 Kmansin09.kt / MadaraBase.kt，并已逐项实测
class Kmansin09 extends ComicSource {
    name = "K-Mansin (韩漫)"
    key = "kmansin09"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/kmansin09.js"

    static defaultBaseUrl = "kmansin09.top"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Kmansin09.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Kmansin09.defaultBaseUrl).trim()
            .replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": Kmansin09.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.9",
            "Referer": `${this.baseUrl}/`,
            "X-Requested-With": "XMLHttpRequest",
        }
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


    async getHtml(path) {
        const res = await Network.get(this.absoluteUrl(path), this.headers)
        if (res && res.error) throw `K-Mansin 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `K-Mansin 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    // 解析 Madara 列表卡片
    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        this.qsa(doc, ".page-item-detail| .c-tabs-item__content").forEach((el) => {
            const a = el.querySelector(".post-title a") || el.querySelector("h3 a")
            if (!a) return
            const href = this.absoluteUrl(a.attributes["href"])
            if (!/\/manga\//.test(href)) return
            const img = el.querySelector("img")
            const cover = img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"]) : ""
            const title = String(a.text || "").trim()
            if (title) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        return out
    }

    explore = [
        {
            title: "热门",
            type: "multiPageComicList",
            load: async (page) => ({
                comics: this.parseList(await this.getHtml(`/manga/page/${Math.max(1, page)}/?m_orderby=views`)),
                maxPage: null,
            }),
        },
        {
            title: "最新",
            type: "multiPageComicList",
            load: async (page) => ({
                comics: this.parseList(await this.getHtml(`/manga/page/${Math.max(1, page)}/?m_orderby=latest`)),
                maxPage: null,
            }),
        },
    ]

    category = {
        title: "K-Mansin",
        parts: [
            {
                name: "排序",
                type: "fixed",
                categories: ["热门", "最新", "评分", "字母"],
                categoryParams: ["views", "latest", "rating", "alphabet"],
                itemType: "category",
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getHtml(`/manga/page/${Math.max(1, page)}/?m_orderby=${encodeURIComponent(param || "views")}`)),
            maxPage: null,
        }),
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(await this.getHtml(`/?s=${encodeURIComponent(String(keyword || "").trim())}&post_type=wp-manga`)),
            maxPage: null,
        }),
    }

    comic = {
        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const doc = new HtmlDocument(await this.getHtml(url))

            const tEl = doc.querySelector(".post-title h1") || doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            const cEl = doc.querySelector(".summary_image img")
            const cover = cEl ? this.absoluteUrl(cEl.attributes["data-src"] || cEl.attributes["src"]) : ""
            const dEl = doc.querySelector(".description-summary") || doc.querySelector(".summary__content")
            const description = dEl ? String(dEl.text || "").replace(/\s+/g, " ").trim() : ""

            const genres = []
            doc.querySelectorAll(".genres-content a").forEach((e) => {
                const s = String(e.text || "").trim()
                if (s && genres.indexOf(s) < 0) genres.push(s)
            })

            // 章节：Madara MangaAjax → POST {mangaPath}/ajax/chapters/
            const chapters = new Map()
            try {
                const res = await Network.post(`${url.replace(/\/+$/, "")}/ajax/chapters/`, this.headers, "")
                if (res && Number(res.status) === 200) {
                    const cdoc = new HtmlDocument(String(res.body || ""))
                    const arr = []
                    cdoc.querySelectorAll("li.wp-manga-chapter a").forEach((a) => {
                        const href = this.absoluteUrl(a.attributes["href"])
                        if (!href || arr.some((x) => x[0] === href)) return
                        arr.push([href, String(a.text || "").trim() || href])
                    })
                    // 站点顺序是最新→最老，反转后让最老章在前
                    for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])
                }
            } catch (_) {}

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: { "题材": genres },
                chapters: chapters,
                url: url,
            })
        },

        loadEp: async (comicId, epId) => {
            const doc = new HtmlDocument(await this.getHtml(epId))
            const images = []
            this.qsa(doc, ".reading-content .page-break img.wp-manga-chapter-img| .reading-content img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"])
                if (src && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "K-Mansin 章节没有返回正文图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: {
                "User-Agent": Kmansin09.ua,
                "Referer": this.absoluteUrl(epId || comicId),
            },
        }),
    }
}
