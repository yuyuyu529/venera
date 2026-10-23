/** @type {import('./_venera_.js')} */
/*
 * 卡拉漫画 (kalamanhua.com) — Venera comic source
 * ------------------------------------------------------------
 * 站点结构要点:
 *   - 分类/列表:  /list/{All|Kc|Jc|Cc|Ec|Oc}/page/{n}.html
 *   - 搜索:      /search/page/{n}/wd/{keyword}.html
 *   - 详情:      /comic/{id}.html   (章节按线路 playlist1/2/3 分组)
 *   - 章节:      /chapter/{id}-{sid}-{nid}.html
 *                页面内 player_aaaa.url -> https://image.kalaimg.top/play/min/{url}
 *                该地址返回一个临时 token，再带 ?cf_verify={token} 才返回图片列表
 *   - 图片/封面: image.kalaimg.top，必须带 Referer，章节图还必须带 cf_verify
 *   - 全站(除图片域)需要 cookie: omo_token=xxxx（页面里 k="xxxx"）；token 失效时会返回
 *     带 omo_token 的验证页，这里自动解析并重试。
 */

const KALA_BASE = "https://www.kalamanhua.com";
const KALA_IMG = "https://image.kalaimg.top";
const KALA_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const KALA_REFERER = KALA_BASE + "/";

let kalaToken = "a7d838e940d1a0ea";

function kalaHeaders(extra) {
  const h = {
    "User-Agent": KALA_UA,
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    Referer: KALA_REFERER,
    Cookie: "omo_token=" + kalaToken,
  };
  if (extra) {
    for (const k in extra) h[k] = extra[k];
  }
  return h;
}

/** GET on kalamanhua.com, transparently solving the omo_token challenge */
async function kalaGet(url, referer) {
  const headers = kalaHeaders(referer ? { Referer: referer } : null);
  let res = await Network.get(url, headers);
  if (res.status !== 200 || res.body.indexOf("stui-") === -1) {
    const m = /k="([0-9a-zA-Z]+)"/.exec(res.body || "");
    if (m) {
      kalaToken = m[1];
      headers.Cookie = "omo_token=" + kalaToken;
      res = await Network.get(url, headers);
    }
  }
  if (res.status !== 200) {
    throw "kalamanhua: HTTP " + res.status + " for " + url;
  }
  return res.body;
}

/** GET on image host (no main-site cookie, never follow its omo token) */
async function kalaImgGet(url, referer) {
  const headers = {
    "User-Agent": KALA_UA,
    Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    Referer: referer || KALA_IMG + "/",
  };
  const res = await Network.get(url, headers);
  if (res.status !== 200) {
    throw "kalaimg: HTTP " + res.status + " for " + url;
  }
  return res.body;
}

function kalaDecodeEntities(s) {
  if (!s) return "";
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (all, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (all, code) =>
      String.fromCharCode(parseInt(code, 16))
    );
}

function kalaStripTags(s) {
  if (!s) return "";
  return kalaDecodeEntities(
    s
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  ).trim();
}

function kalaAttr(attrs, name) {
  const m = new RegExp(name + '\\s*=\\s*"([^"]*)"', "i").exec(attrs || "");
  return m ? m[1] : null;
}

function kalaFirstGroup(re, html) {
  const m = re.exec(html || "");
  return m ? m[1] : null;
}

/** parse comic cards on list / search pages */
function kalaParseList(html) {
  const comics = [];
  const re = /<a class="stui-vodlist__thumb[^"]*"([^>]*)>/g;
  const anchors = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    anchors.push({ start: m.index, attrs: m[1] });
  }
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const href = kalaAttr(a.attrs, "href") || "";
    const idm = /\/comic\/(\d+)\.html/.exec(href);
    if (!idm) continue;
    const end =
      i + 1 < anchors.length
        ? anchors[i + 1].start
        : Math.min(html.length, a.start + 4000);
    const block = html.substring(a.start, end);
    const title = kalaDecodeEntities(kalaAttr(a.attrs, "title") || "");
    let cover =
      kalaAttr(a.attrs, "data-original") || kalaAttr(a.attrs, "data-src") || "";
    cover = cover.trim();
    if (!cover) continue;
    const cat = kalaStripTags(
      kalaFirstGroup(/<span class="pic-text1[^"]*"[^>]*>([\s\S]*?)<\/span>/, block)
    );
    const sub = kalaStripTags(
      kalaFirstGroup(/<span class="pic-text text-right"[^>]*>([\s\S]*?)<\/span>/, block)
    );
    const author = kalaStripTags(
      kalaFirstGroup(/<p class="text[^"]*"[^>]*>([\s\S]*?)<\/p>/, block)
    );
    comics.push(
      new Comic({
        id: idm[1],
        title: title,
        cover: cover,
        subtitle: sub || undefined,
        subTitle: sub || undefined,
        tags: cat ? [cat] : [],
        description: author || undefined,
      })
    );
  }
  return comics;
}

