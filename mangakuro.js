// MangaKuro（mangakuro.net）— Venera 漫画源
// 站点：自建 HTML + AJAX 图片接口（无加密）
// 接口/选择器依据：Keiyoushi 扩展 MangaKuro.kt，并已逐项实测
class MangaKuro extends ComicSource {
    name = "MangaKuro"
    key = "mangakuro"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/mangakuro.js"

    // 题材表：[slug, 显示名]，取自站点 /genres 页（150 个，实测）
    static genres = [
        ["-BL-", "bl"],
        ["-SF-", "sf"],
        ["Ecchi", "ecchi"],
        ["SF・ファンタジー", "sf-fantaji"],
        ["SMARTOON", "smartoon"],
        ["Uncategorized", "uncategorized"],
        ["Uncategory", "uncategory"],
        ["お嬢様", "o-niang-yang"],
        ["くらし・生活", "kurashi-sheng-huo"],
        ["じょうせい", "jousei"],
        ["なろう系", "narou-xi"],
        ["ほのぼの・癒し", "honobono-yushi"],
        ["やおい", "yaoi"],
        ["アクション", "akushon"],
        ["アクション・アドベンチャー", "akushon-adobencha"],
        ["アスリート", "asurito"],
        ["アダルト", "adaruto"],
        ["アドベンチャー", "adobencha"],
        ["アニメ化", "anime-hua"],
        ["エッチ", "etchi"],
        ["エロ", "ero"],
        ["オフィス", "ofisu"],
        ["ギャグ", "gyagu"],
        ["ギャグ・コメディ", "gyagu-komedi"],
        ["グルメ", "gurume"],
        ["ゲーム世界", "gemu-shi-jie"],
        ["コメディ", "komedi"],
        ["サスペンス", "sasupensu"],
        ["サスペンス・ミステリー", "sasupensu-misuteri"],
        ["サッカー", "sakka"],
        ["サバイバル", "sabaibaru"],
        ["サラリーマン", "sarariman"],
        ["ジェンダーベンダー", "jendabenda"],
        ["スクールライフ", "sukururaifu"],
        ["スポーツ", "supotsu"],
        ["スライスオブライフ", "suraisuoburaifu"],
        ["タイムスリップ", "taimusurippu"],
        ["チート能力", "chito-neng-li"],
        ["ドラマ", "dorama"],
        ["ドラマ化", "dorama-hua"],
        ["ハーレム", "haremu"],
        ["バイオレンス", "baiorensu"],
        ["バトル", "batoru"],
        ["ヒューマンドラマ", "hyumandorama"],
        ["ヒーロー", "hiro"],
        ["ファンタジー", "fantaji"],
        ["フルカラー", "furukara"],
        ["フロースコミック", "furosukomikku"],
        ["ホラー", "hora"],
        ["マガジンポケット", "magajinpoketto"],
        ["マンガUP！", "mangaup"],
        ["ミステリー", "misuteri"],
        ["メディア化", "media-hua"],
        ["モンスター", "monsuta"],
        ["ラブコメ", "rabukome"],
        ["ラブコメコメ", "rabukomekome"],
        ["ロボット", "robotto"],
        ["ロマス", "romasu"],
        ["ロマンス", "romansu"],
        ["ロリ", "rori"],
        ["人情", "ren-qing"],
        ["人生のひとこま", "ren-shengnohitokoma"],
        ["人生のスライス", "ren-shengnosuraisu"],
        ["先輩・後輩", "xian-bei-hou-bei"],
        ["冒険", "mao-xian"],
        ["刑事・探偵", "xing-shi-tan-zhen"],
        ["刑事・探偵犯罪", "xing-shi-tan-zhen-fan-zui"],
        ["剣道・剣術", "jian-dao-jian-shu"],
        ["勇者", "yong-zhe"],
        ["動物・ペット", "dong-wu-petto"],
        ["吸血鬼", "xi-xue-gui"],
        ["囲碁・将棋", "tong-qi-jiang-qi"],
        ["大学生", "da-xue-sheng"],
        ["天使", "tian-shi"],
        ["天使・悪魔", "tian-shi-e-mo"],
        ["女性マンガ", "nu-xingmanga"],
        ["奴隷", "nu-li"],
        ["婚約破棄", "hun-yue-po-qi"],
        ["学園", "xue-yuan"],
        ["学園コメディ", "xue-yuankomedi"],
        ["学園モノ", "xue-yuanmono"],
        ["学校生活", "xue-xiao-sheng-huo"],
        ["家族", "jia-zu"],
        ["少女", "shao-nu"],
        ["少女マンガ", "shao-numanga"],
        ["少女愛", "shao-nu-ai"],
        ["少年", "shao-nian"],
        ["少年マンガ", "shao-nianmanga"],
        ["少年愛", "shao-nian-ai"],
        ["年の差", "nianno-cha"],
        ["幼馴染", "you-xun-ran"],
        ["幼馴染・同級生", "you-xun-ran-tong-ji-sheng"],
        ["幽霊・妖怪・モンスター", "you-ling-yao-guai-monsuta"],
        ["心理戦", "xin-li-zhan"],
        ["心理的", "xin-li-de"],
        ["恋愛", "lian-ai"],
        ["恋愛ファンタジー", "lian-aifantaji"],
        ["悪魔", "e-mo"],
        ["悲劇", "bei-ju"],
        ["感動", "gan-dong"],
        ["成熟した", "cheng-shushita"],
        ["料理", "liao-li"],
        ["日常", "ri-chang"],
        ["映画化", "ying-hua-hua"],
        ["更新中", "geng-xin-zhong"],
        ["格闘技", "ge-dou-ji"],
        ["武侠", "wu-xia"],
        ["武道", "wu-dao"],
        ["歴史", "li-shi"],
        ["歴史・時代", "li-shi-shi-dai"],
        ["歴史・時代劇", "li-shi-shi-dai-ju"],
        ["歴史的", "li-shi-de"],
        ["死に戻り", "sini-tiri"],
        ["汚い", "wui"],
        ["江戸時代", "jiang-hu-shi-dai"],
        ["漫画・アニメ", "man-hua-anime"],
        ["犯罪", "fan-zui"],
        ["独占配信", "du-zhan-pei-xin"],
        ["王女・姫", "wang-nu-ji"],
        ["王様・貴族", "wang-yang-gui-zu"],
        ["男性向け", "nan-xing-xiangke"],
        ["異世界", "yi-shi-jie"],
        ["異世界マンガ", "yi-shi-jiemanga"],
        ["異種族", "yi-zhong-zu"],
        ["異能力", "yi-neng-li"],
        ["百合", "bai-he"],
        ["神秘", "shen-mi"],
        ["競輪・自転車", "jing-lun-zi-zhuan-che"],
        ["結婚", "jie-hun"],
        ["美少女", "mei-shao-nu"],
        ["聖女", "sheng-nu"],
        ["職業・ビジネス", "zhi-ye-bijinesu"],
        ["芸術", "yun-shu"],
        ["裏稼業", "li-jia-ye"],
        ["貴族・大富豪", "gui-zu-da-fu-hao"],
        ["超能力", "chao-neng-li"],
        ["超自然", "chao-zi-ran"],
        ["超自然的", "chao-zi-ran-de"],
        ["超自然的な", "chao-zi-ran-dena"],
        ["転生", "zhuan-sheng"],
        ["農業", "nong-ye"],
        ["野球", "ye-qiu"],
        ["錬金術", "lian-jin-shu"],
        ["長編", "zhang-bian"],
        ["青年", "qing-nian"],
        ["青年マンガ", "qing-nianmanga"],
        ["音楽", "yin-le"],
        ["高校生", "gao-xiao-sheng"],
        ["魔女", "mo-nu"],
        ["魔法", "mo-fa"]
    ]

