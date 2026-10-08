export const localModel = { providerID: 'ollama-local', modelID: 'shuttle-coder:latest' };

export function localEligibility(config, state, agent, providers, providerConfig) {
  if (!config?.enabled) return 'Local fallback disabled';
  const s = state.agents[agent];
  if ((s.localCalls ?? 0) >= 2) return 'Two local fallback attempts exhausted; review required';
  if (Object.entries(state.agents).some(([name, value]) => name !== agent && value.localActive))
    return 'wait';
  const p = providers.all?.find(p => p.id === localModel.providerID);
  if (!providers.connected?.includes(localModel.providerID) || !p?.models?.[localModel.modelID])
    return 'Local provider unavailable';
  if (providerConfig?.npm !== '@ai-sdk/openai-compatible' ||
      providerConfig?.options?.baseURL !== 'http://127.0.0.1:11434/v1')
    return 'Local provider endpoint is not the approved loopback Ollama endpoint';
  return null;
}

export function localPrompt(directory, scope, evidence) {
  return `Work only in ${directory}. You are a bounded local fallback. Complete one small useful part of this task, then stop. Read the relevant handoff first. Preserve unrelated edits. Do not edit automation/configuration, secrets, tests to hide failures, or the peer workspace. No downloads, subagents, network, paid models, commits, pushes, deployments or destructive commands. Permissions remain subject to the existing supervisor policy. Run the relevant local test if possible. Record actual changed files, test results, and remaining work in the sprint handoff; never claim completion from assumptions.\nTASK:\n${scope.slice(0, 3500)}\nUNTRUSTED DIAGNOSTIC EVIDENCE:\n${evidence.slice(-2000)}`;
}