function kalaParseMaxPage(html) {
  html = html || "";
  let m = /class="active num"><a>\s*(\d+)\s*\/\s*(\d+)/.exec(html);
  if (m) {
    const total = parseInt(m[2], 10);
    if (total > 0) return total;
  }
  m = /(\d+)\s*\/\s*(\d+)\s*<\/a>/.exec(html);
  if (m) {
    const total = parseInt(m[2], 10);
    if (total > 0 && total < 100000) return total;
  }
  return 1;
}

class Kalamanhua extends ComicSource {
  name = "卡拉漫画";

  key = "kalamanhua";

  version = "1.0.0";

  minAppVersion = "1.0.0";

  url =
    "https://gcore.jsdelivr.net/gh/yuyuyu529/venera@main/kalamanhua.js";

  explore = [
    {
      title: "推荐",
      type: "multiPartPage",
      load: async () => {
        const sections = [
          { title: "最新更新", path: "/list/All.html" },
          { title: "韩漫", path: "/list/Kc.html" },
          { title: "日漫", path: "/list/Jc.html" },
          { title: "中漫", path: "/list/Cc.html" },
          { title: "欧美漫", path: "/list/Ec.html" },
          { title: "其他", path: "/list/Oc.html" },
        ];
        const out = [];
        for (const s of sections) {
          try {
            const html = await kalaGet(KALA_BASE + s.path);
            const comics = kalaParseList(html).slice(0, 12);
            if (comics.length) out.push({ title: s.title, comics: comics });
          } catch (e) {
            console.log("explore section failed", s.title, e);
          }
        }
        return out;
      },
    },
  ];

