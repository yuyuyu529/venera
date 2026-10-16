/**
 * KLManga（klmanga.toys）Venera 漫画源 —— 日本生肉聚合站，带「百合」分类
 * 取证（2026-10 实测）：WordPress 站。
 *  列表页 div.entry（.thumb img 封面 / h2.name a 标题 / .genres a 标签），分页 div.z-pagination
 *  详情页 h1.name / .main-thumb img / .content-text / .z-single-mg .genres a / .chapter-box h4 a
 *  章节页正文为空，图片由 admin-ajax 分批解密：action=z_do_ajax&_action=decode_images&reading_chapter=<页内ID>&img_index=N&content=<上轮HTML>
 *  每章通常是 1 张合并长图；多图会自动继续。图片在第三方图床且文件名含空格，需编码并带 Referer。
 */
class Klmanga extends ComicSource {
  name = "KLManga(生肉)";
  key = "klmanga";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://raw.githubusercontent.com/yuyuyu529/venera/main/klmanga.js";
  baseUrl = "https://klmanga.toys";

  get headers() {
    return {
      "User-Agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ja,en;q=0.8",
    };
  }
  get ajaxHeaders() {
    return Object.assign({}, this.headers, {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": this.baseUrl + "/",
    });
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
    doc.querySelectorAll(".entry").forEach((e) => {
      const nameEl = e.querySelector("h2.name a") || e.querySelector(".thumb a");
      if (!nameEl) return;
      const href = nameEl.attributes["href"];
      if (!href || href.indexOf("/manga-raw/") < 0) return;
      const img = e.querySelector(".thumb img");
      const cover = img ? this.abs(img.attributes["src"] || img.attributes["data-src"]) : "";
      const tags = e.querySelectorAll(".genres a").map((x) => (x.text || "").trim()).filter(Boolean);
      out.push(new Comic({ id: this.abs(href), title: (nameEl.text || "").trim(), cover, tags }));
    });
    return out;
  }

