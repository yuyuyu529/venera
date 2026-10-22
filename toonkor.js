// 툰코 Toonkor（toonkor6.org）— Venera 漫画源
// 站点为普通服务端 HTML；章节页正文以 base64 内嵌（var toon_img），解码即得图片直链
class Toonkor extends ComicSource {
    name = "툰코 Toonkor"
    key = "toonkor"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/yuyuyu529/venera@main/toonkor.js"

    static defaultBaseUrl = "toonkor6.org"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    // 题材表：[fi 参数, 中文]
    static genres = [
        ["성인", "成人"],
        ["드라마", "剧情"],
        ["판타지", "奇幻"],
        ["액션", "动作"],
        ["로맨스", "恋爱"],
        ["일상", "日常"],
        ["개그", "搞笑"],
        ["미스터리", "悬疑"],
        ["순정", "纯情"],
        ["스포츠", "运动"],
        ["BL", "BL"],
        ["스릴러", "惊悚"],
        ["무협", "武侠"],
        ["학원", "学园"],
        ["공포", "恐怖"],
        ["스토리", "故事"]
    ]

    settings = {
        base_url: {
            title: "站点域名（会换域名，在这里改）",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Toonkor.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || Toonkor.defaultBaseUrl).trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": Toonkor.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko,ja;q=0.9",
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

    async getHtml(path) {
        const res = await Network.get(this.absoluteUrl(path), this.headers)
        if (res && res.error) throw `Toonkor 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `Toonkor 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    // 列表卡片：div.section-item-inner
    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        doc.querySelectorAll(".section-item-inner").forEach((el) => {
            const a = el.querySelector(".section-item-title a") || el.querySelector(".section-item-title a[href]")
            if (!a) return
            const href = String(a.attributes["href"] || "").trim()
            if (!href || href.indexOf("fil=") >= 0) return
            const h3 = el.querySelector(".section-item-title h3")
            const title = String((h3 && h3.text) || a.attributes["alt"] || "").trim()
            const img = el.querySelector(".section-item-photo img") || el.querySelector("img")
            const cover = img ? this.absoluteUrl(img.attributes["src"] || img.attributes["data-src"]) : ""
            const genEl = el.querySelector(".toon_gen")
            const tags = genEl ? String(genEl.text || "").split("/").map((x) => x.trim()).filter(Boolean) : []
            if (title && !out.some((c) => c.id === href)) {
                out.push(new Comic({ id: href, title: title, cover: cover, subTitle: tags.join(" / "), tags: tags }))
            }
        })
        return out
    }

    explore = [
        { title: "인기 人气", type: "multiPageComicList",
          load: async (page) => ({ comics: this.parseList(await this.getHtml(`/웹툰?fil=${encodeURIComponent("인기")}`)), maxPage: 1 }) },
        { title: "연재 连载中", type: "multiPageComicList",
          load: async (page) => ({ comics: this.parseList(await this.getHtml(`/웹툰/${encodeURIComponent("연재")}`)), maxPage: 1 }) },
        { title: "완결 已完结", type: "multiPageComicList",
          load: async (page) => ({ comics: this.parseList(await this.getHtml(`/웹툰/${encodeURIComponent("완결")}`)), maxPage: 1 }) },
    ]

    category = {
        title: "툰코 Toonkor",
        parts: [{
            name: "题材",
            type: "fixed",
            categories: Toonkor.genres.map((g) => g[1]),
            categoryParams: Toonkor.genres.map((g) => g[0]),
            itemType: "category",
        }],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => ({
            comics: this.parseList(await this.getHtml(`/웹툰?fil=${encodeURIComponent(String(param || ""))}`)),
            maxPage: 1,
        }),
    }

    // 站点搜索参数(stx)不过滤，只会原样返回列表 —— 所以这里拉三份列表在本地按标题过滤
    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            const kw = String(keyword || "").trim().toLowerCase()
            if (!kw) return { comics: [], maxPage: 1 }
            const paths = [
                `/웹툰?fil=${encodeURIComponent("인기")}`,
                `/웹툰/${encodeURIComponent("연재")}`,
                `/웹툰/${encodeURIComponent("완결")}`,
            ]
            const htmls = await Promise.all(paths.map((p) => this.getHtml(p).catch(() => "")))
            const all = []
            htmls.forEach((h) => {
                this.parseList(h).forEach((c) => {
                    if (!all.some((x) => x.id === c.id)) all.push(c)
                })
            })
            return { comics: all.filter((c) => String(c.title || "").toLowerCase().indexOf(kw) >= 0), maxPage: 1 }
        },
    }

    comic = {
        // 支持粘贴作品网址直接打开
        idMatch: "https?://[^/]*toonkor[0-9]*[^/]*/[^/?#]+",
        link: {
            domains: ["toonkor6.org", "toonkor4.org"],
            linkToId: (url) => {
                const u = String(url || "")
                const m = u.match(/toonkor[0-9]*\.[a-z]+\/([^/?#]+)/i)
                return m ? "/" + decodeURIComponent(m[1]) : null
            },
        },

        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const html = await this.getHtml(url)
            const doc = new HtmlDocument(html)

            // 标题：meta[name=title] / og:title，去掉 " - 툰코(Toonkor)" 后缀
            let title = ""
            const tEl = doc.querySelector("meta[name=title]") || doc.querySelector("meta[property=\"og:title\"]")
            if (tEl) title = String(tEl.attributes["content"] || "")
            title = title.replace(/\s*-\s*툰코.*$/, "").trim()

            // 封面：详情页缩略图
            let cover = ""
            const cEl = doc.querySelector("[class*=thumb] img") || doc.querySelector("meta[property=\"og:image\"]")
            if (cEl) cover = this.absoluteUrl(cEl.attributes["src"] || cEl.attributes["content"] || "")

            // 简介：meta[name=description]（含 作者 / 总话数 / 梗概）
            let description = ""
            const dEl = doc.querySelector("meta[name=description]")
            if (dEl) {
                description = String(dEl.attributes["content"] || "")
                    .replace(/^\s*\S+\s*작가\s*/, "")
                    .replace(/\s*총편수\s*총\s*/g, "\n\n总话数：")
                    .replace(/\s*작가\s*/g, "\n作者：")
                    .trim()
            }

            // 章节：td[data-role] （站点顺序为最新 → 最老，倒过来让第 1 话在最前）
            const arr = []
            doc.querySelectorAll("td.episode__index[data-role]").forEach((td) => {
                const href = this.absoluteUrl(td.attributes["data-role"])
                let name = String(td.attributes["alt"] || "").trim()
                const m = name.match(/(\d+(?:\.\d+)?화)\s*$/)
                if (m) name = m[1]
                if (!href || !/\.html$/i.test(href) || arr.some((x) => x[0] === href)) return
                arr.push([href, name || href])
            })
            const chapters = new Map()
            for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])

            return new ComicDetails({ title: title, cover: cover, description: description, tags: {}, chapters: chapters, url: url })
        },

        loadEp: async (comicId, epId) => {
            const chapterUrl = this.absoluteUrl(epId)
            const html = await this.getHtml(chapterUrl)

            // 正文图：var toon_img = '<base64 的图片 HTML>'
            const m = String(html).match(/var\s+toon_img\s*=\s*['"]([^'"]+)['"]/)
            if (!m) throw "Toonkor 章节页未找到 toon_img（可能章节已失效）"

            let inner = ""
            try {
                inner = Convert.decodeUtf8(Convert.decodeBase64(m[1]))
            } catch (e) {
                throw `Toonkor 图片数据解码失败：${this.errorMessage(e)}`
            }

            const images = []
            const doc = new HtmlDocument(inner)
            doc.querySelectorAll("img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["src"] || img.attributes["data-src"])
                if (src && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "Toonkor 章节没有返回图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: { "User-Agent": Toonkor.ua, "Referer": `${this.baseUrl}/` },
        }),
    }

    // 题材中文翻译（官方 translation 字段）
    translation = {
        'zh_CN': {
            "성인": "成人",
            "드라마": "剧情",
            "판타지": "奇幻",
            "액션": "动作",
            "로맨스": "恋爱",
            "일상": "日常",
            "개그": "搞笑",
            "미스터리": "悬疑",
            "순정": "纯情",
            "스포츠": "运动",
            "BL": "BL",
            "스릴러": "惊悚",
            "무협": "武侠",
            "학원": "学园",
            "공포": "恐怖",
            "스토리": "故事"
        },
        'zh_TW': {
            "성인": "成人",
            "드라마": "剧情",
            "판타지": "奇幻",
            "액션": "动作",
            "로맨스": "恋爱",
            "일상": "日常",
            "개그": "搞笑",
            "미스터리": "悬疑",
            "순정": "纯情",
            "스포츠": "运动",
            "BL": "BL",
            "스릴러": "惊悚",
            "무협": "武侠",
            "학원": "学园",
            "공포": "恐怖",
            "스토리": "故事"
        },
    }
}
