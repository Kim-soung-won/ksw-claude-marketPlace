// 화면 구성 파악 + 기본 측정. 새 화면에서 가장 먼저 실행한다.
// 사용: BV_WORK=<작업 폴더> node survey.cjs <URL> [루트 선택자=body] [창 폭 목록=1440,1024,768,480]
// 출력: 화면 구성, 폭별 넘침, layout shift, 콘솔 오류, GET 이 아닌 요청 목록. 스크린샷은 shots/survey-<폭>.png 로 저장된다.

const lib = require("./lib.cjs");

(async () => {
  const [url, root = "body", widthsArg = "1440,1024,768,480"] = process.argv.slice(2);
  if (!url) {
    console.error("URL 을 첫 인자로 준다.");
    process.exit(1);
  }
  const widths = widthsArg.split(",").map(Number).filter(Boolean);
  const { browser, page } = await lib.connect();
  const req = lib.watchRequests(page);
  const out = { url };
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 160)}`));
  try {
    await lib.startLayoutShiftWatch(page);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    out.finalUrl = page.url();
    out.survey = await lib.survey(page, root);
    out.layoutShift = await lib.collectLayoutShifts(page);
    out.byWidth = await lib.withWidths(page, widths, async (w) => {
      await page.waitForTimeout(600);
      await lib.shot(page, `survey-${w}`);
      return lib.overflowReport(page, root);
    });
    out.consoleErrors = errors.slice(0, 10);
    out.mutations = req.mutations(); // 화면을 열기만 했다. 조회용 POST(검색 등)가 섞일 수 있으니 주소로 판단한다
  } catch (e) {
    out.ERROR = e.message.slice(0, 400);
    await lib.shot(page, "survey-error").catch(() => {});
  }
  await lib.finish(browser, out);
})();
