import { RelationshipError, type ModelAdapter, type ModelRequest, type ModelReply } from '../contracts/index.js';
/** Testing only. Script responses are not language understanding or a live fallback. */
export class ScriptedAdapter implements ModelAdapter {
 readonly name='TEST_ONLY_SCRIPTED';readonly model='fixture';readonly requests:ModelRequest[]=[];
 constructor(private replies:Array<unknown|Error|((request:ModelRequest)=>Promise<unknown>)>){}
 async generate(request:ModelRequest):Promise<ModelReply>{this.requests.push(request);if(!this.replies.length)throw new RelationshipError('PROVIDER_ERROR');let value=this.replies.shift();if(value instanceof Error)throw value;if(typeof value==='function')value=await value(request);return {value,model:this.model,inputTokens:null,outputTokens:null};}
}
