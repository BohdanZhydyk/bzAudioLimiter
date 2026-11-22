const test=require('node:test');
const assert=require('node:assert/strict');
const {MIN,MAX,GAP,normalize}=require('../limits');
test('identical visual scale and strict ceiling > threshold',()=>{
  assert.equal(MIN,-50);assert.equal(MAX,0);assert.equal(GAP,1);
  for (let limit=-50;limit<=0;limit++) {
    for (let threshold=-50;threshold<=0;threshold++) {
      const s=normalize({limit,threshold});
      assert.ok(s.limit>=-49&&s.limit<=0);
      assert.ok(s.threshold>=-50&&s.threshold<=-1);
      assert.ok(s.threshold+1<=s.limit);
    }
  }
});
test('lowering ceiling automatically pulls down threshold',()=>{
  assert.deepEqual(normalize({limit:-12,threshold:-24},{limit:-30}),{limit:-30,threshold:-31});
  assert.deepEqual(normalize({limit:-12,threshold:-24},{limit:-50}),{limit:-49,threshold:-50});
});
test('raising threshold clamps to one dB below ceiling',()=>{
  assert.deepEqual(normalize({limit:-12,threshold:-24},{threshold:0}),{limit:-12,threshold:-13});
  assert.deepEqual(normalize({limit:-12,threshold:-24},{threshold:-36}),{limit:-12,threshold:-36});
});
