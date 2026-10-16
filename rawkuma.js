/**
 * Rawkuma（rawkuma.net）Venera 漫画源 v1.0.0
 *
 * 站点：日本生肉（raw）漫画聚合站。百合 Yuri = 122 部，全站 9710 部。
 *
 * ══ 今天在本机逐条实测过的行为（2026-10，node 原生 fetch） ══════════════════
 *
 * 0) 必须带浏览器 UA：裸请求被 Cloudflare 403，带上 UA 一律 200。
 *    本机 /wp-json/wp/v2/* 带 UA 也是 200（无 UA 才是 403）。
 *
 * 1) 列表路径 A —— 站点自己的 htmx 接口（本源的列表主路径）
 *    POST /wp-admin/admin-ajax.php?action=advanced_search
 *    表单：nonce / page / orderby / order / genre(JSON 数组) / type / status / query
 *    nonce：GET /wp-admin/admin-ajax.php?type=search_form&action=get_nonce
 *           → 60 字节 `<input type='hidden' name='search_nonce' value='...'>`
 *    实测 orderby=updated / popular 均可用；每页 24 张卡。
 *    返回片段末尾带分页控件：
 *      · 可点页码按钮 onclick="window['addSingularFilter']('page', 'N', this)"
 *      · 当前页按钮无 onclick，class 含 bg-accent
 *      · 「还有下一页」时存在右箭头 svg <polyline points="9 18 15 12 9 6">
 *      · 翻过末页 → 146 字节「No results found for your search.」，0 张卡
 *    → 据此推 maxPage：有右箭头则末页未知（null）；否则取控件内最大页码。
 *    ⚠ 实测 query 搜索返回的片段【不带分页控件】，且第 2 页起为空
 *      （站点搜索一次给完，如 "yuri" 23 条 / "百合" 16 条）。
 *      所以搜索不用它做主路径，只做兜底。
 *
 * 2) 列表路径 B —— WordPress REST（分类兜底 + 搜索主路径）
 *    GET /wp-json/wp/v2/manga?genre=<整数TermID>&search=<kw>&per_page=24&page=N
 *    · 响应头 X-WP-Total / X-WP-TotalPages 给出精确总页数
 *      （Yuri：total=122 / pages=6；search=yuri：total=82 / pages=4）
 *    · 翻过末页 → 400 {"code":"rest_post_invalid_page_number"}
 *    · 封面在 meta.meta.thumbnail（★ 两层 meta，不是 meta.thumbnail）
 *    · genre 只吃整数 TermID，传 slug 会 400；Yuri=626
 *    · 实测 _fields=id,link,title,meta 仍会带回 24/24 个封面
 *    GET /wp-json/wp/v2/genre?per_page=100 → 48 个题材的 id/slug/name/count
 *    ⚠ 个别 slug 是百分号编码的（如日文标题），一律用 link 字段，不要自己拼 slug。
 *
 * 3) 详情页 GET /manga/<slug>/（约 930KB）
 *      h1[itemprop="name"]                     标题
 *      [itemprop="image"] img.wp-post-image    封面
 *      [itemprop="description"]（取最后一个）    简介
 *      a[itemprop="genre"]                     题材（站点给英文名）
 *      #chapter-list 下的章节链接
 *    ⚠ 陷阱 1：#chapter-list 里混着官方 raw 打包下载的 Google Drive 外链。
 *      Seishokuki 实测 192 个章节 href，但 #chapter-list 下共 378 个 /chapter- 锚点、
 *      另有 186 个 drive.google.com「Download」锚点。
 *      → 必须用 a[href*="/chapter-"] 过滤，否则章节表被污染（末条会变成 Download）。
 *    ⚠ 陷阱 2：同一章节的 href 会出现多次，需按 href 去重，并遍历全部同名锚点
 *      找带 <span>Chapter N</span> 的那个（有的锚点只有缩略图、没有文字）。
 *    ⚠ 章节顺序为「新 → 旧」，首项是最新章（本机保留站点原序）。
 *
 * 4) 章节页图片 HTML 直出，两个 CDN 实测均可下载（无需 Referer，无需 cookie）：
 *      https://kuma.kyut.dev/wp-content/kuma_B/s/<slug>-raw/<num>/<n>.jpg   新章
 *      https://cdn.rawkuma.com/s/<slug>/chapter-<num>/<n>.jpg               旧章
 *    ⚠ 旧章的 src 用【单引号】：<img src='https://cdn.rawkuma.com/...'>，
 *      解析必须容错（jsdom 可以，正则兜底也已覆盖）。
 *    正文容器：<section data-image-data="1">，正文 img 全在其中。
 *    实测：yuri 最新更新前 10 部，各取「最新章 + 最早章」共 20 个章节页，
 *    图片数 11~77 张，全部 200，第一张实测 image/jpeg 336~359KB（magic ffd8ffe0）。
 *
 * 5) /premium/ 上没有任何漫画链接，只是订阅说明页；
 *    章节页里出现的 "Login to unlock more features" 是导航栏登录提示，不是付费墙。
 *    → 实测未发现任何被锁章节。
 */
