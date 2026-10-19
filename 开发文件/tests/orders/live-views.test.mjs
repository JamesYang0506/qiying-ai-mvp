import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLiveViews} from '../../server/monitor/live-views.mjs';

const view=id=>({overview:{viewId:id,scope:{versionSet:[]}},snapshots:[]});
test('live views enforce a byte budget as well as an entry limit',()=>{
 const value=view('live-a'),bytes=Buffer.byteLength(JSON.stringify(value));
 const cache=createLiveViews({maxEntries:10,maxBytes:bytes});
 cache.put(value);cache.put(view('live-b'));
 assert.throws(()=>cache.get('live-a'),{status:410});assert.equal(cache.get('live-b').overview.viewId,'live-b');
 assert.throws(()=>cache.put(view('live-'+ 'x'.repeat(bytes))),{status:413});
 assert.equal(cache.get('live-b').overview.viewId,'live-b');
});
