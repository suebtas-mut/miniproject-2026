import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localEligibility, localPrompt, localModel } from './local-fallback.mjs';
const providers = { connected: ['ollama-local'], all: [{ id: 'ollama-local', models: { [localModel.modelID]: {} } }] };
const endpoint = { npm: '@ai-sdk/openai-compatible', options: { baseURL: 'http://127.0.0.1:11434/v1' } };
test('fallback defaults off, requires connected local model and preserves lifetime attempt budget', () => {
  const state = { agents: { a: {} } };
  assert.match(localEligibility({}, state, 'a', providers), /disabled/);
  assert.match(localEligibility({ enabled: true }, state, 'a', { all: [] }), /unavailable/);
  assert.match(localEligibility({ enabled: true }, state, 'a', providers), /endpoint/);
  assert.equal(localEligibility({ enabled: true }, state, 'a', providers, endpoint), null);
  state.agents.a.localCalls = 2;
  assert.match(localEligibility({ enabled: true }, JSON.parse(JSON.stringify(state)), 'a', providers), /exhausted/);
});
test('GPU worker lock prevents two simultaneous local coding sessions', () => {
  const state = { agents: { a: {}, b: { localActive: true } } };
  assert.equal(localEligibility({ enabled: true }, state, 'a', providers), 'wait');
  state.agents.b.localActive = false;
  assert.equal(localEligibility({ enabled: true }, state, 'a', providers, endpoint), null);
});
test('fresh context is bounded even with huge scope and tool output', () => {
  assert.ok(localPrompt('D:/repo', 'x'.repeat(100000), 'y'.repeat(100000)).length < 6500);
});
