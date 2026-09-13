#!/usr/bin/env node
/** Codex 카탈로그·배포 메타데이터·모든 에이전트 등록 경로를 검증한다. */
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, listPlugins, createReporter } = require('./lib/repo');
const report = createReporter('Codex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const files = (dir, ext) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith(ext)) : [];
const contained = (root, relative) => {
  const full = path.resolve(root, relative);
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) throw Error('번들 경로 없음 또는 외부 경로: ' + relative);
  return full;
};
let checked = 0;
try {
  const catalog = read(path.join(ROOT, '.agents/plugins/marketplace.json'));
  if (!/^[A-Za-z0-9_-]+$/.test(catalog.name) || !Array.isArray(catalog.plugins)) throw Error('카탈로그 구조 오류');
  const names = new Set();
  const agentNames = new Set();
  for (const entry of catalog.plugins) {
    checked++;
    try {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name) || names.has(entry.name)) throw Error('플러그인 이름 오류/중복');
      names.add(entry.name);
      if (entry.source.source !== 'local' || entry.source.path !== './plugins/' + entry.name) throw Error('source 오류');
      if (!['AVAILABLE', 'NOT_AVAILABLE', 'INSTALLED_BY_DEFAULT'].includes(entry.policy.installation) || !['ON_INSTALL', 'ON_USE'].includes(entry.policy.authentication) || !entry.category) throw Error('policy/category 오류');
      const root = path.join(ROOT, entry.source.path);
      const manifest = read(path.join(root, '.codex-plugin/plugin.json'));
      const claude = read(path.join(root, '.claude-plugin/plugin.json'));
      if (manifest.name !== entry.name || manifest.version !== claude.version || manifest.description !== claude.description) throw Error('양쪽 매니페스트 불일치');
      if (!/^\d+\.\d+\.\d+$/.test(manifest.version) || !manifest.author?.name || !manifest.interface?.displayName) throw Error('버전/표시 메타데이터 오류');
      if (manifest.skills !== './skills/') throw Error('공통 스킬 경로 오류');
      const skills = contained(root, manifest.skills);
      const skillDirs = fs.readdirSync(skills, { withFileTypes: true }).filter(x=>x.isDirectory() && !x.name.startsWith('.'));
      if (!skillDirs.length) throw Error('배포할 스킬이 없음');
      for (const skill of skillDirs) {
        const file = contained(root, 'skills/' + skill.name + '/SKILL.md');
        for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
          const link = match[1];
          if (!link.includes('://') && !link.startsWith('#')) contained(root, path.relative(root, path.resolve(path.dirname(file), link.split('#')[0])));
        }
      }
      if (manifest.mcpServers) {
        if (typeof manifest.mcpServers !== 'string' || !manifest.mcpServers.startsWith('./')) throw Error('MCP companion 경로 오류');
        const mcp = read(contained(root, manifest.mcpServers));
        if (!mcp.mcpServers || !Object.keys(mcp.mcpServers).length) throw Error('MCP 서버 없음');
        for (const server of Object.values(mcp.mcpServers)) {
          for (const arg of server.args || []) {
            if (arg.startsWith('${CLAUDE_PLUGIN_ROOT}/')) contained(root, arg.slice('${CLAUDE_PLUGIN_ROOT}/'.length));
          }
        }
      }
      const agentsDir = path.join(root, 'codex/agents');
      const templates = files(agentsDir, '.json');
      for (const source of files(path.join(root, 'agents'), '.md')) {
        if (!templates.includes(source.replace(/\.md$/, '.json'))) throw Error('Codex 에이전트 누락: ' + source);
      }
      for (const file of templates) {
        const agent = read(path.join(agentsDir, file));
        if (agent.name + '.json' !== file || !agent.description || !agent.developer_instructions) throw Error('에이전트 필수 필드 오류');
        if (agentNames.has(agent.name)) throw Error('플러그인 간 에이전트 이름 중복: ' + agent.name);
        agentNames.add(agent.name);
        if (!['read-only', 'workspace-write'].includes(agent.sandbox_mode)) throw Error('sandbox 오류');
        const references = [...agent.developer_instructions.matchAll(/\{\{PLUGIN_ROOT\}\}\/([^`\s]+)/g)];
        if (!references.length) throw Error('에이전트 원본 참조 없음');
        for (const match of references) contained(root, match[1]);
      }
    } catch (error) { report.error(`${entry.name}: ${error.message}`); }
  }
  for (const name of listPlugins()) {
    if (fs.existsSync(path.join(ROOT, 'plugins', name, '.codex-plugin/plugin.json')) && !names.has(name)) report.error('Codex 카탈로그 누락: ' + name);
  }
} catch (error) { report.error(error.message); }
report.finish(checked);
