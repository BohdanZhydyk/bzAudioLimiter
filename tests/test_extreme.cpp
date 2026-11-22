#include "../native/vst_abi.hpp"
#include <algorithm>
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>

static float dbamp(int db){return std::pow(10.f,db/20.f);}
int main() {
    AEffect* effect=VSTPluginMain(nullptr);assert(effect);
    for(int rate:{8000,44100,48000,96000,192000}){
      effect->dispatcher(effect,kEffSetSampleRate,0,0,nullptr,float(rate));
      for(int ceilingDb:{-49,-24,-12,-6,0}){
        effect->setParameter(effect,0,1);
        effect->setParameter(effect,1,float(ceilingDb+50)/50.f);
        effect->setParameter(effect,2,float(-18+60)/60.f);
        for(int ratio=0;ratio<4;ratio++){
          effect->setParameter(effect,3,float(ratio)/3.f);
          effect->dispatcher(effect,kEffMainsChanged,0,1,nullptr,0);
          const int n=10240;
          std::vector<float> l(n),r(n),ol(n),orr(n);
          for(int i=0;i<n;i++){
            float sample=i%997==0?1.5f: (i%61==0?.92f:.0009f);
            l[i]=sample;r[i]=-sample*.625f;
          }
          int offset=0;
          while(offset<n){
            int count=std::min(1+(offset%721),n-offset);
            float* ins[]={l.data()+offset,r.data()+offset};
            float* outs[]={ol.data()+offset,orr.data()+offset};
            effect->processReplacing(effect,ins,outs,count);
            offset+=count;
          }
          for(int i=0;i<n;i++){
            assert(std::isfinite(ol[i])&&std::isfinite(orr[i]));
            assert(std::fabs(ol[i]) <= dbamp(ceilingDb)+0.000002f);
            assert(std::fabs(orr[i]) <= dbamp(ceilingDb)+0.000002f);
            // linked stereo reduction preserves ratio on nonzero samples
            if(std::fabs(ol[i])>.0001f)assert(std::fabs(orr[i]/ol[i]+.625f)<.0005f);
          }
        }
      }
    }
    effect->dispatcher(effect,kEffClose,0,0,nullptr,0);
    std::puts("PASS: 5 sample rates, 5 ceilings, 4 ratios, random callback sizes, 100 peak ceiling cases");
}