class Rawkuma extends ComicSource {
    name = "Rawkuma 生肉"
    key = "rawkuma"
    version = "1.0.0"
    minAppVersion = "1.0.0"
    url = "https://cdn.jsdelivr.net/gh/yuyuyu529/venera@main/rawkuma.js";

    /* ───────────────────────── 常量 ───────────────────────── */

    static UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    static DEFAULT_HOST = "rawkuma.net"
    static AJAX = "/wp-admin/admin-ajax.php"
    static PER_PAGE = 24
    // 分页控件里「还有下一页」的右箭头 svg 特征串
    static NEXT_CHEVRON = 'polyline points="9 18 15 12 9 6"'
    // 站点题材表 [slug, WordPress term_id, 中文名, 站点英文名]
    // 实测自 GET /wp-json/wp/v2/genre?per_page=100（48 个）
    static GENRES = [
        ["yuri", 626, "百合", "Yuri"],
        ["shoujo-ai", 328, "少女爱", "Shoujo Ai"],
        ["girls-love", 14375, "GL百合", "Girls' Love"],
        ["action", 2, "动作", "Action"],
        ["adaptions", 5114, "改编", "Adaptions"],
        ["adult", 67, "成人", "Adult"],
        ["adventure", 3, "冒险", "Adventure"],
        ["animals", 14890, "动物", "Animals"],
        ["comedy", 4, "搞笑", "Comedy"],
        ["crime", 13850, "犯罪", "Crime"],
        ["demons", 5113, "恶魔", "Demons"],
        ["drama", 5, "剧情", "Drama"],
        ["ecchi", 31, "擦边", "Ecchi"],
        ["fantasy", 6, "奇幻", "Fantasy"],
        ["game", 1866, "游戏", "Game"],
        ["gender-bender", 100, "性转换", "Gender Bender"],
        ["harem", 48, "后宫", "Harem"],
        ["hentai", 5561, "里番", "Hentai"],
        ["historical", 105, "历史", "Historical"],
        ["horror", 54, "恐怖", "Horror"],
        ["isekai", 5110, "异世界", "isekai"],
        ["josei", 357, "女性向", "Josei"],
        ["lolicon", 603, "萝莉", "Lolicon"],
        ["magic", 5111, "魔法", "magic"],
        ["martial-arts", 106, "格斗", "Martial Arts"],
        ["mature", 23, "成人向", "Mature"],
        ["mecha", 35, "机战", "Mecha"],
        ["mystery", 24, "悬疑", "Mystery"],
        ["oneshot", 17691, "短篇", "Oneshot"],
        ["philosophical", 15090, "哲理", "Philosophical"],
        ["police", 13851, "警察", "Police"],
        ["psychological", 25, "心理", "Psychological"],
        ["romance", 42, "恋爱", "Romance"],
        ["school-life", 15, "校园", "School Life"],
        ["sci-fi", 16, "科幻", "Sci-fi"],
        ["seinen", 32, "青年", "Seinen"],
        ["shotacon", 706, "正太", "Shotacon"],
        ["shoujo", 113, "少女", "Shoujo"],
        ["shounen", 7, "少年", "Shounen"],
        ["shounen-ai", 175, "少年爱", "Shounen Ai"],
        ["slice-of-life", 43, "日常", "Slice of Life"],
        ["smut", 1402, "情色", "Smut"],
        ["sports", 143, "运动", "Sports"],
        ["supernatural", 12, "超自然", "Supernatural"],
        ["thriller", 13821, "惊悚", "Thriller"],
        ["thriller-2", 13822, "惊悚2", "Thriller 2"],
        ["tragedy", 26, "悲剧", "Tragedy"],
        ["yaoi", 207, "耽美", "Yaoi"],
    ]
    // 站点排序值（advanced_search 的 orderby，实测有效）
    static ORDERS = ["updated", "popular", "rating", "bookmarked", "title"]

