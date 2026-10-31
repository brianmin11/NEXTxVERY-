import test from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

// Isolated process resolves server-only under react-server conditions. Fake fetch is installed
// before importing the production provider; no real key, provider traffic, or shared ledger.
function checkProvider(
  mode: "success" | "exhausted" | "failure" | "unapproved" | "cancelled"
) {
  const source = `
    import assert from 'node:assert/strict';
    import {mkdtempSync,rmSync} from 'node:fs';
    import {tmpdir} from 'node:os';
    import {join} from 'node:path';
    import {DatabaseSync} from 'node:sqlite';
    const dir=mkdtempSync(join(tmpdir(),'v3-provider-qa-'));
    const path=join(dir,'budget.sqlite');
    const mode=${JSON.stringify(mode)};
    const seed=mode==='exhausted'?12:10;
    const db=new DatabaseSync(path);
    db.exec('CREATE TABLE reservations(id TEXT PRIMARY KEY,reserved REAL NOT NULL,created TEXT NOT NULL,metadata TEXT)');
    for(let i=0;i<seed;i++)db.prepare('INSERT INTO reservations VALUES(?,?,?,NULL)').run('old-'+i,0.15,new Date().toISOString());
    db.close();
    process.env.OPENAI_API_KEY='sk-synthetic-not-a-real-key';
    process.env.INTEGRATION_LIVE_APPROVED='true';
    process.env.INTEGRATION_BUDGET_PATH=path;
    process.env.INTEGRATION_SYNTHETIC_ACTOR_IDS=mode==='unapproved'?'another-actor':'qa-actor';
    let calls=0;
    const raw='SYNTHETIC_RAW_SHOULD_NOT_PERSIST';
    const draft='SYNTHETIC_DRAFT_SHOULD_NOT_PERSIST';
    globalThis.fetch=async (_url,init)=>{
      calls++;
      const body=JSON.parse(init.body);
      assert.equal(body.store,false);
      assert.equal(body.model,'gpt-6.1-sol');
      assert.equal(body.max_output_tokens,2600);
      assert.equal(body.previous_response_id,undefined);
      assert.equal(body.conversation,undefined);
      assert.equal(body.tools,undefined);
      const input=JSON.parse(body.input);
      assert.equal(input.current.text,raw);
      assert.deepEqual(input.memories,[]);
      if(mode==='failure')return new Response(JSON.stringify({error:{message:raw,type:'server_error'}}),{status:500,headers:{'content-type':'application/json'}});
      const value={schemaVersion:'1.0',id:input.settings.id,revision:input.settings.revision,status:'draft',exactText:draft,recipients:input.settings.recipients,purpose:input.settings.purpose,reviewItems:[],safetyDisposition:'ordinary'};
      return new Response(JSON.stringify({id:'resp_synthetic',object:'response',created_at:0,status:'completed',model:body.model,output:[{id:'msg_synthetic',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value),annotations:[]}]}],usage:{input_tokens:10,output_tokens:10,total_tokens:20}}),{status:200,headers:{'content-type':'application/json'}});
    };
    try {
      const {relationshipProvider,callOptions}=await import('./src/lib/server/provider.ts');
      assert.equal(callOptions.maxRetries,0);
      const controller=new AbortController();
      if(mode==='cancelled')controller.abort();
      const provider=relationshipProvider({id:'qa-actor',name:'합성 계정'},controller.signal);
      const invoke=()=>provider.suggest(raw,'다른 합성 계정',{actorId:'qa-actor',recipientId:'qa-recipient',familyId:'qa-family'});
      if(mode==='success'){
        assert.equal(await invoke(),draft);
        await assert.rejects(invoke,e=>e.status===429&&e.code==='AI_RATE_LIMIT');
      } else {
        const status=mode==='exhausted'?429:mode==='cancelled'?409:503;
        await assert.rejects(invoke,e=>e.status===status&&!e.message.includes(raw));
      }
      assert.equal(calls,mode==='success'||mode==='failure'?1:0);
      const read=new DatabaseSync(path,{readOnly:true});
      const reservations=read.prepare('SELECT * FROM reservations').all();
      assert.equal(reservations.length,seed+calls);
      assert.equal(JSON.stringify(reservations).includes(raw),false);
      assert.equal(JSON.stringify(reservations).includes(draft),false);
      read.close();
      process.stdout.write(JSON.stringify({mode,calls,reservations:reservations.length}));
    } finally {rmSync(dir,{recursive:true,force:true});}
  `
  const output = execFileSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      source,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  return JSON.parse(output) as {
    mode: string
    calls: number
    reservations: number
  }
}

test("provider uses transient requests and persistent reservation/rate limits without retaining input or draft", () => {
  assert.deepEqual(checkProvider("success"), {
    mode: "success",
    calls: 1,
    reservations: 11,
  })
})
test("exhausted budget, unapproved actors and cancelled requests never reach the model", () => {
  for (const mode of ["exhausted", "unapproved", "cancelled"] as const)
    assert.equal(checkProvider(mode).calls, 0)
})
test("provider failures are redacted, keep conservative reservation and do not auto retry", () => {
  assert.deepEqual(checkProvider("failure"), {
    mode: "failure",
    calls: 1,
    reservations: 11,
  })
})
