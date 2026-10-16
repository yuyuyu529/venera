/**
 * Nicomanga（lovehug.net / rawinu.com）Venera 漫画源
 * —— 日语生肉（raw）站，带 8 个百合分类；实测免登录、无 Cloudflare、图片 HTML 直出
 *
 * 取证（2026-10 实测）：
 *  1. 列表：manga-list.html?listType=pagination&page={p}&genre={g}&sort=last_update&sort_type=DESC
 *     卡片 div.thumb-item-flow → .series-title a（作品链接 manga-<slug>.html + 标题）
 *     封面在 .content.img-in-ratio 的 style="background-image:url('...')" 里
 *  2. 搜索：manga-list.html?listType=pagination&page={p}&name={关键词}
 *  3. 详情页：img.thumbnail（封面）、.manga-info h3（标题）、.summary-content（简介）、
 *     .manga-info a.btn-danger（题材）、.manga-info a.btn-info（作者）
 *  4. 章节表不在详情页 HTML 里，走：GET /app/manga/controllers/cont.Listchapter.php?slug=<slug>
 *     返回 ul.list-chapters a[href][title]
 *  5. 章节页图片：img.chapter-img[data-src]（注意值结尾带空格，必须 trim）
 *  6. rawinu.com 是同一套 CMS（就是本站的旧品牌），改域名即可复用
 */
class Lovehug extends ComicSource {
  name = "Nicomanga(生肉)";
  key = "lovehug";
  version = "1.0.1";
  minAppVersion = "1.0.0";
  url = "https://cdn.jsdelivr.net/gh/yuyuyu529/venera@main/lovehug.js";

    // 分类名中文翻译（官方 translation 字段）
    translation = {
        'zh_CN': {
            "GL Girls Love": "百合",
            "Girls Love GL Yuri": "百合",
            "Romance Yuri": "恋爱百合",
            "Seinen Yuri": "青年百合",
            "Shoujo Ai Yuri": "少女爱百合",
            "Adult": "成人",
            "Comedy": "喜剧",
            "Drama": "剧情",
            "Girls Love": "百合",
            "Romance": "恋爱",
            "School Life": "校园",
            "Slice of Life": "日常"
        },
        'zh_TW': {
            "GL Girls Love": "百合",
            "Girls Love GL Yuri": "百合",
            "Romance Yuri": "恋爱百合",
            "Seinen Yuri": "青年百合",
            "Shoujo Ai Yuri": "少女爱百合",
            "Adult": "成人",
            "Comedy": "喜剧",
            "Drama": "剧情",
            "Girls Love": "百合",
            "Romance": "恋爱",
            "School Life": "校园",
            "Slice of Life": "日常"
        },
    }

