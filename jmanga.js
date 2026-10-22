/**
 * jmanga（jmanga.nyc / jmanga.media）Venera 漫画源
 * —— 日语生肉（raw）站，实测有大量商业百合单行本扫图，列表带 JA 语言标记
 *
 * 取证（2026-10 实测）：
 *  1. 列表：/genres/<题材>/?p=N 、/latest-updated/?p=N 、/new-release/?p=N 、/most-viewed/?p=N
 *     卡片 div.flw-item → a.manga-poster[href] / img[data-src]（懒加载，src 是 base64 占位）
 *     / h3.manga-name a 标题 / .fdi-cate a 题材
 *     分页 div.pagination a.page-link（取最大数字）
 *  2. 搜索：/filter/?q=<关键词>&p=N（注意首页的 ?q= 表单其实不出结果）
 *  3. 详情页（.nyc 与 .media 内容一致）：h2.manga-name 标题、.anisc-poster img[data-src] 封面、
 *     div.description 简介（首行是 SEO 关键词，需丢掉）、.fdi-cate a 题材
 *     章节：#ja-chaps li.chapter-item[data-id][data-number] —— **data-id 才是章节 ID**
 *  4. 章节图片（本站不把图放 HTML 里）：
 *     GET /json/chapter?id=<data-id>&mode=vertical
 *     需带 X-Requested-With: XMLHttpRequest 与 Referer
 *     返回 JSON {status:1, html:"<img data-src='...'>..."}，data-src 即图片直链
 *  5. 图片域名在第三方图床，需带 Referer；站点有 Cloudflare + 限速 + 域名轮换
 *     （.nyc / .media / .work / .so / .casa），故提供域名设置项
 */
class Jmanga extends ComicSource {
  name = "jmanga(生肉)";
  key = "jmanga";
  version = "1.0.3";
  minAppVersion = "1.0.0";
  url = "https://gcore.jsdelivr.net/gh/yuyuyu529/venera@main/jmanga.js";

    // 分类名中文翻译（官方 translation 字段）
    translation = {
        'zh_CN': {
            "BLコミック": "BL漫画",
            "TLコミック": "TL漫画",
            "ラブコメ": "恋爱喜剧"
        },
        'zh_TW': {
            "BLコミック": "BL漫画",
            "TLコミック": "TL漫画",
            "ラブコメ": "恋爱喜剧"
        },
    }