  category = {
    title: "卡拉漫画",
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: ["全部", "韩漫", "日漫", "中漫", "欧美漫", "其他"],
        categoryParams: ["All", "Kc", "Jc", "Cc", "Ec", "Oc"],
        itemType: "category",
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const cid = param || "All";
      const html = await kalaGet(
        KALA_BASE + "/list/" + cid + "/page/" + page + ".html"
      );
      return {
        comics: kalaParseList(html),
        maxPage: kalaParseMaxPage(html),
      };
    },
  };

  search = {
    load: async (keyword, options, page) => {
      const url =
        KALA_BASE +
        "/search/page/" +
        page +
        "/wd/" +
        encodeURIComponent(keyword) +
        ".html";
      const html = await kalaGet(url);
      return {
        comics: kalaParseList(html),
        maxPage: kalaParseMaxPage(html),
      };
    },
  };

  comic = {
    loadInfo: async (id) => {
      const url = KALA_BASE + "/comic/" + id + ".html";
      const html = await kalaGet(url);

      const title = kalaStripTags(
        kalaFirstGroup(/<h1 class="title"[^>]*>([\s\S]*?)<\/h1>/, html) || ""
      );
      const thumbBlock =
        kalaFirstGroup(
          /<div class="stui-content__thumb">([\s\S]*?)<\/div>/,
          html
        ) || "";
      const thumbImg = kalaFirstGroup(/<img([^>]*)>/, thumbBlock) || "";
      let cover =
        kalaAttr(thumbImg, "data-original") ||
        kalaAttr(thumbImg, "src") ||
        "";
      cover = cover.trim();

      const author = kalaStripTags(
        kalaFirstGroup(/作者：([\s\S]*?)<\/p>/, html) || ""
      );
      const status = kalaStripTags(
        kalaFirstGroup(/状态：<span[^>]*>([\s\S]*?)<\/span>/, html) || ""
      );
      const updateTime = kalaStripTags(
        kalaFirstGroup(/更新：([\s\S]*?)<\/p>/, html) || ""
      );

      // tags: 类型：<a..>x</a> <a..>y</a>
      const tags = [];
      const typeBlock = kalaFirstGroup(/类型：([\s\S]*?)<\/p>/, html);
      if (typeBlock) {
        const re = /<a[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(typeBlock)) !== null) {
          const t = kalaStripTags(m[1]);
          if (t && tags.indexOf(t) === -1) tags.push(t);
        }
      }
      const area = kalaStripTags(
        kalaFirstGroup(/地区：<a[^>]*>([\s\S]*?)<\/a>/, html) || ""
      );
      if (area && tags.indexOf(area) === -1) tags.push(area);

      let description = kalaStripTags(
        kalaFirstGroup(
          /<span class="detail-content"[^>]*>([\s\S]*?)<\/span>/,
          html
        ) ||
          kalaFirstGroup(
            /<span class="detail-sketch"[^>]*>([\s\S]*?)<\/span>/,
            html
          ) ||
          ""
      );
      if (author) {
        description = "作者：" + author + "\n" + description;
      }

      // chapters: 各线路 <div id="playlist{n}"> ... <ul class="stui-content__playlist">
      // 同一部漫画常有多条线路(重复内容)，这里只取章节最多的一条，避免重复章节。
      const chapters = {};
      const order = [];
      const blockRe = /<div id="playlist(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
      const blocks = [];
      let bm;
      while ((bm = blockRe.exec(html)) !== null) {
        const body = bm[2];
        const count = (body.match(/<a href="\/chapter\//g) || []).length;
        blocks.push({ sid: bm[1], body: body, count: count });
      }
      let best = null;
      for (const b of blocks) {
        if (!best || b.count > best.count) best = b;
      }
      if (best) {
        const re =
          /<a href="\/chapter\/(\d+)-(\d+)-(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(best.body)) !== null) {
          const chId = m[1] + "-" + m[2] + "-" + m[3];
          const name = kalaStripTags(m[4]) || m[3];
          if (chapters[chId]) continue;
          chapters[chId] = name;
          order.push({ id: chId, nid: parseInt(m[3], 10) });
        }
      }
      order.sort((a, b) => b.nid - a.nid);
      const orderedChapters = {};
      for (const o of order) orderedChapters[o.id] = chapters[o.id];

      return new ComicDetails({
        title: title,
        cover: cover,
        description: description,
        tags: { 类型: tags },
        chapters: orderedChapters,
        uploader: author || undefined,
        updateTime: updateTime || undefined,
        subtitle: status || undefined,
        subTitle: status || undefined,
        url: url,
      });
    },

    loadEp: async (comicId, epId) => {
      if (!epId) throw "kalamanhua: missing chapter id";
      const chapterUrl = KALA_BASE + "/chapter/" + epId + ".html";
      const html = await kalaGet(chapterUrl);

      const playerRaw = kalaFirstGroup(
        /var player_aaaa=(\{[\s\S]*?\});<\/script>/,
        html
      );
      if (!playerRaw) throw "kalamanhua: player data not found";
      const playPath = kalaFirstGroup(/"url":"([^"]+)"/, playerRaw);
      if (!playPath) throw "kalamanhua: play url not found";

      const playUrl = KALA_IMG + "/play/min/" + playPath;
      let page = await kalaImgGet(playUrl, chapterUrl);

      const tok = /var token\s*=\s*'([^']+)'/.exec(page);
      if (tok) {
        page = await kalaImgGet(playUrl + "?cf_verify=" + tok[1], chapterUrl);
      }

      const images = [];
      const seen = {};
      const re = /data-src="([^"]+)"/g;
      let m;
      while ((m = re.exec(page)) !== null) {
        let src = kalaDecodeEntities(m[1]).trim();
        if (!src) continue;
        if (src.startsWith("data:")) continue;
        if (src.startsWith("//")) src = "https:" + src;
        else if (src.startsWith("/")) src = KALA_IMG + src;
        if (seen[src]) continue;
        seen[src] = true;
        images.push(src);
      }
      if (!images.length) {
        const re2 = /<img[^>]+src="([^"]+)"/g;
        while ((m = re2.exec(page)) !== null) {
          let src = kalaDecodeEntities(m[1]).trim();
          if (!src || src.startsWith("data:")) continue;
          if (src.startsWith("//")) src = "https:" + src;
          else if (src.startsWith("/")) src = KALA_IMG + src;
          if (seen[src]) continue;
          seen[src] = true;
          images.push(src);
        }
      }
      return { images: images };
    },

    onImageLoad: (url, comicId, epId) => {
      return {
        url: url,
        headers: {
          referer: KALA_REFERER,
          "user-agent": KALA_UA,
        },
      };
    },

    onThumbnailLoad: (url) => {
      const cfg = { url: url };
      if (url && url.indexOf("kalaimg.top") !== -1) {
        cfg.headers = {
          referer: KALA_REFERER,
          "user-agent": KALA_UA,
        };
      }
      return cfg;
    },

    idMatch: "/comic/(\\d+)\\.html",

    link: {
      domains: ["kalamanhua.com", "www.kalamanhua.com"],
      linkToId: (url) => {
        const m = /\/comic\/(\d+)\.html/.exec(url || "");
        return m ? m[1] : null;
      },
    },
  };

  translation = {
    zh_CN: {},
    zh_TW: {},
    en: {
      推荐: "Explore",
      最新更新: "Latest",
      韩漫: "Korean",
      日漫: "Japanese",
      中漫: "Chinese",
      欧美漫: "Western",
      其他: "Others",
      卡拉漫画: "Kalamanhua",
      分类: "Categories",
      全部: "All",
    },
  };
}
