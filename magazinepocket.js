// マガポケ Magazine Pocket — Venera 漫画源
// 依据 Keiyoushi 扩展 MagazinePocket.kt 的 API 与拆图算法，逐项实测
// 签名：X-Manga-Hash = SHA512( SHA256(参数哈希串) + SHA256("")_SHA512("") )
//       参数哈希串 = 按 key 排序后每个 "SHA256(key)_SHA512(value)" 用逗号连接
// 图片是 4x4 瓦片打乱，用 modifyImage 还原（已与真实页面比对一致）
class MagazinePocket extends ComicSource {
    name = "マガポケ Magazine Pocket"
    key = "magazinepocket"
    version = "1.0.0"
    minAppVersion = "1.0.5"
    url = "https://gcore.jsdelivr.net/gh/yuyuyu529/venera@main/magazinepocket.js"

    static apiHost = "api.pocket.shonenmagazine.com"
    static webSite = "https://pocket.shonenmagazine.com"
    static ua = "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"

    static rankCats = [
            ["30", "全部"],
            ["2", "必看推荐"],
            ["1", "原创"],
            ["31", "新作"],
            ["21", "动作"],
            ["22", "运动"],
            ["23", "恋爱"],
            ["24", "异世界"],
            ["25", "悬疑"],
            ["26", "黑道·不良"],
            ["27", "剧情"],
            ["28", "奇幻"],
            ["29", "日常"]
    ]

    static genreCats = [
            ["1", "恋爱·爱情喜剧"],
            ["2", "恐怖·悬疑"],
            ["3", "搞笑·喜剧·日常"],
            ["4", "科幻·奇幻"],
            ["5", "运动"],
            ["6", "人文剧情"],
            ["7", "黑社会·安格拉·不良"],
            ["8", "动作·战斗"],
            ["9", "异世界·异能"],
            ["10", "读切"],
            ["11", "MGP"]
    ]

    // ---------------- 签名 / 请求 ----------------
    hashHex(str, alg) {
        const bytes = Convert.encodeUtf8(String(str))
        const digest = alg === "sha256" ? Convert.sha256(bytes) : Convert.sha512(bytes)
        return Convert.hexEncode(digest).toLowerCase()
    }

    hashedParam(k, v) {
        return this.hashHex(k, "sha256") + "_" + this.hashHex(v, "sha512")
    }

    signature(params) {
        const keys = Object.keys(params).sort()
        const joined = keys.map((k) => this.hashedParam(k, String(params[k]))).join(",")
        const hash1 = this.hashHex(joined, "sha256")
        const cookieHash = this.hashedParam("", "")
        return this.hashHex(hash1 + cookieHash, "sha512")
    }

    apiHeaders(params) {
        return {
            "User-Agent": MagazinePocket.ua,
            "Accept": "application/json",
            "X-Manga-Platform": "3",
            "X-Manga-Hash": this.signature(params),
        }
    }

