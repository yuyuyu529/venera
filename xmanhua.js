/** @type {import('./_venera_.js')} */
/*
 * X漫画 (xmanhua.net) — Venera comic source
 * ------------------------------------------------------------------
 * 站点是 mangabz 同系模板（mangabz.com / xmanhua.com / yymanhua.com / xmanhua.net 互为镜像）
 *   - 列表:  /manga-list-{题材}-{状态}-{排序}/          分页 /manga-list-{...}-p{n}/
 *            用户给的 https://www.xmanhua.net/manga-list-0-0-2/ 即 全部/全部/按更新时间
 *   - 搜索:  /search?title={kw}&page={n}
 *   - 详情:  /{id}xm/           章节链接 /m{nid}/
 *   - 章节:  /m{nid}/           内含 XMANHUA_CID / XMANHUA_MID / XMANHUA_IMAGE_COUNT /
 *                               XMANHUA_VIEWSIGN(_DT)
 *   - 图片:  /m{cid}/chapterimage.ashx?cid={cid}&page={n}
 *            返回 packer 混淆过的 JS，解包后得到 pix + ["/001.jpg", ...]（一次 2 张，
 *            服务端缓存命中时一次 15 张），拼成 pix + path 即图片地址
 *   - 图片域: image.xmanhua.com / cover.xmanhua.net（需要 Referer）
 */

const XM_DEFAULT_BASE = "www.xmanhua.net";
const XM_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 题材 id（站点分类页 /manga-list-{id}-0-10/ 里的取值）
const XM_THEMES = [
  ["全部", "0"],
  ["热血", "31"],
  ["恋爱", "26"],
  ["校园", "1"],
  ["冒险", "2"],
  ["科幻", "25"],
  ["生活", "11"],
  ["悬疑", "17"],
  ["运动", "34"],
];

function xmJoinPath(base, p) {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (/^\/\//.test(p)) return "https:" + p;
  if (!base) return p;
  var b = base.replace(/\/+$/, "");
  if (p.indexOf(b) === 0) return p;
  return b + (p.charAt(0) === "/" ? "" : "/") + p;
}

/** packer 的 token 编码：a<=36 用 toString，a=62 用 base62 字母表 */
function xmToken(n, a) {
  if (a >= 2 && a <= 36) return n.toString(a);
  const D = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (a !== 62) return n.toString(36);
  let s = "";
  do {
    s = D.charAt(n % a) + s;
    n = Math.floor(n / a);
  } while (n > 0);
  return s;
}

/** 解 packer 混淆（p.a.c.k.e.r） */
function xmUnpack(body) {
  if (!body) return "";
  const m =
    /}\s*\(\s*'([\s\S]*?)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'([\s\S]*?)'\s*\.split\(\s*'\|'\s*\)/.exec(
      body
    ) ||
    /}\s*\(\s*"([\s\S]*?)"\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*"([\s\S]*?)"\s*\.split\(\s*"\|"\s*\)/.exec(
      body
    );
  if (!m) return "";
  let p = m[1];
  const a = parseInt(m[2], 10);
  let c = parseInt(m[3], 10);
  const k = m[4].split("|");
  try {
    while (c--) {
      if (k[c]) {
        p = p.replace(new RegExp("\\b" + xmToken(c, a) + "\\b", "g"), k[c]);
      }
    }
  } catch (e) {
    return "";
  }
  return p;
}

