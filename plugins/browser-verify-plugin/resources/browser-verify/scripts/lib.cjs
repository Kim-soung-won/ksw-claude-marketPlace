// 브라우저 점검 공통 모듈.
// 점검 스크립트는 이 파일을 require 해서 접속·측정·스크린샷을 한다.
// 환경 변수: BV_WORK(작업 폴더, playwright-core 와 shots/ 가 있는 곳), BV_PORT(디버깅 포트, 기본 9333)

const path = require("node:path");

const WORK = process.env.BV_WORK || process.cwd();
const PORT = process.env.BV_PORT || "9333";

// playwright-core 는 플러그인 폴더가 아니라 작업 폴더에 설치돼 있다
const { chromium } = require(
  require.resolve("playwright-core", { paths: [WORK, process.cwd()] }),
);

/** 떠 있는 임시 Chrome 에 접속한다. 브라우저를 새로 띄우지 않으므로 로그인 상태가 유지된다. */
async function connect() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || (await ctx.newPage());
  page.setDefaultTimeout(8000);
  return { browser, ctx, page };
}

/** 스크린샷을 작업 폴더의 shots/ 에 저장한다. 저장만 하며, 내용을 보려면 파일을 따로 열어야 한다. */
const shot = (page, name) =>
  page.screenshot({ path: path.join(WORK, "shots", `${name}.png`) });

/** 지금 포커스가 있는 요소를 요약한다. */
const active = (page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    if (!e) return null;
    return {
      tag: e.tagName,
      role: e.getAttribute("role"),
      cls: String(e.className).replace(/\s+/g, " ").trim().slice(0, 80),
      text: (e.innerText || e.value || "").trim().slice(0, 40),
      label: e.getAttribute("aria-label"),
    };
  });

/**
 * 네트워크 요청을 기록한다. mutations() 는 GET 이 아닌 요청만 돌려준다 —
 * 조작 뒤 서버 데이터를 바꾸지 않았는지 확인하는 데 쓴다.
 * 인증 토큰 갱신처럼 조작과 무관한 요청은 ignore 정규식으로 뺀다(예: { ignore: /auth\/refresh/ }).
 */
function watchRequests(page, { ignore = null } = {}) {
  const all = [];
  page.on("request", (r) => {
    if (!/xhr|fetch/.test(r.resourceType())) return;
    const line = `${r.method()} ${r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 160)}`;
    if (!ignore || !ignore.test(line)) all.push(line);
  });
  return {
    all,
    clear: () => {
      all.length = 0;
    },
    mutations: () => all.filter((l) => !l.startsWith("GET ")),
  };
}

/** 화면 요소의 class 에서 정규식에 맞는 토큰을 모은다. 시험 빌드가 로드됐는지 확인하는 데 쓴다. */
const classTokens = (page, pattern) =>
  page.evaluate((src) => {
    const re = new RegExp(src);
    const out = new Set();
    for (const el of document.querySelectorAll("[class]"))
      for (const c of el.classList) if (re.test(c)) out.add(c);
    return [...out];
  }, pattern.source);

/** 처음 보는 화면의 구성을 뽑는다. 조작 전에 선택자를 정하는 근거로 쓴다. */
const survey = (page, rootSelector = "body") =>
  page.evaluate((sel) => {
    const m = document.querySelector(sel) || document.body;
    const q = (s) => [...m.querySelectorAll(s)];
    const name = (b) =>
      (b.innerText || b.getAttribute("aria-label") || b.title || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 16);
    return {
      buttons: [
        ...new Set(
          q('button,[role="button"]').map(
            (b) =>
              `${name(b) || "(이름 없음)"}|${String(b.className).replace(/\s+/g, " ").trim().slice(0, 28)}`,
          ),
        ),
      ].slice(0, 40),
      inputs: q("input,textarea,select").map(
        (e) =>
          `${e.tagName}|${e.type || ""}|${e.name || e.id || ""}|${e.getAttribute("aria-label") || e.placeholder || ""}`.slice(0, 70),
      ).slice(0, 40),
      tabs: q('[role="tab"]').map((t) => `${t.innerText.trim().slice(0, 12)}:${t.getAttribute("aria-selected")}`),
      tableHeads: q("th").map((t) => t.innerText.trim().slice(0, 12)).slice(0, 20),
      rows: q("tbody tr").length,
      dialogs: q('[role="dialog"],[role="alertdialog"]').length,
      sliders: q('[role="slider"]').length,
      separators: q('[role="separator"]').length,
      text: m.innerText.replace(/\n+/g, " | ").slice(0, 400),
    };
  }, rootSelector);

/** selector 로 찾은 요소 중 마지막 것(가장 위에 뜬 것) 안에 포커스가 있는지. */
const focusInside = (page, selector) =>
  page.evaluate((sel) => {
    const els = [...document.querySelectorAll(sel)];
    const d = els[els.length - 1];
    return !!d && d.contains(document.activeElement);
  }, selector);

/**
 * Tab 을 times 번 누르며 포커스가 selector 밖으로 나가는지 본다.
 * 날짜 입력처럼 내부 칸마다 Tab 이 필요한 요소가 있으므로 횟수를 넉넉히 준다.
 */