    async apiGet(path, params) {
        params = params || {}
        const qs = Object.keys(params)
            .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(String(params[k])))
            .join("&")
        const url = "https://" + MagazinePocket.apiHost + path + (qs ? "?" + qs : "")
        const res = await Network.get(url, this.apiHeaders(params))
        if (res && res.error) throw "マガポケ 网络错误：" + this.errorMessage(res.error)
        if (!res || Number(res.status) !== 200) {
            let msg = ""
            try { msg = String(JSON.parse(String(res.body || "{}")).error_message || "") } catch (e) {}
            throw "マガポケ 请求失败（HTTP " + (res && res.status) + "）" + (msg ? "：" + msg : "")
        }
        return JSON.parse(String(res.body || "{}"))
    }

    async apiPost(path, params, body) {
        params = params || {}
        const url = "https://" + MagazinePocket.apiHost + path
        const res = await Network.post(url, this.apiHeaders(params), body)
        if (res && res.error) throw "マガポケ 网络错误：" + this.errorMessage(res.error)
        if (!res || Number(res.status) !== 200) throw "マガポケ 请求失败（HTTP " + (res && res.status) + "）"
        return JSON.parse(String(res.body || "{}"))
    }

    errorMessage(e) { return String((e && (e.message || e)) || e) }

    absoluteUrl(u) {
        const s = String(u || "").trim()
        if (!s) return ""
        if (/^https?:\/\//i.test(s)) return s
        return MagazinePocket.webSite + (s.charAt(0) === "/" ? "" : "/") + s
    }

    // ---------------- 列表 ----------------
    toComics(json) {
        const list = (json && (json.title_list || json.search_title_list || json.ranking_title_list)) || []
        const out = []
        list.forEach((t) => {
            if (!t || t.title_id === undefined || t.title_id === null) return
            const cover = t.thumbnail_image_url || t.banner_image_url || t.thumbnail_rect_image_url || ""
            out.push(new Comic({
                id: String(t.title_id),
                title: String(t.title_name || ""),
                cover: cover ? this.absoluteUrl(cover) : "",
                subTitle: "",
            }))
        })
        return out
    }

    async loadRanking(rankingId, page) {
        const p = Math.max(1, page)
        const first = await this.apiGet("/ranking/all", {
            ranking_id: String(rankingId),
            offset: String((p - 1) * 25),
            limit: "26",
        })
        const raw = (first && (first.ranking_title_list || first.title_list)) || []
        // 排行榜条目用的是 id 字段（详情列表用的是 title_id）
        const ids = raw
            .map((x) => {
                if (!x) return null
                const v = x.title_id !== undefined && x.title_id !== null ? x.title_id : x.id
                return v === undefined || v === null ? null : String(v)
            })
            .filter(Boolean)
        if (ids.length === 0) return { comics: [], maxPage: p }
        const hasNext = ids.length > 25
        const detail = await this.apiGet("/title/list", { title_id_list: ids.slice(0, 25).join(",") })
        return { comics: this.toComics(detail), maxPage: hasNext ? p + 1 : p }
    }

    explore = [
        {
            title: "ランキング 排行榜",
            type: "multiPageComicList",
            load: async (page) => await this.loadRanking("30", page),
        },
        {
            title: "最新更新",
            type: "multiPageComicList",
            load: async (page) => ({
                comics: this.toComics(await this.apiGet("/web/title/weekly", {})),
                maxPage: 1,
            }),
        },
    ]

    category = {
        title: "マガポケ",
        parts: [
            {
                name: "ランキング",
                type: "fixed",
                categories: MagazinePocket.rankCats.map((g) => g[1]),
                categoryParams: MagazinePocket.rankCats.map((g) => "r:" + g[0]),
                itemType: "category",
            },
            {
                name: "ジャンル",
                type: "fixed",
                categories: MagazinePocket.genreCats.map((g) => g[1]),
                categoryParams: MagazinePocket.genreCats.map((g) => "g:" + g[0]),
                itemType: "category",
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => {
            const p = String(param || "")
            if (p.indexOf("r:") === 0) return await this.loadRanking(p.slice(2), page)
            const gid = p.indexOf("g:") === 0 ? p.slice(2) : p
            return {
                comics: this.toComics(await this.apiGet("/search/title", { genre_id: gid, limit: "99999" })),
                maxPage: 1,
            }
        },
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.toComics(
                await this.apiGet("/web/search/title", { keyword: String(keyword || "").trim(), limit: "99999" })
            ),
            maxPage: 1,
        }),
    }

    // ---------------- 详情 / 章节 / 图片 ----------------
    comic = {
        idMatch: "https?://[^/]*pocket\\.shonenmagazine\\.com/title/(\\d+)",
        link: {
            domains: ["pocket.shonenmagazine.com"],
            linkToId: (url) => {
                const m = String(url || "").match(/\/title\/(\d+)/)
                return m ? m[1] : null
            },
        },

        loadInfo: async (id) => {
            const titleId = String(id)
            const detail = await this.apiGet("/title/list", { title_id_list: titleId })
            const t = ((detail && detail.title_list) || [])[0] || {}

            const title = String(t.title_name || "")
            const cover = t.thumbnail_image_url || t.banner_image_url || t.thumbnail_rect_image_url || ""
            const author = String(t.author_text || "")
            const desc = String(t.introduction_text || t.short_introduction_text || "")

            const epIds = (t.episode_id_list || []).map((x) => String(x))
            const chapters = new Map()
            if (epIds.length > 0) {
                const body = "episode_id_list=" + encodeURIComponent(epIds.join(","))
                const res = await this.apiPost("/episode/list", { episode_id_list: epIds.join(",") }, body)
                const eps = (res && res.episode_list) || []
                // 站点返回「第1話 → 最新」，正是需要的顺序，不反转
                eps.forEach((e) => {
                    const eid = String(e.episode_id)
                    const point = Number(e.point || 0)
                    const badge = Number(e.badge || 0)
                    const rental = e.rental_finish_time
                    const locked = point > 0 && badge !== 3 && !rental
                    chapters.set(eid, (locked ? "🔒 " : "") + String(e.episode_name || eid))
                })
            }

            const tags = author
                ? { "作者": author.split("/").map((x) => x.trim()).filter(Boolean) }
                : {}

            return new ComicDetails({
                title: title,
                cover: this.absoluteUrl(cover),
                description: desc,
                tags: tags,
                chapters: chapters,
                url: MagazinePocket.webSite + "/title/" + titleId,
            })
        },

        loadEp: async (comicId, epId) => {
            const d = await this.apiGet("/web/episode/viewer", { episode_id: String(epId) })
            const pages = (d && d.page_list) || []
            if (pages.length === 0) throw "マガポケ 章节无图片（可能需租借/购买）"
            this.saveData("ep:" + String(epId), [d.scramble_seed, d.title_id, d.episode_id].join(":"))
            return { images: pages.map((u) => this.absoluteUrl(u)) }
        },

        onImageLoad: (url, comicId, epId) => {
            const raw = this.loadData("ep:" + String(epId))
            const headers = { "User-Agent": MagazinePocket.ua, "Referer": MagazinePocket.webSite + "/" }
            if (!raw) return { headers: headers }
            const parts = String(raw).split(":")
            const perm = this.unscramblePerm(parts[0], Number(parts[1]), Number(parts[2]))
            return { headers: headers, modifyImage: this.buildModifyScript(perm) }
        },

        // 与 Kotlin ImageInterceptor 完全一致（已实测：还原后画面正常）
        unscramblePerm(seed, titleId, episodeId) {
            const EVEN = "svdk0m7acl"
            const ODD = "q6jtf2xnog"
            const cs = titleId % 2 === 0 ? EVEN : ODD
            let parsed = 0
            const s0 = String(seed || "")
            for (let i = 0; i < s0.length; i++) {
                const idx = cs.indexOf(s0.charAt(i))
                if (idx < 0) break
                parsed = parsed * 10 + idx
            }
            let s = (parsed >>> 0) ^ ((titleId + episodeId) >>> 0)
            const pairs = []
            for (let i = 0; i < 16; i++) {
                s ^= s << 13; s >>>= 0
                s ^= s >>> 17; s >>>= 0
                s ^= s << 5; s >>>= 0
                pairs.push([s >>> 0, i])
            }
            pairs.sort((a, b) => a[0] - b[0])
            return pairs.map((p) => p[1])
        },

        buildModifyScript(perm) {
            const arr = "[" + perm.join(",") + "]"
            return [
                "let modifyImage = (image) => {",
                "    const perm = " + arr,
                "    const D = 4, M = 8",
                "    const w = image.width, h = image.height",
                "    const bw = Math.floor(w / (D * M)) * M",
                "    const bh = Math.floor(h / (D * M)) * M",
                "    let res = Image.empty(w, h)",
                "    for (let i = 0; i < 16; i++) {",
                "        const e = perm[i]",
                "        const sx = (e % D) * bw, sy = Math.floor(e / D) * bh",
                "        const dx = (i % D) * bw, dy = Math.floor(i / D) * bh",
                "        res.fillImageRangeAt(dx, dy, image, sx, sy, bw, bh)",
                "    }",
                "    const pw = bw * D, ph = bh * D",
                "    if (w > pw) res.fillImageRangeAt(pw, 0, image, pw, 0, w - pw, h)",
                "    if (h > ph) res.fillImageRangeAt(0, ph, image, 0, ph, pw, h - ph)",
                "    return res",
                "}",
            ].join("\n")
        },
    }

    translation = {
        'zh_CN': {
            "30": "全部",
            "2": "必看推荐",
            "1": "原创",
            "31": "新作",
            "21": "动作",
            "22": "运动",
            "23": "恋爱",
            "24": "异世界",
            "25": "悬疑",
            "26": "黑道·不良",
            "27": "剧情",
            "28": "奇幻",
            "29": "日常",
            "1": "恋爱·爱情喜剧",
            "2": "恐怖·悬疑",
            "3": "搞笑·喜剧·日常",
            "4": "科幻·奇幻",
            "5": "运动",
            "6": "人文剧情",
            "7": "黑社会·安格拉·不良",
            "8": "动作·战斗",
            "9": "异世界·异能",
            "10": "读切",
            "11": "MGP",
            "ランキング": "排行榜",
            "ジャンル": "题材",
            "ランキング 排行榜": "排行榜",
            "最新更新": "最新更新"
        },
        'zh_TW': {
            "30": "全部",
            "2": "必看推荐",
            "1": "原创",
            "31": "新作",
            "21": "动作",
            "22": "运动",
            "23": "恋爱",
            "24": "异世界",
            "25": "悬疑",
            "26": "黑道·不良",
            "27": "剧情",
            "28": "奇幻",
            "29": "日常",
            "1": "恋爱·爱情喜剧",
            "2": "恐怖·悬疑",
            "3": "搞笑·喜剧·日常",
            "4": "科幻·奇幻",
            "5": "运动",
            "6": "人文剧情",
            "7": "黑社会·安格拉·不良",
            "8": "动作·战斗",
            "9": "异世界·异能",
            "10": "读切",
            "11": "MGP",
            "ランキング": "排行榜",
            "ジャンル": "题材",
            "ランキング 排行榜": "排行榜",
            "最新更新": "最新更新"
        },
    }
}