  maxPageOf(html) {
    const doc = new HtmlDocument(html);
    let max = 1;
    doc.querySelectorAll(".z-pagination .page-numbers").forEach((a) => {
      const n = parseInt((a.text || "").trim(), 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max;
  }

  async fetchList(url) {
    const res = await Network.get(url, this.headers);
    if (res.status !== 200) throw `请求失败: ${res.status}`;
    return { comics: this.parseList(res.body), maxPage: this.maxPageOf(res.body) };
  }

  explore = [
    {
      title: "最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        const p = page || 1;
        return await this.fetchList(this.baseUrl + "/" + (p > 1 ? `page/${p}/` : ""));
      },
    },
  ];

  category = {
    title: "题材",
    parts: [
      {
        name: "百合 / 女性向",
        type: "fixed",
        categories: [
          { label: "百合", target: { page: "category", attributes: { category: "%E7%99%BE%E5%90%88", param: null } } },
          { label: "少女爱(shoujo-ai)", target: { page: "category", attributes: { category: "shoujo-ai", param: null } } },
          { label: "女性向(レディコミ)", target: { page: "category", attributes: { category: "%E3%83%AC%E3%83%87%E3%82%A3%E3%82%B3%E3%83%9F", param: null } } },
          { label: "恋爱", target: { page: "category", attributes: { category: "%E6%81%8B%E6%84%9B", param: null } } },
        ],
      },
      {
        name: "常用题材",
        type: "fixed",
        categories: [
          { label: "剧情", target: { page: "category", attributes: { category: "%E3%83%89%E3%83%A9%E3%83%9E", param: null } } },
          { label: "日常系", target: { page: "category", attributes: { category: "%E6%97%A5%E5%B8%B8%E7%B3%BB", param: null } } },
          { label: "校园", target: { page: "category", attributes: { category: "%E5%AD%A6%E5%9C%92", param: null } } },
          { label: "奇幻", target: { page: "category", attributes: { category: "%E3%83%95%E3%82%A1%E3%83%B3%E3%82%BF%E3%82%B8%E3%83%BC", param: null } } },
        ],
      },
    ],
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const p = page || 1;
      return await this.fetchList(`${this.baseUrl}/manga-genre/${category}/` + (p > 1 ? `page/${p}/` : ""));
    },
  };

  search = {
    load: async (keyword, options, page) => {
      const p = page || 1;
      return await this.fetchList(`${this.baseUrl}/?s=${encodeURIComponent(keyword)}` + (p > 1 ? `&paged=${p}` : ""));
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = this.abs(id);
      const res = await Network.get(url, Object.assign({}, this.headers, { "Referer": this.baseUrl + "/" }));
      if (res.status !== 200) throw `请求失败: ${res.status}`;
      const doc = new HtmlDocument(res.body);
      const titleEl = doc.querySelector("h1.name") || doc.querySelector("h1");
      const imgEl = doc.querySelector(".main-thumb img");
      const descEl = doc.querySelector(".content-text");
      const tags = {};
      const tagBox = doc.querySelector(".z-single-mg .genres");
      const tagNames = (tagBox ? tagBox.querySelectorAll("a") : []).map((a) => (a.text || "").trim()).filter(Boolean);
      if (tagNames.length) tags["题材"] = tagNames;
      const chapters = {};
      doc.querySelectorAll(".chapter-box h4 a").forEach((a) => {
        const href = a.attributes["href"];
        if (!href) return;
        let t = (a.text || "").replace(/\s+/g, " ").trim();
        const bm = t.match(/【[^】]*】/);
        if (bm) t = bm[0];
        chapters[this.abs(href)] = t || href;
      });
      return new ComicDetails({
        title: titleEl ? (titleEl.text || "").trim() : "",
        cover: imgEl ? this.abs(imgEl.attributes["src"]) : "",
        description: descEl ? (descEl.text || "").trim() : "",
        tags, chapters, url,
      });
    },

    loadEp: async (comicId, epId) => {
      const url = this.abs(epId);
      const res = await Network.get(url, Object.assign({}, this.headers, { "Referer": this.baseUrl + "/" }));
      if (res.status !== 200) throw `章节页请求失败: ${res.status}`;
      const m = res.body.match(/reading_chapter\s*:\s*(\d+)/);
      if (!m) throw "未找到 reading_chapter（站点可能改版）";
      let imgIndex = 0, content = "";
      const images = [];
      for (let round = 0; round < 40; round++) {
        const payload = `action=z_do_ajax&_action=decode_images&reading_chapter=${m[1]}&img_index=${imgIndex}&content=${encodeURIComponent(content)}`;
        const r = await Network.post(`${this.baseUrl}/wp-admin/admin-ajax.php`, Object.assign({}, this.ajaxHeaders, { "Referer": url }), payload);
        if (r.status !== 200) throw `图片解析接口失败: ${r.status}`;
        let json;
        try { json = JSON.parse(r.body); } catch (e) { throw "图片解析接口返回非 JSON（可能被反爬拦截）"; }
        imgIndex = parseInt(json.img_index, 10) || imgIndex;
        const mes = json.mes || "";
        if (mes) {
          content += mes;
          const re = /src=['"]([^'"]+)['"]/g;
          let mm;
          while ((mm = re.exec(mes)) !== null) {
            images.push(this.abs(String(mm[1]).replace(/\\\//g, "/").replace(/ /g, "%20")));
          }
        }
        if (json.going != 1) break;
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
      title: "站点域名",
      type: "input",
      validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
      default: "https://klmanga.toys",
    },
  };

  init() {
    const saved = String(this.loadSetting("base_url") || "").trim().replace(/\/+$/, "");
    if (saved) this.baseUrl = /^https?:\/\//i.test(saved) ? saved : "https://" + saved;
  }
}