  baseUrl = "https://jmanga.nyc";

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
    };
  }

  abs(u) {
    if (!u) return "";
    let s = String(u);
    if (!/^https?:\/\//i.test(s)) {
      s = s.startsWith("//") ? "https:" + s : this.baseUrl + (s.startsWith("/") ? s : "/" + s);
    }
    // ⚠️ 本站的作品 URL 里带**原始日文**（如 /read/百合smで…-raw/）。
    //    这类字符串一旦放进 HTTP 头（Referer 等）就会炸：Node 报
    //    "Cannot convert argument to a ByteString"，Dart 的 http 包同样不接受非 ASCII 头值。
    //    所以统一在 abs() 里百分号编码，保证 id / URL / 头值全是 ASCII。
    try {
      return encodeURI(s);
    } catch (e) {
      return s;
    }
  }

  parseList(html) {
    const doc = new HtmlDocument(html);
    const out = [];
    doc.querySelectorAll(".flw-item").forEach((e) => {
      const a = e.querySelector("a.manga-poster") || e.querySelector(".manga-name a");
      if (!a) return;
      const href = a.attributes["href"];
      if (!href) return;
      const nameEl = e.querySelector(".manga-name a") || e.querySelector(".manga-name") || a;
      const img = e.querySelector("img");
      const cover = img ? this.abs(img.attributes["data-src"] || img.attributes["src"]) : "";
      const tags = e.querySelectorAll(".fdi-cate a").map((x) => (x.text || "").trim()).filter(Boolean);
      out.push(new Comic({ id: this.abs(href), title: (nameEl.text || "").trim(), cover, tags }));
    });
    return out;
  }

  maxPageOf(html) {
    const doc = new HtmlDocument(html);
    let max = 1;
    doc.querySelectorAll(".pagination .page-link").forEach((a) => {
      const n = parseInt((a.text || "").trim(), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max;
  }

  async fetchList(url, referer) {
    const res = await Network.get(url, Object.assign({}, this.headers, referer ? { "Referer": referer } : {}));
    if (res.status !== 200) throw `请求失败: ${res.status}（若被 Cloudflare 拦，请在设置里换域名）`;
    return { comics: this.parseList(res.body), maxPage: this.maxPageOf(res.body) };
  }

  explore = [
    {
      title: "最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        const p = page || 1;
        return await this.fetchList(`${this.baseUrl}/latest-updated/` + (p > 1 ? `?p=${p}` : ""));
      },
    },
  ];

  static genreList = [
    "百合・GL", "ラブコメ", "ラブストーリー", "恋愛", "学園", "ドラマ",
    "ファンタジー", "お色気", "日常系", "女性マンガ", "少女マンガ",
    "青年マンガ", "TLコミック", "BLコミック",
  ];

  category = {
    title: "题材",
    parts: [
      {
        name: "百合 / 女性向",
        type: "fixed",
        categories: [
          { label: "百合・GL", target: { page: "category", attributes: { category: "百合・GL", param: null } } },
          { label: "恋爱", target: { page: "category", attributes: { category: "恋愛", param: null } } },
          { label: "少女漫画", target: { page: "category", attributes: { category: "少女マンガ", param: null } } },
          { label: "女性漫画", target: { page: "category", attributes: { category: "女性マンガ", param: null } } },
          { label: "TLコミック", target: { page: "category", attributes: { category: "TLコミック", param: null } } },
        ],
      },
      {
        name: "其他",
        type: "fixed",
        categories: [
          { label: "ラブコメ", target: { page: "category", attributes: { category: "ラブコメ", param: null } } },
          { label: "学园", target: { page: "category", attributes: { category: "学園", param: null } } },
          { label: "日常系", target: { page: "category", attributes: { category: "日常系", param: null } } },
          { label: "奇幻", target: { page: "category", attributes: { category: "ファンタジー", param: null } } },
          { label: "BLコミック", target: { page: "category", attributes: { category: "BLコミック", param: null } } },
        ],
      },
    ],
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const p = page || 1;
      const url = `${this.baseUrl}/genres/${encodeURIComponent(category)}/` + (p > 1 ? `?p=${p}` : "");
      return await this.fetchList(url);
    },
  };

  // 说明：本站搜索接口（/json/suggest）实测恒返回空，且 /filter/?q= 会忽略关键词，
  // 故不提供 search。找作品请用「百合・GL」分类或分页浏览。

  // 本站没有可用的关键词搜索接口（/json/suggest 实测恒返回空、/filter/?q= 会忽略关键词）。
  // 但 Venera 的解析器会**无条件**读取 search.onTagSuggestionSelected：
  // 源里没有 search 对象时，JS 会抛 TypeError，直接导致整个源导入失败。
  // 所以这里必须保留 search —— 实际做法是在「百合・GL」分类里按标题/题材本地匹配。
  search = {
    load: async (keyword, options, page) => {
      const kw = String(keyword || '').trim().toLowerCase();
      const p = page || 1;
      const res = await this.fetchList(
        `${this.baseUrl}/genres/${encodeURIComponent('百合・GL')}/` + (p > 1 ? `?p=${p}` : '')
      );
      if (!kw) return res;
      const comics = res.comics.filter((c) => {
        const t = String(c.title || '').toLowerCase();
        const tags = (c.tags || []).join(' ').toLowerCase();
        return t.indexOf(kw) >= 0 || tags.indexOf(kw) >= 0;
      });
      return { comics, maxPage: res.maxPage };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = this.abs(id);
      const res = await Network.get(url, Object.assign({}, this.headers, { "Referer": this.baseUrl + "/" }));
      if (res.status !== 200) throw `详情页请求失败: ${res.status}`;
      const doc = new HtmlDocument(res.body);

      const titleEl = doc.querySelector("h2.manga-name") || doc.querySelector("h1");
      const poster = doc.querySelector(".anisc-poster img") || doc.querySelector(".manga-poster img");
      const descEl = doc.querySelector("div.description");

      let description = "";
      if (descEl) {
        // 简介 div 的首行是 SEO 关键词，<br> 之后才是正文
        const parts = String(descEl.innerHTML || descEl.text || "").split(/<br\s*\/?>/i);
        const body = parts.length > 1 ? parts.slice(1).join("\n") : parts[0];
        description = body.replace(/<[^>]*>/g, " ").replace(/[ \t]+/g, " ").trim();
        if (!description) description = (descEl.text || "").trim();
      }

      const tags = {};
      const tagNames = doc.querySelectorAll(".anisc-detail .genres a").map((a) => (a.text || "").trim()).filter(Boolean);
      if (tagNames.length) tags["题材"] = Array.from(new Set(tagNames));

      // 章节：#ja-chaps li[data-id]（data-id 是章节 ID，不是 URL）
      let lis = doc.querySelectorAll("#ja-chaps li.chapter-item");
      if (!lis.length) lis = doc.querySelectorAll(".lang-chapters li.chapter-item");
      const chapters = {};
      lis.forEach((li) => {
        const cid = li.attributes["data-id"];
        if (!cid) return;
        const a = li.querySelector("a.item-link") || li.querySelector("a");
        let t = a && a.attributes["title"] ? a.attributes["title"] : "";
        const nameEl = li.querySelector("span.name");
        if (nameEl && (nameEl.text || "").trim()) t = (nameEl.text || "").trim();
        const num = li.attributes["data-number"];
        if (!t && num) t = "第" + num + "話";
        chapters[String(cid)] = t || String(cid);
      });

      return new ComicDetails({
        title: titleEl ? (titleEl.text || "").trim() : "",
        cover: poster ? this.abs(poster.attributes["data-src"] || poster.attributes["src"]) : "",
        description,
        tags,
        chapters: Object.fromEntries(Object.entries(chapters).reverse()),
        url,
      });
    },

    loadEp: async (comicId, epId) => {
      const api = `${this.baseUrl}/json/chapter?id=${encodeURIComponent(epId)}&mode=vertical`;
      const res = await Network.get(api, {
        ...this.headers,
        "X-Requested-With": "XMLHttpRequest",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Referer": this.abs(comicId),
      });
      if (res.status !== 200) throw `章节接口请求失败: ${res.status}`;
      let json;
      try {
        json = JSON.parse(res.body);
      } catch (e) {
        throw "章节接口返回非 JSON（可能被 Cloudflare 拦或触发限速）";
      }
      if (!json || json.status != 1 || !json.html) throw "章节接口未返回内容（可能触发限速，稍后重试）";
      const images = [];
      const re = /data-src=['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(json.html)) !== null) {
        const u = m[1];
        if (!u || u.indexOf("no-thumb") >= 0 || u.startsWith("data:")) continue;
        images.push(this.abs(u));
      }
      if (!images.length) throw "未解析到任何图片";
      return { images };
    },

    onImageLoad: (url) => {
      return { headers: { "Referer": this.baseUrl + "/", "User-Agent": this.headers["User-Agent"] } };
    },

    onClickTag: (namespace, tag) => {
      return { page: "search", attributes: { keyword: tag } };
    },
  };

  settings = {
    base_url: {
      title: "站点域名（.nyc / .media / .work / .so / .casa 轮换）",
      type: "input",
      validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
      default: "https://jmanga.nyc",
    },
  };

  init() {
    const saved = String(this.loadSetting("base_url") || "").trim().replace(/\/+$/, "");
    if (saved) this.baseUrl = /^https?:\/\//i.test(saved) ? saved : "https://" + saved;
  }
}
