#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const ROUTING_RULES = [
  { sender: 'tech-lead-N', recipient: 'orchestrator', types: ['spawn', 'escalation', 'complete'] },
  { sender: 'tech-lead-N', recipient: 'dev/QA with owner == tech-lead-N', types: ['task', 'fix', 'retest', 'answer'] },
  { sender: 'dev/QA X', recipient: 'owner(X)', types: ['question', 'report', 'finding', 'verdict'] },
  { sender: 'orchestrator', recipient: 'tech-lead-N or any roster instance', types: ['task', 'answer', 'error'] }
];

const roles = new Set(['tech-lead', 'backend_dev', 'frontend_dev', 'qa_engineer']);
const techLeadId = /^tech-lead-([1-9]\d*)$/;
const agentId = /^(backend_dev|frontend_dev|qa_engineer)-([1-9]\d*)$/;
const getId = (value) => typeof value === 'string' ? value : value?.id;
function rosterEntries(roster) {
  const raw = Array.isArray(roster) ? roster : Array.isArray(roster?.instances) ? roster.instances : Object.values(roster?.instances ?? {});
  return raw.filter((item) => item && typeof item === 'object');
}
function rosterMap(roster) { return new Map(rosterEntries(roster).map((item) => [getId(item), item])); }
function roleOf(id) {
  if (typeof id !== 'string') return null;
  if (techLeadId.test(id)) return 'tech-lead';
  return id.match(agentId)?.[1] ?? null;
}
function live(item) { return item && item.status !== 'stopped' && item.stopped !== true && item.live !== false; }
function fail(error, message) { return { ok: false, error, message }; }

export function checkMessage(message, roster, spawnPolicy = {}, filenameSender = undefined, profiles = {}) {
  if (!message || typeof message !== 'object') return fail('invalid_message', 'Message must be an object');
  const sender = filenameSender;
  if (message.sender !== undefined && message.sender !== sender) return fail('sender_mismatch', 'Body sender must match outbox filename');
  if (message.from !== undefined && message.from !== sender) return fail('sender_mismatch', 'Body sender must match outbox filename');
  const recipient = message.to;
  const type = message.type;
  const instances = rosterMap(roster);
  if (typeof sender !== 'string' || typeof recipient !== 'string' || typeof type !== 'string') return fail('invalid_message', 'Message requires sender, to, and type');
  if (!['orchestrator', ...instances.keys()].includes(sender)) return fail('unknown_sender', `Unknown sender '${sender}'`);
  if (sender !== 'orchestrator' && !live(instances.get(sender))) return fail('stopped_sender', `Sender '${sender}' is not live`);
  const senderRole = roleOf(sender);
  const target = instances.get(recipient);
  const targetRole = roleOf(recipient);
  if (sender === 'orchestrator') {
    if (!['task', 'answer', 'error'].includes(type)) return fail('route_refused', 'Orchestrator may send only task, answer, or error');
    if (recipient !== 'orchestrator' && !target) return fail('unknown_recipient', `Unknown recipient '${recipient}'`);
    if (target && !live(target)) return fail('stopped_recipient', `Recipient '${recipient}' is not live`);
    return { ok: true };
  }
  if (!senderRole) return fail('unknown_sender', `Invalid instance id '${sender}'`);
  if (senderRole === 'tech-lead') {
    if (recipient === 'orchestrator') {
      if (!['spawn', 'escalation', 'complete'].includes(type)) return fail('route_refused', 'Tech leads may send only spawn, escalation, or complete to the orchestrator');
      if (type === 'spawn') return checkSpawn(message, sender, roster, spawnPolicy, profiles);
      return { ok: true };
    }
    if (!target || !live(target)) return fail('unknown_recipient', `Recipient '${recipient}' is not a live roster instance`);
    if (!['backend_dev', 'frontend_dev', 'qa_engineer'].includes(targetRole) || target.owner !== sender) return fail('owner_mismatch', `Tech lead '${sender}' may message only its owned dev/QA instances`);
    if (!['task', 'fix', 'retest', 'answer'].includes(type)) return fail('route_refused', 'Tech leads may send only task, fix, retest, or answer to owned dev/QA');
    return { ok: true };
  }
  if (!['question', 'report', 'finding', 'verdict'].includes(type)) return fail('route_refused', 'Dev/QA may send only question, report, finding, or verdict to its owner');
  if (recipient !== senderOwner(instances.get(sender)) || !recipient || !techLeadId.test(recipient)) return fail('owner_mismatch', `Instance '${sender}' may message only its owner`);
  if (!instances.has(recipient) || !live(instances.get(recipient))) return fail('stopped_recipient', `Owner '${recipient}' is not live`);
  return { ok: true };
}

