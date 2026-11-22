#include "../native/vst_abi.hpp"
#ifdef NDEBUG
#undef NDEBUG
#endif
#include <cassert>
#include <cmath>
#include <cstdio>
#include <vector>
#include <string>
#include <algorithm>
#include <limits>

static float amplitude(int db) { return std::pow(10.f, db / 20.f); }
int main() {
    AEffect* fx = VSTPluginMain(nullptr);
    assert(fx && fx->magic == kEffectMagic && fx->numInputs == 2 && fx->numOutputs == 2);
    assert(fx->processReplacing && fx->dispatcher && fx->setParameter);
    assert(fx->dispatcher(fx, kEffGetVstVersion, 0, 0, nullptr, 0) == 2400);
    char name[32] = {};
    fx->dispatcher(fx, kEffGetParamName, 1, 0, name, 0);
    assert(std::string(name) == "Ceiling");
    fx->dispatcher(fx, kEffSetSampleRate, 0, 0, nullptr, 48000.f);

    constexpr int n=48000;
    std::vector<float> l(n),r(n),outL(n),outR(n);
    for (int i=0;i<n;i++) {
        float v = i<2000 ? .05f : (i<6000 ? .96f : .05f);
        l[i]=v; r[i]=-v;
    }
    float* in[2]={l.data(),r.data()}; float* out[2]={outL.data(),outR.data()};
    fx->setParameter(fx,0,1.f);
    fx->setParameter(fx,1,.76f);
    fx->setParameter(fx,2,.6f);
    fx->setParameter(fx,3,0.f);
    fx->processReplacing(fx,in,out,n);
    const float ceiling=amplitude(-12);
    float peak=0;
    for (int i=0;i<n;i++) {
        peak=std::max(peak,std::fabs(outL[i]));
        assert(std::fabs(outL[i]) <= ceiling+1e-6f);
        assert(std::fabs(outR[i]) <= ceiling+1e-6f);
        assert(std::fabs(outL[i]+outR[i]) < 1e-6f);
    }
    assert(peak > .23f && peak <= ceiling+1e-6f);
    assert(std::fabs(outL[1500]-.05f) < 1e-4f);
    assert(std::fabs(outL[n-1]-.05f) < .002f);

    // Exact pass-through when the user disables the limiter, no virtual driver required.
    fx->setParameter(fx,0,0.f);
    fx->processReplacing(fx,in,out,n);
    for (int i=0;i<n;i++) assert(outL[i]==l[i] && outR[i]==r[i]);

    // No special case at callback block boundaries; same result as one long callback.
    AEffect* second=VSTPluginMain(nullptr);
    assert(second);
    second->setParameter(second,0,1.f);
    second->setParameter(second,1,.76f);
    second->setParameter(second,2,.6f);
    second->setParameter(second,3,0.f);
    second->dispatcher(second,kEffSetSampleRate,0,0,nullptr,48000.f);
    float* in2[2]={l.data(),r.data()}; float* out2[2]={outL.data(),outR.data()};
    std::vector<float> byL(n),byR(n);
    for (int i=0;i<n;i+=256) {
        in2[0]=l.data()+i;in2[1]=r.data()+i;
        out2[0]=byL.data()+i;out2[1]=byR.data()+i;
        second->processReplacing(second,in2,out2,std::min(n-i,256));
    }
    fx->setParameter(fx,0,1.f);
    fx->dispatcher(fx,kEffMainsChanged,0,1,nullptr,0.f);
    fx->processReplacing(fx,in,out,n);
    for (int i=0;i<n;i++) {assert(std::fabs(byL[i]-outL[i])<2e-6f);assert(std::fabs(byR[i]-outR[i])<2e-6f);}
    // A NaN source cannot contaminate downstream output or state.
    l[400] = std::numeric_limits<float>::quiet_NaN();
    r[401] = std::numeric_limits<float>::infinity();
    fx->dispatcher(fx,kEffMainsChanged,0,1,nullptr,0.f);
    fx->processReplacing(fx,in,out,n);
    for (int i=0;i<n;i++) assert(std::isfinite(outL[i]) && std::isfinite(outR[i]));
    fx->dispatcher(fx,kEffClose,0,0,nullptr,0.f);
    second->dispatcher(second,kEffClose,0,0,nullptr,0.f);
    std::printf("PASS: VST 2 ABI, 48kHz stereo, -12 dBFS ceiling, ratio, silence, bypass, block continuity, NaN guard\n");
}
