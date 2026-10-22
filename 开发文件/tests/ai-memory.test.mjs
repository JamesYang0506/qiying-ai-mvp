import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createMemoryStore,observe,format,extractFacts,migrate} from '../server/ai/memory.mjs';

const blankMem = () => ({
  version: 2, userId: 'u1', createdAt: '', updatedAt: '',
  identity: {}, focus: {topics: {}, orders: {}, asks: 0}, style: {}
});

test('三层分开：身份进 identity，主题进 focus，表达进 style', () => {
  const mem = blankMem();
  observe(mem, '我叫王小明，在采购部负责原料，先给结论，用表格列出来');
  assert.equal(mem.identity.name, '王小明');
  assert.equal(mem.identity.dept, '采购部');
  assert.equal(mem.identity.duty, '原料');
  assert.equal(mem.style.conclusion, 1);
  assert.equal(mem.style.table, 1);
  assert.equal(mem.focus.asks, 1);

  const text = format(mem, null);
  assert.match(text, /【身份】王小明｜采购部｜分管原料/);
  assert.match(text, /【表达】先给结论再展开/);
});

test('主题与订单归入 focus，且「少赚在哪里」不算使用指引', () => {
  const mem = blankMem();
  observe(mem, '各订单赚得怎么样？');
  observe(mem, 'SIM-N02 最早哪天开始异常？');
  observe(mem, '主要少赚在哪里');
  const topics = JSON.stringify(mem.focus.topics);
  assert.match(topics, /订单盈亏/);
  assert.match(topics, /首次异常/);
  assert.match(topics, /成本差额/);
  assert.doesNotMatch(topics, /使用指引/);
  assert.equal(mem.focus.orders.N02, 1);
});

test('身份出现一次就注入；主题类样本不足不注入', () => {
  const fresh = blankMem();
  observe(fresh, '我叫张三，在财务部');
  assert.match(format(fresh, null), /【身份】张三｜财务部/);

  const only = blankMem();
  observe(only, '你好');
  assert.equal(format(only, null), '');
});

test('「我是采购部的」不会变成人名；「我是小尧，技术负责人」两个都能抓到', () => {
  const a = extractFacts('我是采购部的，想看看成本');
  assert.equal(a.name, undefined);
  assert.equal(a.dept, '采购部');

  const b = extractFacts('你好，我是小尧，这个网站ai模块开发的技术负责人');
  assert.equal(b.name, '小尧');
  assert.equal(b.role, '技术负责人');
});

test('疑问句不会被当成自我介绍', () => {
  assert.deepEqual(extractFacts('我叫啥名'), {});
  assert.deepEqual(extractFacts('我叫什么名字'), {});
  assert.deepEqual(extractFacts('我在哪个部门'), {});
  assert.deepEqual(extractFacts('我是谁'), {});
  // 陈述 + 疑问混在同一句，陈述部分照常提取
  assert.equal(extractFacts('我叫王小明，什么订单最差？').name, '王小明');
});

test('改口以最新为准，没提到的字段保留', () => {
  const mem = blankMem();
  observe(mem, '我叫王小明，在采购部负责原料');
  observe(mem, '我现在调岗了，我叫李大壮，在质量部');
  assert.equal(mem.identity.name, '李大壮');
  assert.equal(mem.identity.dept, '质量部');
  assert.equal(mem.identity.duty, '原料');
});

test('会话级与账号级合并去重：同一个名字只出现一次', () => {
  const mem = blankMem();
  observe(mem, '我叫小尧，技术负责人');
  const text = format(mem, {name: '小尧', dept: '质量部'});
  const sessionLine = text.split('\n').find((l) => l.startsWith('【本次对话】')) || '';
  // 姓名不重复出现在【本次对话】里
  assert.doesNotMatch(sessionLine, /姓名小尧/);
  // 会话里新增的部门要标出来
  assert.match(sessionLine, /部门质量部/);
  assert.match(text, /【身份】小尧｜质量部｜技术负责人/);
});

