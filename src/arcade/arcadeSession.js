"use strict";
const redisManager = require("../managers/redisManager");
const {logger} = require("../managers/logger");
const crypto = require("crypto");
const States = { CREATED:"CREATED", WAITING_INPUT:"WAITING_INPUT", RESOLVING:"RESOLVING", FINISHED:"FINISHED", EXPIRED:"EXPIRED" };
function genGameId(game, userId){ return game + "_" + String(userId) + "_" + crypto.randomBytes(4).toString("hex"); }
function cid(gameId, action){ return String(action).replace(/_/g,"-") + "__" + gameId; }
function parseCid(customId){
  if(!customId || !customId.includes("__")) return null;
  const idx = customId.indexOf("__");
  const a = customId.slice(0, idx);
  const g = customId.slice(idx + 2);
  return { action: a.replace(/-/g,"_"), gameId: g };
}
function makeFilter(gameId, userId){
  return (i)=>{
    const parsed = parseCid(i.customId);
    if(parsed && parsed.gameId) return parsed.gameId === gameId && i.user.id === userId;
    return false;
  };
}
const sessions = new Map();
function setState(gameId, state){ const s = sessions.get(gameId) || {resets:0}; s.state = state; sessions.set(gameId, s); }
function getSession(gameId){ return sessions.get(gameId) || null; }
function clearSession(gameId){ sessions.delete(gameId); }
function tryReset(collector, gameId){
  const s = sessions.get(gameId);
  if(!s) return false;
  if(s.resets >= 3) return false;
  try{ collector.resetTimer(); }catch(e){ return false; }
  s.resets++;
  sessions.set(gameId, s);
  return true;
}
async function rewardOnce(gameId, fn){
  const key = "reward:" + gameId;
  try{
    if(redisManager && redisManager.client && redisManager.client.isReady){
      const has = await redisManager.client.get(key);
      if(has) return { ok:false, reason:"ALREADY_REWARDED" };
      await redisManager.client.setEx(key, 86400, "1");
    }
  }catch(e){ logger.warn("[arcadeSession] redis reward check fail: " + e.message); }
  if(sessions.get(key)) return { ok:false, reason:"ALREADY_REWARDED" };
  sessions.set(key, { state:"REWARDED" });
  const result = await fn();
  return { ok:true, result };
}
async function withLock(userId, fn, ttlMs){
  const key = "lock:arcade:" + userId;
  const token = crypto.randomBytes(8).toString("hex");
  let acquired = false;
  try{
    if(redisManager && redisManager.client && redisManager.client.isReady){
      const r = await redisManager.client.set(key, token, "NX", "PX", ttlMs || 30000);
      acquired = !!r;
      if(!acquired) return { ok:false, reason:"LOCKED" };
    }
  }catch(e){}
  try{ const result = await fn(); return { ok:true, result }; }
  finally{
    try{
      if(acquired && redisManager && redisManager.client && redisManager.client.isReady){
        const cur = await redisManager.client.get(key);
        if(cur === token) await redisManager.client.del(key);
      }
    }catch(e){}
  }
}
module.exports = { States, genGameId, cid, parseCid, makeFilter, setState, getSession, clearSession, tryReset, rewardOnce, withLock };