/** 从 chapterimage.ashx 的响应里取出 pix 前缀与图片相对路径 */
function xmParseAshx(body) {
  let script = String(body || "");
  if (!/pix\s*=/.test(script)) {
    const unpacked = xmUnpack(script);
    if (unpacked) script = unpacked;
  }
  let pix = "";
  const pm = /pix\s*=\s*["']([^"']+)["']/.exec(script);
  if (pm) pix = pm[1];

  const paths = [];
  const re = /["']([^"']*\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let m;
  while ((m = re.exec(script)) !== null) {
    const v = m[1];
    if (!v) continue;
    if (pix && v.indexOf(pix) === 0) {
      if (paths.indexOf(v) === -1) paths.push(v);
      continue;
    }
    if (paths.indexOf(v) === -1) paths.push(v);
  }
  return { pix: pix, paths: paths };
}

class Xmanhua extends ComicSource {
  name = "X漫画";

  key = "xmanhua";

  version = "1.0.0";

  minAppVersion = "1.0.0";

  url = "https://gcore.jsdelivr.net/gh/yuyuyu529/venera@main/xmanhua.js";

  settings = {
    base_url: {
      title: "站点域名",
      type: "input",
      validator:
        "^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
      default: XM_DEFAULT_BASE,
    },
  };

  get baseUrl() {
    var v = String(this.loadSetting("base_url") || XM_DEFAULT_BASE).trim();
    v = v.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    return "https://" + v;
  }

  get headers() {
    return {
      "User-Agent": XM_UA,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      Referer: this.baseUrl + "/",
      Cookie: "xmanhua_lang=2",
    };
  }

  abs(href) {
    if (!href) return "";
    var s = String(href).trim();
    if (/^https?:\/\//i.test(s)) return s.replace(/^http:/i, "https:");
    if (/^\/\//.test(s)) return "https:" + s;
    if (s.charAt(0) === "/") return this.baseUrl + s;
    return this.baseUrl + "/" + s;
  }

  /** 取页面 HTML，失败抛错 */
  async getHtml(url, referer) {
    var headers = this.headers;
    if (referer) headers = Object.assign({}, headers, { Referer: referer });
    var res = await Network.get(url, headers);
    if (res.status !== 200) {
      throw "X漫画: HTTP " + res.status + " " + url;
    }
    return res.body;
  }

  /** 列表项：.mh-list li .mh-item */
  parseList(doc) {
    var comics = [];
    var seen = {};
    var nodes = doc.querySelectorAll(".mh-list li .mh-item, .mh-list li");
    for (var i = 0; i < nodes.length; i++) {
      var li = nodes[i];
      var a = li.querySelector("h2 a") || li.querySelector("a");
      if (!a) continue;
      var href = a.attributes["href"] || "";
      var m = /\/(\d+)xm\/?/i.exec(href);
      if (!m) continue;
      var id = m[1];
      if (seen[id]) continue;
      seen[id] = true;
      var title = (a.attributes["title"] || "").trim();
      if (!title) {
        var t = li.querySelector(".title");
        if (t) title = (t.text || "").trim();
      }
      if (!title) title = (a.text || "").trim();
      var img = li.querySelector("img");
      var cover = "";
      if (img) cover = img.attributes["src"] || img.attributes["data-src"] || "";
      var tags = [];
      var chap = li.querySelector("p.chapter span");
      var sub = chap ? (chap.text || "").trim() : "";
      comics.push(
        new Comic({
          id: id,
          title: title || id,
          cover: this.abs(cover),
          subtitle: sub || undefined,
          subTitle: sub || undefined,
          tags: tags,
        })
      );
    }
    if (comics.length === 0) {
      // 兜底：任何指向 /{id}xm/ 的链接
      var links = doc.querySelectorAll("a");
      for (var j = 0; j < links.length; j++) {
        var la = links[j];
        var lh = la.attributes["href"] || "";
        var lm = /\/(\d+)xm\/?/i.exec(lh);
        if (!lm || seen[lm[1]]) continue;
        seen[lm[1]] = true;
        var limg = la.querySelector("img");
        comics.push(
          new Comic({
            id: lm[1],
            title: (la.attributes["title"] || la.text || lm[1]).trim(),
            cover: this.abs(limg ? limg.attributes["src"] || "" : ""),
          })
        );
      }
    }
    return comics;
  }

  /** 分页：没有总页数，只能靠「下一页 >」判断 */
  parseMaxPage(doc, page) {
    var links = doc.querySelectorAll(".page-pagination a");
    var max = page;
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].text || "").trim();
      var idx = parseInt(links[i].attributes["data-index"] || "", 10);
      if (t === ">" || t === "›" || t === "»") return page + 1;
      if (!isNaN(idx) && idx > max) max = idx;
    }
    return max;
  }

  explore = [
    {
      title: "推荐",
      type: "singlePageWithMultiPart",
      load: async () => {
        var html = await this.getHtml(this.baseUrl + "/");
        var doc = new HtmlDocument(html);
        var out = {};

        var today = [];
        var blocks = doc.querySelectorAll(".index-block");
        for (var i = 0; i < blocks.length; i++) {
          var b = blocks[i];
          var span = b.querySelector(".list-con-title span");
          if (!span) continue;
          var name = (span.text || "").trim();
          if (name !== "今日更新" && name !== "最新上架") continue;
          var items = b.querySelectorAll(".index-manga-item");
          var arr = [];
          for (var j = 0; j < items.length; j++) {
            var a = items[j].querySelector("a");
            if (!a) continue;
            var m = /\/(\d+)xm\/?/i.exec(a.attributes["href"] || "");
            if (!m) continue;
            var img = items[j].querySelector("img");
            arr.push(
              new Comic({
                id: m[1],
                title: (a.attributes["title"] || a.text || "").trim(),
                cover: this.abs(img ? img.attributes["src"] || "" : ""),
              })
            );
          }
          if (arr.length) out[name] = arr;
        }

        var rank = [];
        var ranks = doc.querySelectorAll(".rank-list .list, .rank-list .rank-item-1");
        for (var k = 0; k < ranks.length; k++) {
          var ra = ranks[k].querySelector("a");
          if (!ra) continue;
          var rm = /\/(\d+)xm\/?/i.exec(ra.attributes["href"] || "");
          if (!rm) continue;
          var ri = ranks[k].querySelector("img");
          var rtags = [];
          var spans = ranks[k].querySelectorAll(".rank-item-right span");
          for (var s = 0; s < spans.length; s++) {
            var st = (spans[s].text || "").trim();
            if (st) rtags.push(st);
          }
          rank.push(
            new Comic({
              id: rm[1],
              title: (ra.attributes["title"] || "").trim() || rm[1],
              cover: this.abs(ri ? ri.attributes["src"] || "" : ""),
              tags: rtags,
            })
          );
        }
        if (rank.length) out["热度排行"] = rank;

        var rec = [];
        var recs = doc.querySelectorAll(
          ".index-list-con-info-inner a, .index-list-con-info .m-con a"
        );
        for (var r = 0; r < recs.length; r++) {
          var ca = recs[r];
          var cm = /\/(\d+)xm\/?/i.exec(ca.attributes["href"] || "");
          if (!cm) continue;
          var ci = ca.querySelector("img");
          if (!ci) continue;
          rec.push(
            new Comic({
              id: cm[1],
              title: (ca.attributes["title"] || "").trim() || cm[1],
              cover: this.abs(ci.attributes["src"] || ""),
            })
          );
        }
        if (rec.length) out["吐血推荐"] = rec;

        return out;
      },
    },
    {
      title: "最新更新",
      type: "multiPageComicList",
      load: async (page) => {
        page = page > 0 ? page : 1;
        var suffix = page > 1 ? "-p" + page : "";
        var url = this.baseUrl + "/manga-list-0-0-2" + suffix + "/";
        var html = await this.getHtml(url);
        var doc = new HtmlDocument(html);
        return {
          comics: this.parseList(doc),
          maxPage: this.parseMaxPage(doc, page),
        };
      },
    },
  ];

  category = {
    title: "X漫画",
    parts: [
      {
        name: "题材（大分类）",
        type: "fixed",
        categories: XM_THEMES.map(function (x) {
          return x[0];
        }),
        categoryParams: XM_THEMES.map(function (x) {
          return x[1];
        }),
        itemType: "category",
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      page = page > 0 ? page : 1;
      var theme = param || "0";
      var status = (options && options[0]) || "0";
      var sort = (options && options[1]) || "10";
      var suffix = page > 1 ? "-p" + page : "";
      var url =
        this.baseUrl +
        "/manga-list-" +
        theme +
        "-" +
        status +
        "-" +
        sort +
        suffix +
        "/";
      var html = await this.getHtml(url);
      var doc = new HtmlDocument(html);
      return {
        comics: this.parseList(doc),
        maxPage: this.parseMaxPage(doc, page),
      };
    },

    optionList: [
      {
        type: "select",
        options: ["0-全部", "1-连载中", "2-完结"],
        label: "状态",
        default: "0",
      },
      {
        type: "select",
        options: ["10-人气", "2-更新时间"],
        label: "排序",
        default: "10",
      },
    ],
  };

  search = {
    load: async (keyword, options, page) => {
      page = page > 0 ? page : 1;
      var url =
        this.baseUrl +
        "/search?title=" +
        encodeURIComponent(keyword) +
        "&page=" +
        page;
      var html = await this.getHtml(url);
      var doc = new HtmlDocument(html);
      return {
        comics: this.parseList(doc),
        maxPage: this.parseMaxPage(doc, page),
      };
    },
    optionList: [],
  };

  comic = {
    loadInfo: async (id) => {
      id = String(id).replace(/xm$/i, "");
      var url = this.baseUrl + "/" + id + "xm/";
      var html = await this.getHtml(url);
      var doc = new HtmlDocument(html);

      var titleEl = doc.querySelector(".detail-info-title");
      var title = titleEl ? (titleEl.text || "").trim() : "";
      if (!title) {
        var h1 = doc.querySelector("h1");
        title = h1 ? (h1.text || "").trim() : id;
      }

      var coverImg =
        doc.querySelector("img.detail-info-cover") ||
        doc.querySelector(".detail-info-cover img");
      var cover = coverImg
        ? coverImg.attributes["src"] || coverImg.attributes["data-src"] || ""
        : "";

      var authors = [];
      var status = "";
      var themes = [];
      var tip = doc.querySelector(".detail-info-tip");
      if (tip) {
        var spans = tip.querySelectorAll("span");
        for (var i = 0; i < spans.length; i++) {
          var sp = spans[i];
          var txt = (sp.text || "").trim();
          if (txt.indexOf("作者") !== -1) {
            var as = sp.querySelectorAll("a");
            for (var j = 0; j < as.length; j++) {
              var an = (as[j].text || "").trim();
              if (an) authors.push(an);
            }
            if (!authors.length) {
              var v = txt.replace(/^[^:：]*[:：]\s*/, "").trim();
              if (v) authors.push(v);
            }
          } else if (txt.indexOf("状态") !== -1) {
            var inner = sp.querySelector("span");
            var st = inner
              ? (inner.text || "").trim()
              : txt.replace(/^[^:：]*[:：]\s*/, "").trim();
            if (st) status = st;
          } else if (txt.indexOf("题材") !== -1) {
            var items = sp.querySelectorAll(".item");
            for (var k = 0; k < items.length; k++) {
              var tt = (items[k].text || "").trim();
              if (tt) themes.push(tt);
            }
          }
        }
      }

      var description = "";
      var descEl = doc.querySelector(".detail-info-content");
      if (descEl) {
        description = (descEl.text || "")
          .replace(/\[\+展开\]|\[-折叠\]/g, "")
          .replace(/\s+\n/g, "\n")
          .trim();
      }

      var tags = {};
      if (themes.length) tags["题材"] = themes;
      if (status) tags["状态"] = [status];
      if (authors.length) tags["作者"] = authors;

      var chapters = new Map();
      var links = doc.querySelectorAll("#chapterlistload a");
      for (var n = 0; n < links.length; n++) {
        var la = links[n];
        var href = la.attributes["href"] || "";
        var cm = /\/m(\d+)\/?/.exec(href);
        if (!cm) continue;
        var cid = cm[1];
        if (chapters.has(cid)) continue;
        var name = (la.text || "").replace(/\s+/g, " ").trim();
        // 去掉末尾的（13P）
        name = name.replace(/\s*[（(]\s*\d+\s*P\s*[)）]\s*$/i, "").trim();
        chapters.set(cid, name || cid);
      }

      return new ComicDetails({
        title: title || id,
        cover: this.abs(cover),
        description: description,
        tags: tags,
        chapters: chapters,
        uploader: authors.length ? authors.join(" / ") : undefined,
        subtitle: status || undefined,
        subTitle: status || undefined,
        url: url,
      });
    },

    loadEp: async (comicId, epId) => {
      if (!epId) throw "X漫画: 缺少章节 id";
      var chUrl = this.baseUrl + "/m" + epId + "/";
      var html = await this.getHtml(chUrl, this.baseUrl + "/" + comicId + "xm/");

      var cidM = /XMANHUA_CID\s*=\s*(\d+)/.exec(html);
      var midM = /XMANHUA_MID\s*=\s*(\d+)/.exec(html);
      var cntM = /XMANHUA_IMAGE_COUNT\s*=\s*(\d+)/.exec(html);
      var dtM = /XMANHUA_VIEWSIGN_DT\s*=\s*"([^"]+)"/.exec(html);
      var signM = /XMANHUA_VIEWSIGN\s*=\s*"([^"]+)"/.exec(html);
      var cid = cidM ? cidM[1] : String(epId);
      var mid = midM ? midM[1] : "";
      var count = cntM ? parseInt(cntM[1], 10) : 0;
      if (!count || count < 1) count = 20;

      var dt = dtM ? dtM[1] : "";
      var sign = signM ? signM[1] : "";

      var apiBase = this.baseUrl + "/m" + cid + "/chapterimage.ashx?cid=" + cid;
      var apiHeaders = Object.assign({}, this.headers, {
        Referer: chUrl,
        "X-Requested-With": "XMLHttpRequest",
      });

      var paths = new Array(count + 1);
      var pix = "";

      var fetchPage = async (page, withSign) => {
        var url = apiBase + "&page=" + page;
        if (withSign && sign) {
          url +=
            "&key=&_cid=" +
            cid +
            "&_mid=" +
            mid +
            "&_dt=" +
            encodeURIComponent(dt.replace(/ /g, "+")) +
            "&_sign=" +
            sign;
        }
        var r = await Network.get(url, apiHeaders);
        if (r.status !== 200 || !r.body) return null;
        var parsed = xmParseAshx(r.body);
        if (!parsed.paths.length) return null;
        return parsed;
      };

      var emptyStreak = 0;
      var page = 1;
      while (page <= count) {
        var batch = [];
        for (var b = 0; b < 4 && page + b <= count; b++) {
          if (!paths[page + b]) batch.push(page + b);
        }
        if (batch.length === 0) {
          page += 4;
          continue;
        }
        var results = await Promise.all(
          batch.map(function (p) {
            return fetchPage(p, false);
          })
        );
        var got = 0;
        for (var i = 0; i < results.length; i++) {
          var r = results[i];
          var idx = batch[i];
          if (!r) continue;
          if (r.pix) pix = r.pix;
          for (var j = 0; j < r.paths.length; j++) {
            var at = idx + j;
            if (at <= count && !paths[at]) paths[at] = r.paths[j];
          }
          got++;
        }
        if (got === 0) {
          // 无签名接口没给数据，带上签名再试一次
          var retried = await Promise.all(
            batch.map(function (p) {
              return fetchPage(p, true);
            })
          );
          for (var q = 0; q < retried.length; q++) {
            var rr = retried[q];
            var qi = batch[q];
            if (!rr) continue;
            if (rr.pix) pix = rr.pix;
            for (var w = 0; w < rr.paths.length; w++) {
              var qa = qi + w;
              if (qa <= count && !paths[qa]) paths[qa] = rr.paths[w];
            }
            got++;
          }
        }
        if (got === 0) {
          emptyStreak++;
          if (emptyStreak >= 2) break;
        } else {
          emptyStreak = 0;
        }
        page += 4;
      }

      var images = [];
      for (var n = 1; n <= count; n++) {
        var p = paths[n];
        if (!p) continue;
        images.push(xmJoinPath(pix, p));
      }
      if (!images.length) throw "X漫画: 没有解析到图片（chapterimage.ashx 可能已改动）";
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          referer: this.baseUrl + "/",
          "user-agent": XM_UA,
        },
      };
    },

    onThumbnailLoad: (url) => {
      var cfg = { url: url };
      if (url && /xmanhua\.(net|com)/i.test(url)) {
        cfg.headers = {
          referer: this.baseUrl + "/",
          "user-agent": XM_UA,
        };
      }
      return cfg;
    },

    idMatch: "^\\d+$",

    link: {
      domains: [
        "xmanhua.net",
        "www.xmanhua.net",
        "xmanhua.com",
        "www.xmanhua.com",
        "mangabz.com",
        "yymanhua.com",
      ],
      linkToId: (url) => {
        var m = /\/(\d+)xm\/?/.exec(url || "");
        return m ? m[1] : null;
      },
    },
  };

  translation = {
    zh_CN: {},
    zh_TW: {},
    en: {
      推荐: "Featured",
      最新更新: "Latest",
      今日更新: "Updated today",
      最新上架: "New releases",
      热度排行: "Popular",
      吐血推荐: "Editor picks",
      题材: "Genres",
      状态: "Status",
      排序: "Sort",
      全部: "All",
      连载中: "Ongoing",
      完结: "Completed",
      人气: "Popularity",
      更新时间: "Updated",
      X漫画: "Xmanhua",
    },
  };
}