    translation = {
        "zh_CN": {
            "Base url": "站点域名",
            "Search": "搜索",
            "Yuri / GL": "百合 / GL",
            "All genres": "全部题材",
            "Sort by": "排序",
            "Latest": "最新更新",
            "Popular": "人气",
            "Rating": "评分",
            "Bookmarks": "收藏数",
            "Title": "标题",
        },
        "zh_TW": {
            "Base url": "站點域名",
            "Search": "搜尋",
            "Yuri / GL": "百合 / GL",
            "All genres": "全部題材",
            "Sort by": "排序",
        },
    }

    settings = {
        base_url: {
            title: "Base url",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Rawkuma.DEFAULT_HOST,
        },
    }

    /* ───────────────────── 实例状态与基础工具 ───────────────────── */

    _host = ""
    _nonce = ""

    init() {
        const saved = String(this.loadSetting("base_url") || "").trim();
        const host = saved.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
        this._host = host || Rawkuma.DEFAULT_HOST;
        this._nonce = "";
    }

    get host() {
        if (!this._host) this.init();
        return this._host || Rawkuma.DEFAULT_HOST;
    }

    get baseUrl() {
        return "https://" + this.host;
    }

    get webHeaders() {
        return {
            "User-Agent": Rawkuma.UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
            "Referer": this.baseUrl + "/",
        };
    }

    get ajaxHeaders() {
        return {
            "User-Agent": Rawkuma.UA,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": this.baseUrl + "/library/",
        };
    }

    get jsonHeaders() {
        return {
            "User-Agent": Rawkuma.UA,
            "Accept": "application/json, */*;q=0.1",
            "Accept-Language": "en-US,en;q=0.9",
        };
    }

