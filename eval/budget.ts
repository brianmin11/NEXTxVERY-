import {mkdirSync,openSync,closeSync,readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {join} from 'node:path';
/** Fail closed across sequential splits/restarts. A crashed session leaves a lock for manual inspection. */
export function openEvaluationBudget(directory:string,approvalId:string,maxCalls:number,maxUsd:number){
 mkdirSync(directory,{recursive:true});const lock=join(directory,'budget.lock');const file=join(directory,'budget.json');
 const fd=openSync(lock,'wx');closeSync(fd);
 try{
  let state:{approvalId:string;reservedCalls:number;reservedUsd:number}=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{approvalId,reservedCalls:0,reservedUsd:0};
  if(state.approvalId!==approvalId||!Number.isInteger(state.reservedCalls)||state.reservedCalls<0||!Number.isFinite(state.reservedUsd)||state.reservedUsd<0)throw Error('Budget ledger invalid; inspect before proceeding');
  let closed=false;
  return {
   reserve(usd:number){
    if(closed||!Number.isFinite(usd)||usd<0||state.reservedCalls+1>maxCalls||state.reservedUsd+usd>maxUsd)throw Error('Approved cumulative evaluation budget exhausted');
    state={...state,reservedCalls:state.reservedCalls+1,reservedUsd:state.reservedUsd+usd};
    writeFileSync(file+'.tmp',JSON.stringify(state,null,2)+'\n',{mode:0o600});renameSync(file+'.tmp',file);
   },
   close(){if(!closed){closed=true;unlinkSync(lock);}},
  };
 }catch(e){unlinkSync(lock);throw e;}
}
