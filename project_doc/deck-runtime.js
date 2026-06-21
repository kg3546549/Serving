const colors = ["blue", "purple", "mint", "yellow", "pink"];

function topbar(index, section) {
  const mark = index === 0 ? "S//B" : String(index).padStart(2, "0");
  return `<div class="topbar"><div class="brand"><span class="mark">${mark}</span> STACK//BREACH</div><span class="tag">${section}</span></div>`;
}

function footer(index, total, label) {
  const progress = Math.round(((index + 1) / total) * 100);
  return `<div class="footer"><span>STACK//BREACH · ${label}</span><div class="progress"><i style="--p:${progress}%"></i></div><span>${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>`;
}

function cards(items, columns = 2) {
  return `<div class="grid cols${columns}">${items.map((item, i) => `
    <article class="card ${item.color || colors[i % colors.length]}">
      ${item.badge ? `<span class="pill">${item.badge}</span>` : ""}
      <h3${item.badge ? ' style="margin-top:15px"' : ""}>${item.title}</h3>
      ${item.html || `<p>${item.text}</p>`}
    </article>`).join("")}</div>`;
}

function architecture() {
  return `<div class="architecture"><i class="wire w1"></i><i class="wire w2"></i><i class="wire w3"></i>
    <span class="node n1">INGRESS</span><span class="node n2">ALB</span>
    <span class="node n3">EC2</span><span class="node n4">RDS</span><span class="node n5">EGRESS</span></div>`;
}

function renderCover(slide, index) {
  return `<section class="slide"><div class="frame cover">${topbar(index, slide.section)}
    <div class="${slide.visual ? "cover-grid" : ""}"><div><div class="kicker">${slide.kicker}</div>
    <h1 class="title large">${slide.title}</h1><p class="cover-copy">${slide.copy}</p>
    <div class="chips">${slide.chips.map(x => `<span class="pill">${x}</span>`).join("")}</div></div>
    ${slide.visual ? architecture() : ""}</div></div></section>`;
}

function renderStandard(slide, index, total, label) {
  let body = "";
  if (slide.type === "cards") body = cards(slide.items, slide.columns);
  if (slide.type === "loop") body = `<div class="loop">${slide.items.map((x, i) => `<article class="step"><span class="num" style="--accent:var(--${colors[i]})">${i + 1}</span><h3>${x.title}</h3><p>${x.text}</p></article>`).join("")}</div>${cards(slide.notes, 3)}`;
  if (slide.type === "timeline") body = `<div class="timeline">${slide.items.map((x, i) => `<article class="phase" style="--accent:var(--${colors[i % 5]})"><h3>${x.title}</h3><p>${x.text}</p></article>`).join("")}</div>${cards(slide.notes, 3)}`;
  if (slide.type === "table") body = `<table class="table"><thead><tr>${slide.headers.map(x => `<th>${x}</th>`).join("")}</tr></thead><tbody>${slide.rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  if (slide.type === "concept") body = `<div class="grid cols2"><article class="card blue"><h3>Visual Direction</h3>${slide.html}<div class="swatches">${slide.swatches.map(x => `<i class="swatch" style="background:${x}"></i>`).join("")}</div></article>${architecture()}</div>`;
  if (slide.type === "stage") body = `<div class="stage"><article class="card ${slide.color} stage-main"><div><div class="stage-no">${slide.number}</div><h3>${slide.stageTitle}</h3><p>${slide.summary}</p></div><span class="pill">${slide.badge}</span></article><div class="checks">${slide.checks.map(x => `<div class="check"><b>${x[0]}</b><span>${x[1]}</span></div>`).join("")}</div></div>`;
  return `<section class="slide"><div class="frame">${topbar(index, slide.section)}<h2 class="title">${slide.title}</h2>${slide.subtitle ? `<p class="subtitle">${slide.subtitle}</p>` : ""}<div class="content">${body}</div>${footer(index, total, label)}</div></section>`;
}

const deck = window.DECK;
document.body.innerHTML = deck.slides.map((slide, index) => slide.type === "cover"
  ? renderCover(slide, index)
  : renderStandard(slide, index, deck.slides.length, deck.label)).join("");

const requested = new URLSearchParams(location.search).get("slide");
if (requested !== null) {
  document.querySelectorAll(".slide").forEach((slide, index) => {
    slide.style.display = index === Number(requested) ? "block" : "none";
  });
  document.body.style.padding = "0";
  document.body.style.height = "720px";
  document.body.style.overflow = "hidden";
}