    abs(url) {
        const raw = String(url == null ? "" : url).trim();
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.slice(0, 2) === "//") return "https:" + raw;
        if (raw.charAt(0) === "/") return this.baseUrl + raw;
        return this.baseUrl + "/" + raw;
    }

    /** 规范化成漫画详情页 URL；不是漫画页就返回 ""（顺带当过滤器用）。 */
    mangaUrl(url) {
        const u = this.abs(url);
        if (!u) return "";
        const m = u.match(/^(https?:\/\/[^\/]+\/manga\/[^\/?#]+)/i);
        if (!m) return "";
        return m[1] + "/";
    }

    errorText(e) {
        if (e == null) return "未知错误";
        if (typeof e === "string") return e;
        if (e.message) return String(e.message);
        return String(e);
    }

    headerValue(headers, name) {
        if (!headers) return "";
        const want = String(name).toLowerCase();
        const keys = Object.keys(headers);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].toLowerCase() === want) return headers[keys[i]];
        }
        return "";
    }

    /** 在题材表里按 slug / 中文名 / 站点英文名 / term_id 查找。 */
    static findGenre(value) {
        const v = String(value == null ? "" : value).trim();
        if (!v) return null;
        const low = v.toLowerCase();
        const rows = Rawkuma.GENRES;
        for (let i = 0; i < rows.length; i++) {
            const g = rows[i];
            if (String(g[1]) === v) return g;
            if (g[0].toLowerCase() === low) return g;
            if (g[2] === v) return g;
            if (g[3].toLowerCase() === low) return g;
        }
        return null;
    }

    /** 英文题材名 → 中文显示名（查不到就原样保留）。 */
    static genreLabel(value) {
        const g = Rawkuma.findGenre(value);
        return g ? g[2] : String(value == null ? "" : value).trim();
    }

    static genreCategory(slug) {
        const g = Rawkuma.findGenre(slug);
        if (!g) {
            return {
                label: String(slug),
                target: { page: "category", attributes: { category: slug, param: slug } },
            };
        }
        return {
            label: g[2] + "（" + g[3] + "）",
            target: { page: "category", attributes: { category: g[0], param: g[0] } },
        };
    }

    /* ───────────────────── 路径 A：htmx advanced_search ───────────────────── */

    async getNonce(force) {
        if (!force && this._nonce) return this._nonce;
        let res = null;
        try {
            res = await Network.get(
                `${this.baseUrl}${Rawkuma.AJAX}?type=search_form&action=get_nonce`,
                this.webHeaders
            );
        } catch (e) {
            throw `Rawkuma 取 nonce 失败：${this.errorText(e)}`;
        }
        if (!res || Number(res.status) !== 200) {
            throw `Rawkuma 取 nonce 失败（HTTP ${res && res.status}）`;
        }
        const body = String(res.body || "");
        const m =
            body.match(/name=['"]search_nonce['"][^>]*value=['"]([^'"]+)['"]/i) ||
            body.match(/value=['"]([^'"]+)['"][^>]*name=['"]search_nonce['"]/i);
        if (!m || !m[1]) throw "Rawkuma 取 nonce 失败（响应里找不到 search_nonce）";
        this._nonce = m[1];
        return this._nonce;
    }

    async ajaxSearch(params) {
        const build = (nonce) => {
            const f = [
                "nonce=" + encodeURIComponent(nonce || ""),
                "page=" + Math.max(1, parseInt(params.page, 10) || 1),
                "orderby=" + encodeURIComponent(params.orderby || "updated"),
                "order=" + (params.order === "asc" ? "asc" : "desc"),
                "inclusion=OR",
                "exclusion=OR",
            ];
            if (params.genre && params.genre.length) {
                f.push("genre=" + encodeURIComponent(JSON.stringify(params.genre)));
            }
            if (params.type && params.type.length) {
                f.push("type=" + encodeURIComponent(JSON.stringify(params.type)));
            }
            if (params.status && params.status.length) {
                f.push("status=" + encodeURIComponent(JSON.stringify(params.status)));
            }
            const q = String(params.query || "").trim();
            if (q) f.push("query=" + encodeURIComponent(q));
            return f.join("&");
        };
        const send = async (form) => {
            let res = null;
            try {
                res = await Network.post(
                    `${this.baseUrl}${Rawkuma.AJAX}?action=advanced_search`,
                    this.ajaxHeaders,
                    form
                );
            } catch (e) {
                throw `Rawkuma 列表请求失败：${this.errorText(e)}`;
            }
            if (!res || Number(res.status) !== 200) {
                throw `Rawkuma 列表请求失败（HTTP ${res && res.status}）`;
            }
            return String(res.body || "");
        };

        let nonce = await this.getNonce(false);
        let body = await send(build(nonce));
        const t = body.trim();
        // WP 访客 nonce 会过期：清缓存重取一次再试
        if (t === "" || t === "-1" || t === "0" || /invalid nonce|nonce.*expir/i.test(t)) {
            this._nonce = "";
            nonce = await this.getNonce(true);
            body = await send(build(nonce));
        }
        return body;
    }

    /** 解析 advanced_search 片段里的漫画卡（按 URL 去重，封面/标题取第一条非空）。 */
    parseAjaxCards(html) {
        const out = [];
        const map = {};
        let doc = null;
        try {
            doc = new HtmlDocument(String(html || ""));
        } catch (_) {
            return out;
        }
        doc.querySelectorAll('a[href*="/manga/"]').forEach((a) => {
            const id = this.mangaUrl(a.attributes["href"]);
            if (!id) return; // 章节链接在这里被过滤掉
            let rec = map[id];
            if (!rec) {
                rec = map[id] = { id: id, title: "", cover: "" };
                out.push(rec);
            }
            const img = a.querySelector("img.wp-post-image") || a.querySelector("img");
            if (img) {
                const alt = String(img.attributes["alt"] || "").trim();
                const src = this.abs(img.attributes["src"] || img.attributes["data-src"]);
                if (alt && !rec.title) rec.title = alt;
                if (src && !rec.cover) rec.cover = src;
            }
            if (!rec.title) {
                const txt = String(a.text == null ? "" : a.text).replace(/\s+/g, " ").trim();
                if (txt) rec.title = txt;
            }
        });
        const comics = [];
        for (let i = 0; i < out.length; i++) {
            if (!out[i].title) continue;
            comics.push(new Comic({ id: out[i].id, title: out[i].title, cover: out[i].cover }));
        }
        return comics;
    }

    /** 从分页控件推末页；有右箭头则末页未知（null）。 */
    ajaxMaxPage(html, page, count) {
        const body = String(html || "");
        if (!count) return page; // 空结果：当前页即末页，避免无限翻页
        if (body.indexOf(Rawkuma.NEXT_CHEVRON) >= 0) return null;
        const nums = [page];
        const re = /addSingularFilter'\]\('page',\s*'(\d+)'/g;
        let m;
        while ((m = re.exec(body)) !== null) nums.push(parseInt(m[1], 10));
        const act = body.match(/class="[^"]*bg-accent[^"]*"[^>]*>\s*(\d+)\s*<\/button>/);
        if (act) nums.push(parseInt(act[1], 10));
        let max = page;
        for (let i = 0; i < nums.length; i++) {
            if (nums[i] > max) max = nums[i];
        }
        return max;
    }

    async loadAjaxList(params) {
        const page = Math.max(1, parseInt(params.page, 10) || 1);
        const html = await this.ajaxSearch({
            page: page,
            orderby: params.orderby || "updated",
            order: params.order || "desc",
            genre: params.genre || [],
            query: params.query || "",
        });
        const comics = this.parseAjaxCards(html);
        return { comics: comics, maxPage: this.ajaxMaxPage(html, page, comics.length) };
    }

    /* ───────────────────── 路径 B：WordPress REST ───────────────────── */

    async restManga(options) {
        const page = Math.max(1, parseInt(options.page, 10) || 1);
        const q = [
            "per_page=" + Rawkuma.PER_PAGE,
            "page=" + page,
            "_fields=id,link,title,meta",
        ];
        if (options.genreId) q.push("genre=" + encodeURIComponent(options.genreId));
        if (options.search) q.push("search=" + encodeURIComponent(options.search));
        // REST 没有 popular/rating，降级为按时间；title 原样支持
        q.push("orderby=" + (options.orderby === "title" ? "title" : options.orderby === "updated" ? "modified" : "date"));
        q.push("order=desc");

        let res = null;
        try {
            res = await Network.get(`${this.baseUrl}/wp-json/wp/v2/manga?${q.join("&")}`, this.jsonHeaders);
        } catch (e) {
            throw `Rawkuma REST 请求失败：${this.errorText(e)}`;
        }
        const status = Number(res && res.status);
        if (status === 400) return { comics: [], maxPage: page }; // 翻过末页
        if (status !== 200) throw `Rawkuma REST 请求失败（HTTP ${status}）`;

        let data = null;
        try {
            data = JSON.parse(String(res.body || ""));
        } catch (_) {
            throw "Rawkuma REST 返回的不是 JSON（可能被 Cloudflare 拦了）";
        }
        if (!Array.isArray(data)) throw "Rawkuma REST 返回结构异常";

        const comics = [];
        for (let i = 0; i < data.length; i++) {
            const it = data[i] || {};
            const id = this.mangaUrl(it.link || (it.guid && it.guid.rendered) || "");
            const title = it.title && it.title.rendered ? String(it.title.rendered) : "";
            if (!id || !title) continue;
            const thumb = it.meta && it.meta.meta ? it.meta.meta.thumbnail : "";
            comics.push(new Comic({ id: id, title: title, cover: this.abs(thumb) }));
        }
        const totalPages = parseInt(this.headerValue(res && res.headers, "x-wp-totalpages"), 10);
        const maxPage =
            totalPages > 0 ? totalPages : comics.length < Rawkuma.PER_PAGE ? page : null;
        return { comics: comics, maxPage: maxPage };
    }

    /* ───────────────────────── 页面 ───────────────────────── */

    explore = [
        {
            title: "全站 · 最新更新",
            type: "multiPageComicList",
            load: async (page) => await this.loadAjaxList({ page: page, orderby: "updated" }),
        },
    ]

    category = {
        title: "Rawkuma",
        parts: [
            {
                name: "Yuri / GL",
                type: "fixed",
                categories: [
                    Rawkuma.genreCategory("yuri"),
                    Rawkuma.genreCategory("shoujo-ai"),
                    Rawkuma.genreCategory("girls-love"),
                ],
            },
            {
                name: "All genres",
                type: "fixed",
                categories: Rawkuma.GENRES.map((g) => Rawkuma.genreCategory(g[0])),
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [
            {
                label: "Sort by",
                default: "updated",
                options: [
                    "updated-Latest",
                    "popular-Popular",
                    "rating-Rating",
                    "bookmarked-Bookmarks",
                    "title-Title",
                ],
            },
        ],

        load: async (category, param, options, page) => {
            const raw = String(param || category || "").trim();
            const g = Rawkuma.findGenre(raw);
            const slug = g ? g[0] : raw;

            // 排序值（App 传的是 value 部分）
            const picked = Array.isArray(options) && options.length
                ? String(options[0]).replace(/^"|"$/g, "").split("-")[0].trim()
                : "";
            const orderby = Rawkuma.ORDERS.indexOf(picked) >= 0 ? picked : "updated";

            // 主路径：站点自己的 htmx 列表（有站点原生的 popular/rating 排序）
            try {
                return await this.loadAjaxList({
                    page: page,
                    orderby: orderby,
                    genre: slug ? [slug] : [],
                });
            } catch (e) {
                // 兜底：REST（此时非时间类排序会降级）
                if (!g) throw e;
                return await this.restManga({ page: page, genreId: g[1], orderby: orderby });
            }
        },
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            const kw = String(keyword || "").trim();
            const p = Math.max(1, parseInt(page, 10) || 1);
            if (!kw) return { comics: [], maxPage: 1 };
            // 主路径：REST 搜索（分页精确、命中比 htmx 搜索更全）
            try {
                return await this.restManga({ page: p, search: kw });
            } catch (e) {
                // 兜底：htmx 搜索（站点一次给完，无分页）
                if (p > 1) return { comics: [], maxPage: 1 };
                const html = await this.ajaxSearch({ page: 1, orderby: "popular", query: kw });
                return { comics: this.parseAjaxCards(html), maxPage: 1 };
            }
        },
    }

    comic = {
        enableTagsTranslate: false,

        loadInfo: async (id) => {
            const url = this.mangaUrl(id) || this.abs(id);
            let res = null;
            try {
                res = await Network.get(url, this.webHeaders);
            } catch (e) {
                throw `Rawkuma 详情页请求失败：${this.errorText(e)}`;
            }
            if (!res || Number(res.status) !== 200) {
                throw `Rawkuma 详情页请求失败（HTTP ${res && res.status}）`;
            }
            const doc = new HtmlDocument(String(res.body || ""));

            const h1 = doc.querySelector('h1[itemprop="name"]');
            const title = h1 ? String(h1.text == null ? "" : h1.text).trim() : "";

            const coverEl =
                doc.querySelector('[itemprop="image"] img.wp-post-image') ||
                doc.querySelector("img.wp-post-image");
            const cover = coverEl ? this.abs(coverEl.attributes["src"]) : "";

            const descEls = doc.querySelectorAll('[itemprop="description"]');
            let description = "";
            if (descEls.length) {
                description = String(descEls[descEls.length - 1].text == null ? "" : descEls[descEls.length - 1].text)
                    .replace(/\s+/g, " ")
                    .trim();
            }

            const genres = [];
            doc.querySelectorAll('a[itemprop="genre"]').forEach((a) => {
                const t = String(a.text == null ? "" : a.text).replace(/\s+/g, " ").trim();
                if (!t) return;
                const label = Rawkuma.genreLabel(t);
                if (genres.indexOf(label) < 0) genres.push(label);
            });
            const tags = {};
            if (genres.length) tags["题材"] = genres;

            // 章节：只认 /chapter- 链接（#chapter-list 里还混着 Google Drive 打包下载外链）
            const chapters = {};
            doc.querySelectorAll('#chapter-list a[href*="/chapter-"]').forEach((a) => {
                const href = this.abs(a.attributes["href"]);
                if (!href || chapters[href]) return;
                let name = "";
                const span = a.querySelector("span");
                if (span) name = String(span.text == null ? "" : span.text).replace(/\s+/g, " ").trim();
                if (!name) name = String(a.text == null ? "" : a.text).replace(/\s+/g, " ").trim();
                if (!name) {
                    const m = href.match(/chapter-([^\/]+?)\/?$/);
                    name = m ? "Chapter " + m[1] : href;
                }
                chapters[href] = name;
            });

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                url: url,
            });
        },

        loadEp: async (comicId, epId) => {
            const url = this.abs(epId);
            let res = null;
            try {
                res = await Network.get(
                    url,
                    Object.assign({}, this.webHeaders, {
                        Referer: this.mangaUrl(comicId) || this.baseUrl + "/",
                    })
                );
            } catch (e) {
                throw `Rawkuma 章节页请求失败：${this.errorText(e)}`;
            }
            if (!res || Number(res.status) !== 200) {
                throw `Rawkuma 章节页请求失败（HTTP ${res && res.status}）`;
            }
            const body = String(res.body || "");
            const images = [];
            const push = (u) => {
                const s = this.abs(u);
                if (!s || s.slice(0, 5) === "data:") return;
                if (images.indexOf(s) < 0) images.push(s);
            };

            // 正文容器：<section data-image-data="1">
            let doc = null;
            try {
                doc = new HtmlDocument(body);
            } catch (_) {}
            if (doc) {
                doc.querySelectorAll("[data-image-data] img").forEach((img) => {
                    push(img.attributes["src"] || img.attributes["data-src"] || img.attributes["data-lazy-src"]);
                });
                if (!images.length) {
                    doc.querySelectorAll("img").forEach((img) => {
                        const s = String(img.attributes["src"] || img.attributes["data-src"] || "");
                        if (/kuma\.kyut\.dev|cdn\.rawkuma\.com/i.test(s)) push(s);
                    });
                }
            }
            // 正则兜底：旧章的 src 用单引号 <img src='...'>，且 CDN 域名已知
            if (!images.length) {
                const re = /<img[^>]*?\ssrc=['"]([^'"]+?)['"]/gi;
                let m;
                while ((m = re.exec(body)) !== null) {
                    if (/kuma\.kyut\.dev|cdn\.rawkuma\.com/i.test(m[1])) push(m[1]);
                }
            }
            if (!images.length) {
                const re2 = /['"](https?:\/\/[^'"]*?(?:kuma\.kyut\.dev|cdn\.rawkuma\.com)[^'"]*?\.(?:jpg|jpeg|png|webp|gif))['"]/gi;
                let m2;
                while ((m2 = re2.exec(body)) !== null) push(m2[1]);
            }
            if (!images.length) {
                throw "Rawkuma 章节页没解析到正文图片（章节可能已删除，或站点改版）";
            }
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: {
                "User-Agent": Rawkuma.UA,
                Referer: this.abs(epId) || this.mangaUrl(comicId) || this.baseUrl + "/",
            },
        }),

        onClickTag: (namespace, tag) => {
            const t = String(tag == null ? "" : tag).trim();
            const g = Rawkuma.findGenre(t);
            if (g) {
                return {
                    page: "category",
                    keyword: t,
                    attributes: { category: g[0], param: g[0] },
                };
            }
            return { page: "search", keyword: t, attributes: { keyword: t } };
        },
    }

    link = {
        domains: ["rawkuma.net"],
        linkToId: (url) => this.mangaUrl(url) || null,
    }
}
