// 예시: 다이얼로그 하나를 점검하는 스크립트. 따라야 할 틀이 아니라 형식 참고용이다.
// 무엇을 잴지는 이번 변경의 위험 가설에서 정한다 — 아래 다섯 단계가 모든 화면에 맞지는 않는다.
// 사용: 작업 폴더로 복사해 고친 뒤 BV_WORK=<작업 폴더> BV_LIB=<이 폴더>/lib.cjs node <복사한 파일>.cjs
//
// 스크립트를 직접 쓸 때 도움이 되는 습관
// - 조작할 때마다 화면에서 값을 읽어 out 에 담는다. 판정은 출력된 JSON 으로 한다.
// - 중간에 실패해도 그때까지의 결과가 출력되도록 try/catch 로 감싼다.
// - 저장·삭제처럼 서버 데이터를 바꾸는 버튼은 누르지 않는다. 확인 창은 Escape 로 닫는다.
// - 끝에 req.mutations() 가 비어 있는지 확인한다.

const lib = require(process.env.BV_LIB || "./lib.cjs");

const URL = "http://localhost:0000/path"; // 점검할 주소
const DIALOG = '[role="dialog"]'; // 가두기를 확인할 오버레이 선택자

(async () => {
  const { browser, page } = await lib.connect();
  const req = lib.watchRequests(page);
  const out = {};
  try {
    await page.goto(URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    // 1. 여는 버튼에 포커스를 두고 키보드로 연다 (마우스 클릭이 아니라 Enter)
    const opener = page.locator("button", { hasText: "열기" }).first();
    await opener.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);

    // 2. 포커스가 안으로 들어갔는지, Tab 이 밖으로 나가는지
    out.focusInside = await lib.focusInside(page, DIALOG);
    out.activeOnOpen = await lib.active(page);
    out.tabTrap = await lib.tabTrap(page, DIALOG, 30);
    out.focusStyle = await lib.focusStyle(page);

    // 3. 폭별 넘침 — 다이얼로그는 창이 좁아질 때 깨지는 경우가 많다
    out.overflow = await lib.withWidths(page, [1440, 1024, 768, 480], async (w) => {
      await page.waitForTimeout(400);
      await lib.shot(page, `dialog-${w}`);
      return lib.overflowReport(page, DIALOG);
    });

    // 4. Esc 로 닫히고 포커스가 여는 버튼으로 돌아오는지
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    out.closed = (await page.locator(DIALOG).count()) === 0;
    out.focusReturned = await lib.active(page);
    out.bodyStyleAfter = await page.evaluate(() => document.body.getAttribute("style"));

    // 5. 서버 데이터를 바꾸지 않았는지
    out.mutations = req.mutations();
  } catch (e) {
    out.ERROR = e.message.slice(0, 400);
    await lib.shot(page, "error").catch(() => {});
  }
  await lib.finish(browser, out);
})();
