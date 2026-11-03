# Python 관용구

적용 대상: `.py` 파일, `#!/usr/bin/env python3`·`#!/usr/bin/python3` shebang, `python -m <모듈>`로 실행하는 진입점.

## 1. 종료와 예외

| 관용구 | 실제 동작 | 순서도 반영 |
|---|---|---|
| `sys.exit(n)` | `SystemExit` 예외를 던진다. `finally`·`with` 정리는 실행된다. `except Exception`에는 잡히지 않지만 맨 `except:`·`except BaseException`에는 잡혀 **종료가 취소**될 수 있다 | 종료 노드. 감싸는 맨 `except:`가 있으면 '주의할 점' |
| `sys.exit("메시지")` | 메시지를 stderr에 쓰고 종료 코드 1 | 오류 종료 노드 |
| `os._exit(n)` | 정리 코드 없이 즉시 종료 | 종료 노드 라벨에 "(정리 생략)" |
| 처리되지 않은 예외 | traceback 출력, 종료 코드 1. 호출 스택을 거슬러 올라가며 중간 `finally`를 실행 | 예외가 날 수 있는 단계들을 오류 종료 노드 하나로 모은다. 단계마다 그리지 않는다 |
| `except Exception: pass`, `except ...: log(...)` | 실패를 삼키고 다음 줄로 진행. 셸의 `\|\| true`에 해당 | 분기 없이 "(실패 무시)" 라벨 |
| `try: ... finally: 복원()` | 성공·실패·`sys.exit` 모두에서 실행 | `restore` 노드를 정상·오류 경로 양쪽에 연결 |
| `argparse` | 인자 오류면 종료 코드 2, `--help`면 0으로 **파싱 단계에서** 종료 | 시작 직후 종료 간선(인자 오류) |

## 2. 외부 명령 실행

| 관용구 | 실제 동작 | 순서도 반영 |
|---|---|---|
| `subprocess.run(cmd)` | 실패해도 예외 없음. `returncode`를 검사하지 않으면 실패를 모르고 진행 | 검사가 없으면 "(실패 무시)" |
| `subprocess.run(cmd, check=True)` | 0이 아니면 `CalledProcessError`. 잡지 않으면 스크립트 종료 | 오류 종료 간선 |
| `subprocess.check_output(...)` | `check=True`와 같고 출력을 반환 | 위와 같음 |
| `subprocess.call`·`os.system` | 종료 코드를 반환만 함 | 반환값 검사 분기가 있는지 확인 |
| `shell=True` | 문자열을 셸이 해석(파이프·glob·변수 확장). 셸 관용구가 함께 적용된다 | 해설 표에 실제 명령 인용 |
| `timeout=` | 초과 시 `TimeoutExpired` | 오류 종료 또는 재시도 분기 |

## 3. 진입점과 자원 관리

| 관용구 | 실제 동작 | 순서도 반영 |
|---|---|---|
| `if __name__ == "__main__": main()` | 직접 실행할 때만 `main()` 실행. 모듈 최상위 코드는 import 때도 실행된다 | 순서도는 `main()`에서 시작. 최상위에 부수효과가 있으면 '주의할 점' |
| `with open(p, "w") as f:` | 여는 순간 파일을 **비운다**. 쓰기 도중 예외가 나도 닫히지만 내용은 일부만 남는다 | 부수효과 표에 "실패 시 부분 기록" |
| `with 잠금/연결:` | 예외가 나도 해제·종료 | 정리 단계는 그리지 않고 해설만 |
| `atexit.register(f)` | 정상 종료·`sys.exit` 때 실행, `os._exit`·시그널 강제 종료에는 실행 안 됨 | 다이어그램 아래 한 줄 설명 |

## 4. 위험 패턴

분류·등급·완화 장치 판정은 `../risky-commands.md`를 따른다. Python에서 특히 놓치기 쉬운 형태만 적는다.

- `shutil.rmtree(path)`·`os.remove` — `path`가 빈 문자열·`"."`·상위 경로로 계산될 수 있는지 본다.
- `open(p, "w")`·`Path.write_text` — 여는 즉시 비운다. 임시 파일에 쓰고 `os.replace`로 바꾸는지 본다.
- `subprocess.run(..., shell=True)`에 외부 입력을 넣는 문자열 조합 — 셸 위험 패턴이 그대로 적용된다.
- `tempfile` 대신 `/tmp/고정이름` 사용, 비밀값 `print`·하드코딩.

## 5. 순서도 반영 요약

- `main()` 기준으로 그리고, 모든 `sys.exit`와 "처리되지 않은 예외" 종료를 표시한다.
- 넓은 `except`로 실패를 삼키는 지점은 "(실패 무시)" 라벨과 '주의할 점'.
- `finally`·`with` 정리는 정상·오류 경로가 모두 지나가는 `restore` 노드.
- `subprocess` 호출은 `check` 여부에 따라 오류 간선 유무가 달라진다.
- 위험 패턴 노드는 `⚠️` 라벨과 `danger`/`guarded` 클래스.

## 6. 정적 점검

1. 문법: `python3 -m py_compile <파일>`. 항상 실행한다.
2. 프로젝트에 이미 설정된 린터(ruff, pyflakes 등)가 있으면 그것을 실행해 경고를 '주의할 점'에 요약한다.
   새로 설치하지 않는다.