async function tabTrap(page, selector, times = 30) {
  const seq = [];
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("Tab");
    const a = await active(page);
    seq.push(`${a?.tag}:${(a?.label || a?.text || a?.cls || "").slice(0, 18)}`);
    if (!(await focusInside(page, selector)))
      return { escaped: true, afterTabs: i + 1, landedOn: a, seq: seq.slice(0, 12) };
  }
  return { escaped: false, seq: seq.slice(0, 12) };
}

/**
 * IME 조합 중에 누른 Enter 를 흉내 낸다(isComposing + keyCode 229).
 * 실제 입력기 조합이 아니라 합성 이벤트다 — 보고서에 그렇게 적는다.
 */
const composingEnter = (locator) =>
  locator.evaluate((el) =>
    el.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 229,
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    ),
  );

/** 포커스가 있는 요소에 포커스 표시가 실제로 그려지는지(계산된 스타일). */
const focusStyle = (page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    const cs = getComputedStyle(e);
    return {
      el: `${e.tagName}.${String(e.className).replace(/\s+/g, " ").trim().slice(0, 30)}`,
      focusVisible: e.matches(":focus-visible"),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow.slice(0, 60),
      // 투명 outline 은 고대비 모드용 자리표시라 보이는 표시로 치지 않는다
      hasIndicator:
        (cs.outlineStyle !== "none" && !/rgba\(.*,\s*0\)$|transparent/.test(cs.outlineColor)) ||
        cs.boxShadow !== "none",
    };
  });

/**
 * 레이아웃 넘침을 수치로 잰다.
 * - hScroll: 가로로 스크롤되는 영역(scrollWidth > clientWidth)
 * - overflowing: 부모의 오른쪽 끝을 넘은 요소
 * - clipped: 말줄임 없이 잘린 글자(overflow hidden 인데 text-overflow 가 clip)
 */
const overflowReport = (page, rootSelector = "body") =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const all = [root, ...root.querySelectorAll("*")];
    const id = (e) => `${e.tagName.toLowerCase()}.${String(e.className).replace(/\s+/g, ".").slice(0, 40)}`;
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const hScroll = [];
    const overflowing = [];
    const clipped = [];
    for (const e of all) {
      if (!visible(e)) continue;
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1) {
        if (/(auto|scroll)/.test(cs.overflowX)) hScroll.push(`${id(e)} ${e.scrollWidth}>${e.clientWidth}`);
        else if (/(hidden|clip)/.test(cs.overflowX) && cs.textOverflow === "clip" && e.children.length === 0 && e.innerText.trim())
          clipped.push(`${id(e)} "${e.innerText.trim().slice(0, 20)}"`);
      }
      const p = e.parentElement;
      if (p && e !== root && cs.position !== "absolute" && cs.position !== "fixed") {
        const pr = p.getBoundingClientRect();
        const r = e.getBoundingClientRect();
        const over = Math.round(r.right - pr.right);
        if (over > 1 && !/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX))
          overflowing.push(`${id(e)} +${over}px (부모 ${id(p)})`);
      }
    }
    return {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      hScroll: hScroll.slice(0, 10),
      overflowing: overflowing.slice(0, 15),
      clipped: clipped.slice(0, 10),
    };
  }, rootSelector);

/** 창 폭을 바꿔 가며 fn 을 실행한다. 끝나면 원래 폭으로 되돌린다. */
async function withWidths(page, widths, fn, { height = 900 } = {}) {
  const original = page.viewportSize();
  const out = {};
  try {
    for (const w of widths) {
      await page.setViewportSize({ width: w, height });
      out[w] = await fn(w);
    }
  } finally {
    if (original) await page.setViewportSize(original);
  }
  return out;
}

/**
 * layout shift 를 기록하기 시작한다. 이동(goto) 전에 호출해야 로딩 중의 이동까지 잡힌다.
 * collectLayoutShifts 로 결과를 읽는다. 사용자 입력 직후 0.5초 안의 이동은 hadRecentInput 으로 구분된다.
 */
const startLayoutShiftWatch = (page) =>
  page.addInitScript(() => {
    window.__bvShifts = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          window.__bvShifts.push({
            value: +e.value.toFixed(4),
            at: Math.round(e.startTime),
            hadRecentInput: e.hadRecentInput,
            nodes: (e.sources || [])
              .map((s) => (s.node && s.node.nodeType === 1 ? `${s.node.tagName.toLowerCase()}.${String(s.node.className).replace(/\s+/g, ".").slice(0, 40)}` : null))
              .filter(Boolean)
              .slice(0, 3),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_) {
      window.__bvShifts = null; // 이 브라우저는 layout-shift 기록을 지원하지 않는다
    }
  });

const collectLayoutShifts = (page) =>
  page.evaluate(() => {
    const s = window.__bvShifts;
    if (s === null || s === undefined) return { supported: false };
    const unexpected = s.filter((e) => !e.hadRecentInput);
    return {
      supported: true,
      count: s.length,
      cls: +unexpected.reduce((a, e) => a + e.value, 0).toFixed(4),
      largest: [...unexpected].sort((a, b) => b.value - a.value).slice(0, 5),
    };
  });

/** 결과를 JSON 으로 출력하고 접속을 끊는다(브라우저는 닫지 않는다). */
async function finish(browser, out) {
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
}

module.exports = {
  WORK,
  connect,
  shot,
  active,
  watchRequests,
  classTokens,
  survey,
  focusInside,
  tabTrap,
  composingEnter,
  focusStyle,
  overflowReport,
  withWidths,
  startLayoutShiftWatch,
  collectLayoutShifts,
  finish,
};