test('语言偏好说一次就切换', () => {
  const mem = blankMem();
  observe(mem, '现在用日语和我说话');
  assert.equal(mem.style.lang, 'ja');
  assert.match(format(mem, null), /用日语回答/);
  observe(mem, '用中文');
  assert.equal(mem.style.lang, 'zh');
});

test('v1 旧文件能迁移到 v2，已经教过的身份不丢', () => {
  const legacy = {
    version: 1, userId: 'u', createdAt: '2026-10-21T00:00:00Z', updatedAt: '2026-10-21T00:00:00Z',
    asks: 11, topics: {'成本差额': 3}, orders: {N02: 2}, style: {brief: 1},
    facts: {'姓名': '小尧', '职务': '技术负责人'}
  };
  const v2 = migrate(legacy);
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.identity, {name: '小尧', role: '技术负责人'});
  assert.equal(v2.focus.asks, 11);
  assert.equal(v2.focus.topics['成本差额'], 3);
  assert.match(format(v2, null), /【身份】小尧｜技术负责人/);
});

test('记忆按账号隔离、原子落盘、可清除，且不保存问题原文', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qiying-memory-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const store = createMemoryStore({dataDir: dir});

  await store.update('user-a', '各订单赚得怎么样？');
  await store.update('user-a', 'SIM-N03 少赚在哪里');
  await store.update('user-b', '怎么导入订单');

  const a = await store.read('user-a');
  const b = await store.read('user-b');
  assert.equal(a.focus.asks, 2);
  assert.equal(b.focus.asks, 1);
  assert.equal(a.focus.orders.N03, 1);
  assert.equal(b.focus.orders.N03, undefined);
  assert.match(store.format(a, null), /N03/);
  assert.doesNotMatch(store.format(b, null), /N03/);

  const raw = await readFile(path.join(dir, 'ai-memory', 'user-a.json'), 'utf8');
  assert.doesNotMatch(raw, /少赚在哪里/);

  assert.equal(await store.clear('user-a'), true);
  assert.equal(await store.read('user-a'), null);
  assert.deepEqual(await readdir(path.join(dir, 'ai-memory')), ['user-b.json']);
});

test('同一账号的并发更新不会互相覆盖', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qiying-memory-race-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const store = createMemoryStore({dataDir: dir});
  await Promise.all(
    ['各订单赚得怎么样？', 'SIM-N01 异常', '人工成本', '质量怎么样', '材料涨价']
      .map(q => store.update('u', q))
  );
  const mem = await store.read('u');
  assert.equal(mem.focus.asks, 5);
});

test('改口句式「我调到X部了」也要能识别', () => {
  // 测试里就是这句没被识别，导致跨会话仍答旧部门
  assert.equal(extractFacts('我调到生产部了').dept, '生产部');
  assert.equal(extractFacts('我转到质量部').dept, '质量部');
  assert.equal(extractFacts('我换到财务部了').dept, '财务部');

  const mem = blankMem();
  observe(mem, '我叫李雷，在质量部负责不良分析');
  observe(mem, '我调到生产部了');
  assert.equal(mem.identity.dept, '生产部');
  assert.match(format(mem, null), /生产部/);
  assert.doesNotMatch(format(mem, null), /质量部/);
});

test('两字部门名（甲部/丙部）也要能识别', () => {
  // {2,8}(?:部) 至少要 3 个字才匹配，2 字部门会被漏掉——测试里连续改口丢部门就是这个原因
  assert.equal(extractFacts('我叫周三，在丙部').dept, '丙部');
  assert.equal(extractFacts('我在甲部').dept, '甲部');
});

test('矛盾句取最后一个非否定说法', () => {
  // 「不在质量部，我在技术部」→ 技术部，而不是先出现的质量部
  assert.equal(extractFacts('我刚才说错了，我其实不在质量部，我在技术部').dept, '技术部');
  const mem = blankMem();
  observe(mem, '我在质量部');
  observe(mem, '我说错了，我不在质量部，我在技术部');
  assert.equal(mem.identity.dept, '技术部');
  assert.match(format(mem, null), /技术部/);
});