function senderOwner(item) { return item?.owner ?? null; }
function checkSpawn(message, sender, roster, policy, profiles) {
  const body = message.body && typeof message.body === 'object' ? message.body : {};
  if (body.owner !== undefined && body.owner !== sender) return fail('owner_mismatch', 'Spawn owner must equal the sending tech lead');
  const entries = rosterEntries(roster);
  const liveLeads = entries.filter((entry) => roleOf(getId(entry)) === 'tech-lead' && live(entry)).length;
  const maxLeads = Number(policy.maxTechLeads ?? 1);
  const requested = body.instances;
  if (!Array.isArray(requested) || requested.length === 0) return fail('invalid_spawn', 'Spawn must include instances');
  if (requested.some((item) => !item || typeof item !== 'object' || !roles.has(item.role) || typeof item.profile !== 'string' || !Number.isInteger(item.count) || item.count < 1 || typeof item.task !== 'string')) return fail('invalid_spawn', 'Each instance request requires role, profile, positive integer count, and task');
  if (!requested.length) return fail('invalid_spawn', 'Spawn must request at least one role');
  const requestedLeads = requested.reduce((sum, item) => sum + (item.role === 'tech-lead' ? item.count : 0), 0);
  if (liveLeads + requestedLeads > maxLeads) return fail('spawn_limit', `Spawn exceeds maxTechLeads (${maxLeads})`);
  const counts = {};
  for (const entry of entries) if (live(entry) && entry.owner === sender) {
    const role = roleOf(getId(entry));
    if (role && role !== 'tech-lead') counts[role] = (counts[role] ?? 0) + 1;
  }
  const ceilings = policy.maxDevsPerTechLead ?? {};
  for (const item of requested) {
    const { role, profile, count } = item;
    if (!profiles[profile] || profiles[profile].role !== role) return fail('invalid_spawn', `Profile '${profile}' is missing or does not match role '${role}'`);
    if (role === 'tech-lead') continue;
    const limit = role === 'qa_engineer' ? Number(policy.maxQaPerTechLead ?? 0) : Number(ceilings[role] ?? 0);
    counts[role] = (counts[role] ?? 0) + count;
    if (counts[role] > limit) return fail('spawn_limit', `Owner '${sender}' exceeds spawn limit for ${role} (${limit})`);
  }
  return { ok: true };
}

async function main() {
  const [messagePath, rosterPath, configPath] = process.argv.slice(2);
  if (!messagePath || !rosterPath) {
    console.error('Usage: node .herdr/route-check.mjs <outbox>/<sender-instance-id>-<unique>.json <team.json> [workflow.json]');
    process.exitCode = 2; return;
  }
  try {
    const [message, roster, config] = await Promise.all([
      readFile(messagePath, 'utf8').then(JSON.parse), readFile(rosterPath, 'utf8').then(JSON.parse),
      configPath ? readFile(configPath, 'utf8').then(JSON.parse) : Promise.resolve({})
    ]);
    const entries = rosterEntries(roster);
    const base = messagePath.split('/').at(-1);
    const sender = base.startsWith('orchestrator-') ? 'orchestrator' : entries.map(getId).filter((id) => base.startsWith(id + '-')).sort((a, b) => b.length - a.length)[0];
    const result = checkMessage(message, roster, config.spawnPolicy ?? {}, sender, config.profiles ?? {});
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
