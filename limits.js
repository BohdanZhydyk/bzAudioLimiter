'use strict';
// Both sliders have the same visual scale: [-50, 0] dBFS.
// Keep at least 1 dB gap. The ceiling therefore cannot reach -50.
const MIN=-50, MAX=0, GAP=1;
const integer=(v,lo,hi,fallback)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):fallback;
function normalize(previous, patch={}) {
  const oldLimit=integer(previous?.limit,MIN+GAP,MAX,-12);
  const oldThreshold=integer(previous?.threshold,MIN,MAX-GAP,-24);
  const next={limit:oldLimit,threshold:Math.min(oldThreshold,oldLimit-GAP)};
  if (Object.prototype.hasOwnProperty.call(patch,'limit')) {
    next.limit=integer(patch.limit,MIN+GAP,MAX,oldLimit);
    next.threshold=Math.min(next.threshold,next.limit-GAP);
  }
  if (Object.prototype.hasOwnProperty.call(patch,'threshold')) {
    next.threshold=integer(patch.threshold,MIN,next.limit-GAP,next.threshold);
  }
  return next;
}
module.exports={MIN,MAX,GAP,normalize};