    static defaultBaseUrl = "mangakuro.net"
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: MangaKuro.defaultBaseUrl,
        },
    }

    get baseUrl() {
        const saved = this.loadSetting("base_url")
        const v = String(saved || MangaKuro.defaultBaseUrl).trim()
            .replace(/^https?:\/\//i, "").replace(/\/+$/, "")
        return `https://${v}`
    }

    get headers() {
        return {
            "User-Agent": MangaKuro.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en;q=0.9",
            "Referer": `${this.baseUrl}/`,
        }
    }

    get ajaxHeaders() {
        return {
            "User-Agent": MangaKuro.ua,
            "Accept": "application/json,text/html,*/*;q=0.8",
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

    async getHtml(path, headers) {
        const res = await Network.get(this.absoluteUrl(path), headers || this.headers)
        if (res && res.error) throw `MangaKuro 网络错误：${this.errorMessage(res.error)}`
        if (!res || Number(res.status) !== 200) throw `MangaKuro 请求失败（HTTP ${res && res.status}）`
        return String(res.body || "")
    }

    // 列表卡片：div.story_item → div.mg_name a
    parseList(html) {
        const out = []
        const doc = new HtmlDocument(String(html || ""))
        doc.querySelectorAll("div.story_item").forEach((el) => {
            const a = el.querySelector("div.mg_name a") || el.querySelector("a[href*='/manga/']")
            if (!a) return
            const href = this.absoluteUrl(a.attributes["href"])
            if (!/\/manga\//.test(href)) return
            const img = el.querySelector("img")
            const cover = img ? this.absoluteUrl(img.attributes["data-src"] || img.attributes["data-original"] || img.attributes["src"]) : ""
            const title = String(a.text || "").trim()
            if (title) out.push(new Comic({ id: href, title: title, cover: cover, subTitle: "" }))
        })
        return out
    }

    explore = [
        {
            title: "最新更新",
            type: "multiPageComicList",
            load: async (page) => ({
                comics: this.parseList(await this.getHtml(`/all-manga?page=${Math.max(1, page)}&sort=latest-updated`)),
                maxPage: null,
            }),
        },
        {
            title: "热门",
            type: "multiPageComicList",
            load: async (page) => ({
                comics: this.parseList(await this.getHtml(`/all-manga?page=${Math.max(1, page)}&sort=views`)),
                maxPage: null,
            }),
        },
    ]

    category = {
        title: "MangaKuro",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: MangaKuro.genres.map((g) => g[1]),
                categoryParams: MangaKuro.genres.map((g) => g[0]),
                itemType: "category",
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => {
            const slug = String(param || "").trim()
            const url = slug
                ? `/genres/${encodeURIComponent(slug)}?page=${Math.max(1, page)}`
                : `/all-manga?page=${Math.max(1, page)}&sort=latest-updated`
            return { comics: this.parseList(await this.getHtml(url)), maxPage: null }
        },
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => ({
            comics: this.parseList(
                await this.getHtml(`/search?page=${Math.max(1, page)}&keyword=${encodeURIComponent(String(keyword || "").trim())}`)
            ),
            maxPage: null,
        }),
    }

    comic = {
        loadInfo: async (id) => {
            const url = this.absoluteUrl(id)
            const doc = new HtmlDocument(await this.getHtml(url))

            const tEl = doc.querySelector("div.detail_name > h1") || doc.querySelector("h1")
            const title = tEl ? String(tEl.text || "").trim() : ""
            const cEl = doc.querySelector(".detail_avatar img")
            const cover = cEl ? this.absoluteUrl(cEl.attributes["data-src"] || cEl.attributes["src"]) : ""
            const dEl = doc.querySelector(".detail_reviewContent")
            const description = dEl ? String(dEl.text || "").replace(/\s+/g, " ").trim() : ""

            const genres = []
            doc.querySelectorAll("div.detail_listInfo a.genres-el").forEach((e) => {
                const s = String(e.text || "").trim()
                if (s && genres.indexOf(s) < 0) genres.push(s)
            })

            // 章节：div.chapter_box .item → a.chapter_num（站点为最新→最老，反转）
            const arr = []
            doc.querySelectorAll("div.chapter_box .item").forEach((el) => {
                const a = el.querySelector("a.chapter_num")
                if (!a) return
                const href = this.absoluteUrl(a.attributes["href"])
                if (!href || arr.some((x) => x[0] === href)) return
                const name = String(a.text || "").trim().replace(/^#\s*/, "") || href
                arr.push([href, name])
            })
            const chapters = new Map()
            for (let i = arr.length - 1; i >= 0; i--) chapters.set(arr[i][0], arr[i][1])

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
            const chapterUrl = this.absoluteUrl(epId)
            const html = await this.getHtml(chapterUrl)
            const m = String(html).match(/CHAPTER_ID\s*=\s*(\d+)/)
            if (!m) throw "MangaKuro 章节页未找到 CHAPTER_ID"
            const chapterId = m[1]

            const res = await Network.get(
                this.absoluteUrl(`/ajax/image/list/chap/${chapterId}`),
                Object.assign({}, this.ajaxHeaders, { "Referer": chapterUrl })
            )
            if (res && res.error) throw `MangaKuro 图片接口错误：${this.errorMessage(res.error)}`
            if (!res || Number(res.status) !== 200) throw `MangaKuro 图片接口失败（HTTP ${res && res.status}）`

            let payload = null
            try { payload = JSON.parse(String(res.body || "")) } catch (_) { throw "MangaKuro 图片接口返回的不是 JSON" }
            if (!payload || payload.status !== true || !payload.html) throw "MangaKuro 图片接口未返回内容"

            const images = []
            const doc = new HtmlDocument(String(payload.html))
            doc.querySelectorAll("img").forEach((img) => {
                const src = this.absoluteUrl(img.attributes["data-src"] || img.attributes["src"])
                if (src && images.indexOf(src) < 0) images.push(src)
            })
            if (images.length === 0) throw "MangaKuro 章节没有返回正文图片"
            return { images: images }
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: {
                "User-Agent": MangaKuro.ua,
                "Referer": this.absoluteUrl(epId || comicId),
            },
        }),
    }
}
