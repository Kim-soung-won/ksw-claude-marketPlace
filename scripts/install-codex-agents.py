#!/usr/bin/env python3
"""선택한 플러그인의 Codex 에이전트를 등록한다. 기본은 미리보기다."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def render(template, plugin):
    data = json.loads(template.read_text())
    expected = {'name', 'description', 'sandbox_mode', 'developer_instructions'}
    if set(data) != expected or not all(isinstance(v, str) for v in data.values()):
        raise ValueError('에이전트 템플릿 필드 오류: ' + str(template))
    if data['name'] != template.stem or data['sandbox_mode'] not in ('read-only', 'workspace-write'):
        raise ValueError('에이전트 이름 또는 sandbox 오류: ' + str(template))
    data['developer_instructions'] = data['developer_instructions'].replace('{{PLUGIN_ROOT}}', str(plugin))
    return '\n'.join(f'{key} = {json.dumps(value, ensure_ascii=False)}' for key, value in data.items()) + '\n'


def main():
    available = {p.name: p for p in sorted((ROOT / 'plugins').iterdir())
                 if (p / '.codex-plugin/plugin.json').is_file()}
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True, type=Path)
    select = parser.add_mutually_exclusive_group()
    select.add_argument('--plugin', action='append', choices=available, help='반복 지정 가능; 기본 frontend-support-plugin')
    select.add_argument('--all', action='store_true', help='모든 지원 플러그인의 에이전트 등록')
    parser.add_argument('--write', action='store_true', help='미리보기 대신 실제 등록')
    args = parser.parse_args()
    project = args.project.expanduser().resolve()
    if not project.is_dir():
        parser.error('대상 프로젝트 디렉터리가 존재하지 않습니다.')
    destination = project / '.codex/agents'
    if (project / '.codex').is_symlink() or destination.is_symlink():
        parser.error('설치 대상의 .codex 또는 agents 디렉터리가 심볼릭 링크입니다.')
    plugins = list(available) if args.all else list(dict.fromkeys(args.plugin or ['frontend-support-plugin']))
    outputs = {}
    try:
        for name in plugins:
            plugin = available[name]
            for template in sorted((plugin / 'codex/agents').glob('*.json')):
                target = destination / (template.stem + '.toml')
                if target in outputs:
                    parser.error('플러그인 간 에이전트 이름 충돌: ' + template.stem)
                outputs[target] = render(template, plugin)
    except (ValueError, OSError) as error:
        parser.error(str(error))
    conflicts = [str(p) for p, text in outputs.items()
                 if p.is_symlink() or (p.exists() and (not p.is_file() or p.read_text() != text))]
    if conflicts:
        parser.error('기존 파일과 충돌합니다. 비교 후 직접 정리하세요: ' + ', '.join(conflicts))
    for target, content in outputs.items():
        if args.write:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content)
        print(('등록: ' if args.write else '예정: ') + str(target))
    print(f'에이전트 {len(outputs)}개. 원본 체크아웃을 유지하세요. 변경 시 비교·재등록 후 새 세션을 시작하세요.')


if __name__ == '__main__':
    main()