  baseUrl = "https://lovehug.net";

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
    };
  }

  abs(u) {
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    if (u.startsWith("//")) return "https:" + u;
    return this.baseUrl + (u.startsWith("/") ? u : "/" + u);
  }

  parseList(html) {
    const doc = new HtmlDocument(html);
    const out = [];
    doc.querySelectorAll(".thumb-item-flow").forEach((e) => {
      const a = e.querySelector(".series-title a");
      if (!a) return;
      const href = a.attributes["href"];
      if (!href) return;
      const box = e.querySelector(".content");
      let cover = "";
      if (box) {
        const style = box.attributes["style"] || "";
        const m = style.match(/url\((['"]?)([^'")]+)\1\)/);
        if (m) cover = this.abs(m[2]);
      }
      out.push(new Comic({ id: this.abs(href), title: (a.text || "").trim(), cover }));
    });
    return out;
  }

  maxPageOf(html) {
    const doc = new HtmlDocument(html);
    let max = 1;
    doc.querySelectorAll("a").forEach((a) => {
      const href = a.attributes["href"] || "";
      const m = href.match(/[?&]page=(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    return max;
  }

  listUrl(page, opts) {
    const p = page || 1;
    const q = [
      "listType=pagination",
      "page=" + p,
      "genre=" + encodeURIComponent((opts && opts.genre) || ""),
      "sort=" + ((opts && opts.sort) || "last_update"),
      "sort_type=DESC",
    ];
    if (opts && opts.name) q.push("name=" + encodeURIComponent(opts.name));
    return `${this.baseUrl}/manga-list.html?` + q.join("&");
  }

  async fetchList(url) {
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) throw `请求失败: ${res.status}`;
    return { comics: this.parseList(res.body), maxPage: this.maxPageOf(res.body) };
  }

  explore = [
    {
      title: "全站最新更新",
      type: "multiPageComicList",
      load: async (page) => await this.fetchList(this.listUrl(page, {})),
    },
  ];

  category = {
    title: "题材",
    parts: [
      {
        name: "百合 / GL",
        type: "fixed",
        categories: [
          { label: "百合 yuri", target: { page: "category", attributes: { category: "yuri", param: null } } },
          { label: "少女爱 shoujo-ai", target: { page: "category", attributes: { category: "shoujo-ai", param: null } } },
          { label: "Girls Love", target: { page: "category", attributes: { category: "girls-love", param: null } } },
          { label: "GL Girls Love", target: { page: "category", attributes: { category: "gl-girls-love", param: null } } },
          { label: "Girls Love GL Yuri", target: { page: "category", attributes: { category: "girls-love-gl-yuri", param: null } } },
          { label: "Shoujo Ai Yuri", target: { page: "category", attributes: { category: "shoujo-ai-yuri", param: null } } },
          { label: "Romance Yuri", target: { page: "category", attributes: { category: "romance-yuri", param: null } } },
          { label: "Seinen Yuri", target: { page: "category", attributes: { category: "seinen-yuri", param: null } } },
        ],
      },
      {
        name: "常用",
        type: "fixed",
        categories: [
          { label: "Romance", target: { page: "category", attributes: { category: "romance", param: null } } },
          { label: "Comedy", target: { page: "category", attributes: { category: "comedy", param: null } } },
          { label: "Drama", target: { page: "category", attributes: { category: "drama", param: null } } },
          { label: "School Life", target: { page: "category", attributes: { category: "school-life", param: null } } },
          { label: "Slice of Life", target: { page: "category", attributes: { category: "slice-of-life", param: null } } },
          { label: "Adult", target: { page: "category", attributes: { category: "adult", param: null } } },
        ],
      },
    ],
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      return await this.fetchList(this.listUrl(page, { genre: category }));
    },
  };

  search = {
    load: async (keyword, options, page) => {
      return await this.fetchList(this.listUrl(page, { name: keyword }));
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = this.abs(id);
      const res = await Network.get(url, Object.assign({}, this.headers, { "Referer": this.baseUrl + "/" }));
      if (res.status !== 200) throw `详情页请求失败: ${res.status}`;
      const doc = new HtmlDocument(res.body);

      const titleEl = doc.querySelector(".manga-info h3") || doc.querySelector("h3");
      const coverEl = doc.querySelector("img.thumbnail") || doc.querySelector(".text-center img");
      const descEl = doc.querySelector(".summary-content");

      const tags = {};
      const cat = doc.querySelectorAll(".manga-info a.btn-danger")
        .map((a) => (a.text || "").trim())
        .filter((t) => t && t !== "Genre(s):");
      if (cat.length) tags["题材"] = Array.from(new Set(cat));
      const authors = doc.querySelectorAll(".manga-info a.btn-info")
        .map((a) => (a.text || "").trim()).filter(Boolean);
      if (authors.length) tags["作者"] = Array.from(new Set(authors));

      // 章节表走独立接口
      const chapters = {};
      const m = url.match(/manga-(.+)\.html/);
      if (m) {
        const slug = m[1];
        const api = `${this.baseUrl}/app/manga/controllers/cont.Listchapter.php?slug=${encodeURIComponent(slug)}`;
        const r = await Network.get(api, {
          ...this.headers,
          "X-Requested-With": "XMLHttpRequest",
          "Referer": url,
        });
        if (r.status === 200) {
          const d2 = new HtmlDocument(r.body);
          d2.querySelectorAll("ul.list-chapters a").forEach((a) => {
            const href = a.attributes["href"];
            if (!href) return;
            const nameEl = a.querySelector(".chapter-name");
            const t = ((nameEl && nameEl.text) || a.attributes["title"] || "").trim();
            chapters[this.abs(href)] = t || href;
          });
        }
      }

      return new ComicDetails({
        title: titleEl ? (titleEl.text || "").trim() : "",
        cover: coverEl ? this.abs(coverEl.attributes["src"]) : "",
        description: descEl ? (descEl.text || "").trim() : "",
        tags,
        chapters: Object.fromEntries(Object.entries(chapters).reverse()),
        url,
      });
    },

    loadEp: async (comicId, epId) => {
      const url = this.abs(epId);
      const res = await Network.get(url, Object.assign({}, this.headers, { "Referer": this.abs(comicId) }));
      if (res.status !== 200) throw `章节页请求失败: ${res.status}`;
      const doc = new HtmlDocument(res.body);
      const images = [];
      doc.querySelectorAll("img.chapter-img").forEach((img) => {
        const s = (img.attributes["data-src"] || img.attributes["src"] || "").trim();
        if (!s || s.startsWith("data:")) return;
        images.push(this.abs(s));
      });
      if (!images.length) throw "未解析到任何图片";
      return { images };
    },

    onImageLoad: (url) => {
      return { headers: { "Referer": this.baseUrl + "/" } };
    },

    onClickTag: (namespace, tag) => {
      return { page: "search", attributes: { keyword: tag } };
    },
  };

  settings = {
    base_url: {
      title: "站点域名（lovehug.net / rawinu.com）",
      type: "input",
      validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
      default: "https://lovehug.net",
    },
  };

  init() {
    const saved = String(this.loadSetting("base_url") || "").trim().replace(/\/+$/, "");
    if (saved) this.baseUrl = /^https?:\/\//i.test(saved) ? saved : "https://" + saved;
  }
}
