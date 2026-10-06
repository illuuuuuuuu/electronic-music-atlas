(() => {
  "use strict";

  const app = document.querySelector("#app");
  const dialog = document.querySelector("#search-dialog");
  const searchInput = document.querySelector("#global-search");
  const searchResults = document.querySelector("#search-results");
  let data;
  let nodes;
  let children;

  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const normalize = value => String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’'`·._\-\s/（）()]/g, "");

  const byId = id => nodes.get(id);

  const pathFor = node => {
    const path = [];
    let current = node;
    const visited = new Set();
    while (current && !visited.has(current.id)) {
      path.unshift(current);
      visited.add(current.id);
      current = current.parent ? byId(current.parent) : null;
    }
    return path;
  };

  const descendantCount = id => data.nodes.filter(node => node.chapter === id && node.id !== id).length;

  const navigate = id => {
    location.hash = id ? `#/genre/${encodeURIComponent(id)}` : "#/";
  };

  const setActiveNav = key => {
    document.querySelectorAll("[data-nav]").forEach(item => item.classList.toggle("is-active", item.dataset.nav === key));
  };

  const renderHome = () => {
    setActiveNav("atlas");
    document.title = "电音风格图鉴";
    const cards = data.rootIds.map((id, index) => {
      const node = byId(id);
      return `<button class="chapter-card" type="button" data-open="${node.id}">
        <span class="card-top"><span>${String(index + 1).padStart(2, "0")}</span><span>↗</span></span>
        <strong class="card-title">${escapeHtml(node.name)}</strong>
        <span class="card-count">${descendantCount(id)} 个曲风</span>
      </button>`;
    }).join("");

    app.innerHTML = `<section class="page">
      <div class="hero">
        <div>
          <div class="eyebrow">Electronic music field guide</div>
          <h1>从一个篇章，进入声音的谱系。</h1>
        </div>
        <p class="hero-note">选择 16 个一级分类中的一个，继续进入它的下一级。这里只保留分类关系、别名和代表曲目，让复杂的谱系更容易查阅。</p>
      </div>
      <div class="stats">
        <span><b>${data.stats.chapters}</b> 个一级分类</span>
        <span><b>${data.stats.genres}</b> 个曲风条目</span>
        <span><b>${data.stats.tracks}</b> 条推荐曲目记录</span>
      </div>
      <div class="section-head"><h2>全部篇章</h2><span>点击进入</span></div>
      <div class="chapter-grid">${cards}</div>
      <p class="source-note">分类关系依据项目文档的分级标题整理。上位与下位表示影响或衍生关系，不一定等同于页面目录的父子关系。</p>
    </section>`;
  };

  const clickableTag = (value, chapterId) => {
    const target = findExact(value, chapterId);
    if (target) return `<button class="tag" type="button" data-open="${target.id}">${escapeHtml(value)}</button>`;
    return `<span class="tag">${escapeHtml(value)}</span>`;
  };

  const relationBlock = (label, values, chapterId) => `<div class="detail-label">${label}</div>${
    values.length ? `<div class="tag-row">${values.map(value => clickableTag(value, chapterId)).join("")}</div>` : `<div class="empty-value">暂无记录</div>`
  }`;

  const renderNode = id => {
    const node = byId(id);
    if (!node) return renderNotFound();
    setActiveNav("atlas");
    document.title = `${node.name}｜电音风格图鉴`;
    const path = pathFor(node);
    const childNodes = children.get(node.id) || [];
    const breadcrumbs = [`<a href="#/">首页</a>`].concat(path.map((item, index) => {
      const isLast = index === path.length - 1;
      return isLast ? `<span>${escapeHtml(item.name)}</span>` : `<a href="#/genre/${encodeURIComponent(item.id)}">${escapeHtml(item.name)}</a>`;
    })).join(`<i>/</i>`);
    const cards = childNodes.map(child => `<button class="sub-card" type="button" data-open="${child.id}">
      <strong>${escapeHtml(child.name)}</strong>
      <span>${child.childCount ? `${child.childCount} 个下级分类` : "查看关系与曲目"}</span>
    </button>`).join("");
    const chapter = byId(node.chapter);
    const aliases = node.aliases.length
      ? `<div class="tag-row">${node.aliases.map(alias => `<span class="tag">${escapeHtml(alias)}</span>`).join("")}</div>`
      : `<div class="empty-value">暂无别名</div>`;
    const tracks = node.tracks.length
      ? `<ol class="track-list">${node.tracks.map((track, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span><span>${escapeHtml(track)}</span></li>`).join("")}</ol>`
      : `<p class="no-tracks">这个条目暂时没有提取到推荐歌曲，之后可以继续补充。</p>`;
    const totalBelow = node.level === 0 ? descendantCount(node.id) : childNodes.length;

    app.innerHTML = `<section class="page">
      <nav class="breadcrumbs" aria-label="当前位置">${breadcrumbs}</nav>
      <div class="node-heading">
        <div>
          <div class="eyebrow">${escapeHtml(chapter.name)} · Level ${node.level}</div>
          <h1>${escapeHtml(node.name)}</h1>
        </div>
        <p class="node-summary">${childNodes.length ? `继续选择下一级分类；当前条目下有 ${totalBelow} 个${node.level === 0 ? "曲风" : "直接子类"}。` : "这里已经是当前目录路径的末级，可查看它的别名、关联关系与代表曲目。"}</p>
      </div>
      ${childNodes.length ? `<div class="section-head"><h2>下一级分类</h2><span>${childNodes.length} 个入口</span></div><div class="subgrid">${cards}</div>` : ""}
      ${node.level > 0 ? `<article class="detail-panel">
        <div class="detail-column">
          <div class="detail-label">别名 A.K.A.</div>${aliases}
          ${relationBlock("上位影响", node.upper, node.chapter)}
          ${relationBlock("下位衍生", node.lower, node.chapter)}
          ${relationBlock("相近曲风 Related To", node.related, node.chapter)}
        </div>
        <div class="detail-column">
          <div class="section-head" style="margin-top:0"><h3>推荐歌曲</h3><span>最多三首</span></div>
          ${tracks}
        </div>
      </article>` : ""}
    </section>`;
  };

  const renderAbout = () => {
    setActiveNav("about");
    document.title = "关于本站｜电音风格图鉴";
    app.innerHTML = `<section class="page about">
      <div class="eyebrow">About this atlas</div>
      <h1>关于本站</h1>
      <div class="about-list">
        <div class="about-row">
          <div class="about-key">维护</div>
          <div class="about-value">Illusix Liu</div>
        </div>
        <div class="about-row">
          <div class="about-key">内容</div>
          <div class="about-value">
            <div class="about-data">
              <div><strong>${data.stats.chapters}</strong><span>一级篇章</span></div>
              <div><strong>${data.stats.genres}</strong><span>曲风条目</span></div>
              <div><strong>${data.stats.maxLevel}</strong><span>最深子层级</span></div>
            </div>
          </div>
        </div>
        <div class="about-row">
          <div class="about-key">资料来源</div>
          <div class="about-value"><a class="about-link" href="https://b23.tv/0pENheJ" target="_blank" rel="noopener noreferrer">【全网最全！1000+个电音风格/标签科普介绍视频丨共计6个小时的电音宇宙漫游指南第四期！-哔哩哔哩】</a></div>
        </div>
        <div class="about-row">
          <div class="about-key">反馈</div>
          <div class="about-value">如有错误请前往 <a class="about-link" href="https://github.com/" target="_blank" rel="noopener noreferrer">GitHub 反馈</a></div>
        </div>
      </div>
    </section>`;
  };

  const renderConcerts = () => {
    setActiveNav("concerts");
    document.title = "线上音乐会｜电音风格图鉴";
    app.innerHTML = `<section class="page utility-page">
      <div class="utility-heading">
        <div>
          <div class="eyebrow">Live electronic music</div>
          <h1>线上音乐会</h1>
        </div>
        <p>2026 年举行的五场线上演出，共覆盖 12 种电子音乐风格。点击任意场次，可查看完整信息。</p>
      </div>
      <div class="concert-stats" aria-label="演出统计">
        <span><b>5</b> 场演出</span><span><b>12</b> 种曲风</span><span><b>580</b> 人参与</span>
      </div>
      <div class="concert-list" aria-label="2026 年线上音乐会记录">
        <details class="concert-item">
          <summary>
            <span class="concert-date"><b>08月07日</b><span>20:00</span></span>
            <span class="concert-main"><strong>坠入光海 <i>Falling Into Light</i></strong><small>从明亮上升到情绪释放的旋律低音之夜</small></span>
            <span class="concert-arrow" aria-hidden="true">↗</span>
          </summary>
          <div class="concert-detail">
            <p>从轻盈的 Future Bass 出发，逐渐进入更厚重的 Melodic Bass，最后在兼具爆发力与抒情感的 Melodic Dubstep 中完成情绪释放。</p>
            <div class="concert-tags"><span>Future Bass</span><span>Melodic Bass</span><span>Melodic Dubstep</span></div>
            <div class="concert-meta"><span><b>13 首</b>曲目数量</span><span><b>约 61 分钟</b>总时长</span><span><b>212 人</b>参与人数</span><span><b>无回放</b>回放状态</span></div>
          </div>
        </details>
        <details class="concert-item">
          <summary>
            <span class="concert-date"><b>06月20日</b><span>21:00</span></span>
            <span class="concert-main"><strong>失重急流 <i>Weightless Rush</i></strong><small>高速碎拍、低频与持续向前的冲刺感</small></span>
            <span class="concert-arrow" aria-hidden="true">↗</span>
          </summary>
          <div class="concert-detail">
            <p>以流畅而现代的 Drum &amp; Bass 建立速度，随后进入更加粗粝、自由且充满切分感的 Jungle，是五场演出中节奏密度最高的一场。</p>
            <div class="concert-tags"><span>Drum &amp; Bass</span><span>Jungle</span></div>
            <div class="concert-meta"><span><b>15 首</b>曲目数量</span><span><b>约 59 分钟</b>总时长</span><span><b>168 人</b>参与人数</span><span><b>无回放</b>回放状态</span></div>
          </div>
        </details>
        <details class="concert-item">
          <summary>
            <span class="concert-date"><b>05月02日</b><span>20:30</span></span>
            <span class="concert-main"><strong>零点地下层 <i>Floor Below Zero</i></strong><small>机械节奏与酸性合成器构成的地下空间</small></span>
            <span class="concert-arrow" aria-hidden="true">↗</span>
          </summary>
          <div class="concert-detail">
            <p>用简洁、机械且持续推进的 Techno 建立空间，再逐渐引入 Acid Techno 标志性的酸性合成器线条，在音色变化中不断增加压力。</p>
            <div class="concert-tags"><span>Techno</span><span>Acid Techno</span></div>
            <div class="concert-meta"><span><b>12 首</b>曲目数量</span><span><b>约 62 分钟</b>总时长</span><span><b>109 人</b>参与人数</span><span><b>无回放</b>回放状态</span></div>
          </div>
        </details>
        <details class="concert-item">
          <summary>
            <span class="concert-date"><b>02月20日</b><span>21:00</span></span>
            <span class="concert-main"><strong>霓虹转速 <i>Neon RPM</i></strong><small>复古合成器、稳定四拍与华丽舞池律动</small></span>
            <span class="concert-arrow" aria-hidden="true">↗</span>
          </summary>
          <div class="concert-detail">
            <p>Italo Disco 带来八十年代未来感，Hi-NRG 将速度和能量推高，再由 Nu-Disco 衔接到更现代、更精致的制作质感。</p>
            <div class="concert-tags"><span>Italo Disco</span><span>Hi-NRG</span><span>Nu-Disco</span></div>
            <div class="concert-meta"><span><b>15 首</b>曲目数量</span><span><b>约 60 分钟</b>总时长</span><span><b>54 人</b>参与人数</span><span><b>无回放</b>回放状态</span></div>
          </div>
        </details>
        <details class="concert-item">
          <summary>
            <span class="concert-date"><b>01月02日</b><span>22:00</span></span>
            <span class="concert-main"><strong>凌晨四点的空气 <i>4AM Air</i></strong><small>在环境声与缓慢鼓点中逐渐沉入深夜</small></span>
            <span class="concert-arrow" aria-hidden="true">↗</span>
          </summary>
          <div class="concert-detail">
            <p>以 Ambient 的空间感和环境声音开场，再通过 Downtempo 加入缓慢的鼓点与低频，不追求高潮，更像一段逐渐沉入梦境的声音旅程。</p>
            <div class="concert-tags"><span>Ambient</span><span>Downtempo</span></div>
            <div class="concert-meta"><span><b>11 首</b>曲目数量</span><span><b>约 63 分钟</b>总时长</span><span><b>37 人</b>参与人数</span><span><b>无回放</b>回放状态</span></div>
          </div>
        </details>
      </div>
    </section>`;
  };

  const renderSubmit = () => {
    setActiveNav("submit");
    document.title = "作品投稿｜电音风格图鉴";
    app.innerHTML = `<section class="page utility-page">
      <div class="utility-heading">
        <div>
          <div class="eyebrow">Share your track</div>
          <h1>作品投稿</h1>
        </div>
        <p>如果您也在从事电子音乐创作，欢迎将作品发送给我们。我们将逐步收集并整理大家的投稿，在作品数量达到一定规模后，策划举办一场线上音乐会进行集中展示。演出时间确定后，我们会通过您留下的邮箱另行通知。</p>
      </div>
      <div class="submission-grid">
        <article class="submission-card">
          <span class="card-number">01</span>
          <h2>准备投稿内容</h2>
          <ul>
            <li>作品名称 - 制作人</li>
            <li>音频文件或公开试听链接</li>
            <li>您认为合适的曲风标签</li>
            <li>一段简短的作品说明</li>
            <li>可以联系到您的邮箱</li>
          </ul>
        </article>
        <article class="submission-card submission-contact">
          <span class="card-number">02</span>
          <h2>发送作品</h2>
          <div class="submission-status">
            <span class="status-dot" aria-hidden="true"></span>
            <div>
              <span class="submission-label">投稿邮箱</span>
              <a class="submission-email" href="mailto:3273955540@qq.com?subject=电音作品投稿">3273955540@qq.com</a>
            </div>
          </div>
          <p class="submission-note">若邮件发送后 3 天内未收到回复邮件，请添加 QQ：3273955540</p>
        </article>
      </div>
    </section>`;
  };

  const renderNotFound = () => {
    setActiveNav("atlas");
    app.innerHTML = `<section class="page"><div class="eyebrow">404</div><h1>没有找到这个曲风。</h1><p class="about-copy"><a href="#/">返回全部篇章</a></p></section>`;
  };

  const findExact = (query, chapterId) => {
    const needle = normalize(query.replace(/等$/, ""));
    if (!needle) return null;
    const matches = data.nodes.filter(node => [node.name, ...node.aliases].some(value => normalize(value) === needle));
    return matches.find(node => node.chapter === chapterId) || matches[0] || null;
  };

  const renderSearch = query => {
    const needle = normalize(query);
    if (!needle) {
      searchResults.innerHTML = `<div class="search-empty">输入名称、别名或关键词即可查找全部曲风。</div>`;
      return;
    }
    const scored = data.nodes.map(node => {
      const name = normalize(node.name);
      const aliases = node.aliases.map(normalize);
      let score = 0;
      if (name === needle) score = 100;
      else if (name.startsWith(needle)) score = 70;
      else if (name.includes(needle)) score = 45;
      else if (aliases.some(alias => alias === needle)) score = 60;
      else if (aliases.some(alias => alias.includes(needle))) score = 35;
      return { node, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name)).slice(0, 40);
    searchResults.innerHTML = scored.length ? scored.map(({ node }) => {
      const path = pathFor(node).map(item => item.name).join(" / ");
      return `<button class="result" type="button" data-open="${node.id}"><span><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(path)}</small></span><span>${node.childCount ? `${node.childCount} 子类` : "曲风"}</span></button>`;
    }).join("") : `<div class="search-empty">没有找到“${escapeHtml(query)}”。可以尝试英文名称或别名。</div>`;
  };

  const openSearch = () => {
    if (!dialog.open) dialog.showModal();
    renderSearch(searchInput.value);
    requestAnimationFrame(() => searchInput.focus());
  };

  const route = () => {
    if (!data) return;
    const hash = location.hash || "#/";
    if (hash === "#/" || hash === "#") renderHome();
    else if (hash === "#/concerts") renderConcerts();
    else if (hash === "#/submit") renderSubmit();
    else if (hash === "#/about") renderAbout();
    else if (hash.startsWith("#/genre/")) renderNode(decodeURIComponent(hash.slice(8)));
    else renderNotFound();
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  document.addEventListener("click", event => {
    const open = event.target.closest("[data-open]");
    if (open) {
      if (dialog.open) dialog.close();
      navigate(open.dataset.open);
    }
  });
  document.querySelector("#search-trigger").addEventListener("click", openSearch);
  document.querySelector("#mobile-home").addEventListener("click", () => navigate());
  searchInput.addEventListener("input", event => renderSearch(event.target.value));
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !dialog.open && !/input|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
  });
  window.addEventListener("hashchange", route);

  fetch("./genres.json")
    .then(response => {
      if (!response.ok) throw new Error(`资料载入失败（${response.status}）`);
      return response.json();
    })
    .then(payload => {
      data = payload;
      nodes = new Map(data.nodes.map(node => [node.id, node]));
      children = new Map();
      data.nodes.forEach(node => {
        if (!node.parent) return;
        if (!children.has(node.parent)) children.set(node.parent, []);
        children.get(node.parent).push(node);
      });
      document.querySelector("#rail-count").textContent = `${data.stats.genres} 个曲风条目`;
      route();
    })
    .catch(error => {
      app.innerHTML = `<div class="error">${escapeHtml(error.message)}。请稍后刷新页面。</div>`;
    });
})();
