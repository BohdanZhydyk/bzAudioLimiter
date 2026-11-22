#include "vst_abi.hpp"
#if defined(_WIN32)
// Windows PE runtime-free compatibility symbols.
extern "C" int _fltused = 0;
extern "C" __declspec(noinline) void* memset(void* p, int value, size_t n) {
    volatile unsigned char* dst = static_cast<volatile unsigned char*>(p);
    for (size_t i=0;i<n;++i) dst[i] = static_cast<unsigned char>(value);
    return p;
}
#endif

// Telemetry is initialized outside the callback; the callback only writes
// aligned 32-bit values into an already mapped page. No files or IPC waits.
#if defined(_WIN32)
extern "C" __declspec(dllimport) void* __stdcall CreateFileMappingW(void*, void*, unsigned long, unsigned long, unsigned long, const wchar_t*);
extern "C" __declspec(dllimport) void* __stdcall MapViewOfFile(void*, unsigned long, unsigned long, unsigned long, size_t);
extern "C" __declspec(dllimport) int __stdcall UnmapViewOfFile(const void*);
extern "C" __declspec(dllimport) int __stdcall CloseHandle(void*);
extern "C" __declspec(dllimport) int __stdcall ConvertStringSecurityDescriptorToSecurityDescriptorW(const wchar_t*, unsigned long, void**, unsigned long*);
extern "C" __declspec(dllimport) void* __stdcall LocalFree(void*);
struct TelemetrySecurity { unsigned long length; void* descriptor; int inherit; };
struct TelemetryPage { volatile int magic, version, sequence, gainPpm, enabled; };
static const wchar_t kTelemetryGlobal[] = L"Global\\bzAudioLimiterTelemetry_022";
static const wchar_t kTelemetryLocal[] = L"Local\\bzAudioLimiterTelemetry_022";
static constexpr int kTelemetryMagic = 0x425a4d31;
static constexpr unsigned long kPageReadWrite = 0x04, kMapWrite = 0x02;
static void* openTelemetryPage(void** handle) {
    void* descriptor = nullptr;
    const wchar_t sddl[] = L"D:(A;;GA;;;SY)(A;;GA;;;LS)(A;;GA;;;OW)(A;;GR;;;WD)";
    if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl, 1, &descriptor, nullptr)) return nullptr;
    TelemetrySecurity sa = { sizeof(TelemetrySecurity), descriptor, 0 };
    void* mapping = CreateFileMappingW(reinterpret_cast<void*>(static_cast<intptr_t>(-1)),
                                      &sa, kPageReadWrite, 0, sizeof(TelemetryPage), kTelemetryGlobal);
    if (!mapping) mapping = CreateFileMappingW(reinterpret_cast<void*>(static_cast<intptr_t>(-1)),
                                               &sa, kPageReadWrite, 0, sizeof(TelemetryPage), kTelemetryLocal);
    LocalFree(descriptor);
    if (!mapping) return nullptr;
    void* view = MapViewOfFile(mapping, kMapWrite, 0, 0, sizeof(TelemetryPage));
    if (!view) { CloseHandle(mapping); return nullptr; }
    *handle = mapping;
    auto* page = static_cast<TelemetryPage*>(view);
    page->version = 1;
    page->gainPpm = 1000000;
    page->enabled = 0;
    page->magic = kTelemetryMagic;
    return view;
}
static void closeTelemetryPage(void* view, void* handle) {
    if (view) UnmapViewOfFile(view);
    if (handle) CloseHandle(handle);
}
#endif

// No operating-system calls, heap allocations or I/O in the audio callback.
// Build into a Windows VST2 DLL without a C/C++ runtime dependency.
namespace {
constexpr int kChannels = 2;
constexpr int kLookahead = 128;
constexpr int kInstances = 16;
constexpr int kParams = 5;

// 10^(dB/20), -60 dB through 0 dB, integer dB steps, generated offline.
static const float dbAmplitude[61] = {
    0.001f,     0.0011220184543f,     0.00125892541179f,     0.00141253754462f,     0.00158489319246f,     0.00177827941004f,
    0.00199526231497f,     0.00223872113857f,     0.00251188643151f,     0.00281838293126f,     0.00316227766017f,     0.00354813389234f,
    0.00398107170553f,     0.00446683592151f,     0.00501187233627f,     0.0056234132519f,     0.0063095734448f,     0.00707945784384f,
    0.00794328234724f,     0.00891250938134f,     0.01f,     0.011220184543f,     0.0125892541179f,     0.0141253754462f,
    0.0158489319246f,     0.0177827941004f,     0.0199526231497f,     0.0223872113857f,     0.0251188643151f,     0.0281838293126f,
    0.0316227766017f,     0.0354813389234f,     0.0398107170553f,     0.0446683592151f,     0.0501187233627f,     0.056234132519f,
    0.063095734448f,     0.0707945784384f,     0.0794328234724f,     0.0891250938134f,     0.1f,     0.11220184543f,
    0.125892541179f,     0.141253754462f,     0.158489319246f,     0.177827941004f,     0.199526231497f,     0.223872113857f,
    0.251188643151f,     0.281838293126f,     0.316227766017f,     0.354813389234f,     0.398107170553f,     0.446683592151f,
    0.501187233627f,     0.56234132519f,     0.63095734448f,     0.707945784384f,     0.794328234724f,     0.891250938134f,
    1.0f, };

enum { kEnabled=0, kCeiling=1, kThreshold=2, kRatio=3, kResponse=4 };
struct Instance {
    AEffect effect;
    int occupied;
    float params[kParams];
    float ring[kChannels][kLookahead];
    float gain;
    float sampleRate;
    int head;
    int count;
#if defined(_WIN32)
    void* telemetry;
    void* telemetryHandle;
#endif
};
static Instance slots[kInstances] = {};

float clamp(float v, float lo, float hi) {
    if (!(v >= lo)) return lo;  // NaN returns lo
    return v > hi ? hi : v;
}
float absolute(float v) { return v < 0.f ? -v : v; }
float minFloat(float a, float b) { return a < b ? a : b; }
float maxFloat(float a, float b) { return a > b ? a : b; }
float squareRoot(float x) {
#if defined(_WIN32) && (defined(__SSE__) || defined(_M_X64) || defined(_M_IX86))
    typedef float V4 __attribute__((vector_size(16)));
    V4 v = {x, 0.f, 0.f, 0.f};
    return __builtin_ia32_sqrtss(v)[0];
#else
    return __builtin_sqrtf(x);
#endif
}
int toIndex(float normalized, int maxIndex) {
    return int(clamp(normalized, 0.f, 1.f) * float(maxIndex) + .5f);
}
void writeText(void* destination, const char* source, int maxLen = 24) {
    if (!destination) return;
    char* dest = static_cast<char*>(destination);
    int j = 0;
    while (j < maxLen - 1 && source[j]) { dest[j] = source[j]; ++j; }
    dest[j] = 0;
}
void writeNumber(void* destination, int value) {
    if (!destination) return;
    char buffer[24];
    int offset=0;
    if (value < 0) { buffer[offset++] = '-'; value = -value; }
    if (value >= 100) buffer[offset++] = char('0' + value / 100 % 10);
    if (value >= 10) buffer[offset++] = char('0' + value / 10 % 10);
    buffer[offset++] = char('0' + value % 10);
    buffer[offset] = 0;
    writeText(destination, buffer);
}
void reset(Instance* s) {
    s->gain = 1.f;
    s->head = 0;
    s->count = 0;
    for (int c=0;c<kChannels;c++) for (int i=0;i<kLookahead;i++) s->ring[c][i]=0.f;
}
void BZ_CALL setParam(AEffect* effect, int32_t index, float value) {
    if (!effect || index < 0 || index >= kParams) return;
    Instance* s = static_cast<Instance*>(effect->object);
    if (!s) return;
    s->params[index] = clamp(value, 0.f, 1.f);
}
float BZ_CALL getParam(AEffect* effect, int32_t index) {
    if (!effect || index < 0 || index >= kParams) return 0.f;
    Instance* s = static_cast<Instance*>(effect->object);
    return s ? s->params[index] : 0.f;
}

void BZ_CALL process(AEffect* effect, float** inputs, float** outputs, int32_t frames) {
    if (!effect || !inputs || !outputs || !inputs[0] || !inputs[1] || !outputs[0] || !outputs[1] || frames <= 0) return;
    Instance* s = static_cast<Instance*>(effect->object);
    if (!s) return;
    const bool enabled = s->params[kEnabled] >= .5f;
    if (!enabled) {
#if defined(_WIN32)
        if (s->telemetry) {
            auto* page = static_cast<TelemetryPage*>(s->telemetry);
            page->gainPpm = 1000000;
            page->enabled = 0;
            __sync_fetch_and_add(&page->sequence, 1);
        }
#endif
        if (s->count != 0) reset(s);
        for (int i=0;i<frames;i++) {
            outputs[0][i] = inputs[0][i];
            outputs[1][i] = inputs[1][i];
        }
        return;
    }
    const float ceiling = dbAmplitude[10 + toIndex(s->params[kCeiling], 50)];
    const float threshold = dbAmplitude[toIndex(s->params[kThreshold], 60)];
    const int ratio = toIndex(s->params[kRatio], 3);
    const int response = toIndex(s->params[kResponse], 2);
    const float releaseSeconds = response == 0 ? 0.075f : (response == 1 ? .18f : .36f);
    const float releaseStep = clamp(1.f / (s->sampleRate * releaseSeconds), 0.00000001f, 1.f);

    float blockMinGain = 1.f;
    for (int i=0;i<frames;i++) {
        float a = inputs[0][i];
        float b = inputs[1][i];
        // Floating NaN / Inf / corrupt stream input must never poison DSP state.
        if (!(a >= -64.f && a <= 64.f)) a = 0.f;
        if (!(b >= -64.f && b <= 64.f)) b = 0.f;
        s->ring[0][s->head] = a;
        s->ring[1][s->head] = b;
        s->head = (s->head + 1) % kLookahead;
        if (s->count < kLookahead) ++s->count;

        float peak = 0.f;
        for (int j=0;j<kLookahead;j++) {
            peak = maxFloat(peak, absolute(s->ring[0][j]));
            peak = maxFloat(peak, absolute(s->ring[1][j]));
        }
        float needed = 1.f;
        if (peak > threshold) {
            const float r = clamp(threshold / peak, 0.f, 1.f);
            // In dB: out = threshold + (in-threshold)/R.
            // Corresponding linear gain = (threshold/peak)^(1-1/R).
            if (ratio == 0) needed = squareRoot(r); // 2:1 -> ^0.5
            else if (ratio == 1) needed = squareRoot(r) * squareRoot(squareRoot(r)); // 4:1 -> ^0.75
            else if (ratio == 2) {
                const float r12 = squareRoot(r);
                const float r14 = squareRoot(r12);
                needed = r12 * r14 * squareRoot(r14); // 8:1 -> ^0.875
            } else needed = r; // infinity:1
        }
        if (peak > ceiling) needed = minFloat(needed, ceiling / peak);
        // Linked gain across stereo: preserves L/R balance, peak-safe at sample level.
        if (needed < s->gain) s->gain = needed;
        else s->gain = minFloat(1.f, s->gain + releaseStep * (needed - s->gain));
        blockMinGain = minFloat(blockMinGain, s->gain);

        if (s->count < kLookahead) {
            outputs[0][i] = outputs[1][i] = 0.f;
            continue;
        }
        for (int ch=0;ch<kChannels;ch++) {
            float sample = s->ring[ch][s->head] * s->gain;
            // Last rounding guard. True-peak (intersample) overs are still possible.
            outputs[ch][i] = clamp(sample, -ceiling, ceiling);
        }
    }
#if defined(_WIN32)
    if (s->telemetry) {
        auto* page = static_cast<TelemetryPage*>(s->telemetry);
        page->gainPpm = static_cast<int>(clamp(blockMinGain, 0.f, 1.f) * 1000000.f + .5f);
        page->enabled = 1;
        __sync_fetch_and_add(&page->sequence, 1);
    }
#endif
}

VstIntPtr BZ_CALL dispatch(AEffect* effect, int32_t opcode, int32_t index, VstIntPtr value, void* ptr, float opt) {
    Instance* s = effect ? static_cast<Instance*>(effect->object) : nullptr;
    if (!s) return 0;
    switch (opcode) {
        case kEffOpen: return 1;
        case kEffClose:
#if defined(_WIN32)
            closeTelemetryPage(s->telemetry, s->telemetryHandle);
            s->telemetry = nullptr;
            s->telemetryHandle = nullptr;
#endif
            s->occupied = 0;
            return 1;
        case kEffGetProgram: return 0;
        case kEffGetProgramName: writeText(ptr, "Default"); return 1;
        case kEffGetParamName:
            if (index == kEnabled) writeText(ptr, "Enabled");
            else if (index == kCeiling) writeText(ptr, "Ceiling");
            else if (index == kThreshold) writeText(ptr, "Threshold");
            else if (index == kRatio) writeText(ptr, "Ratio");
            else if (index == kResponse) writeText(ptr, "Response");
            return 1;
        case kEffGetParamLabel: writeText(ptr, index == kCeiling || index == kThreshold ? "dB" : ""); return 1;
        case kEffGetParamDisplay:
            if (index == kCeiling) writeNumber(ptr, toIndex(s->params[kCeiling], 50) - 50);
            else if (index == kThreshold) writeNumber(ptr, toIndex(s->params[kThreshold], 60) - 60);
            else if (index == kEnabled) writeText(ptr, s->params[kEnabled] >= .5f ? "On" : "Off");
            else if (index == kRatio) writeText(ptr, toIndex(s->params[kRatio], 3) == 3 ? "Inf:1" :
                                                (toIndex(s->params[kRatio], 3) == 2 ? "8:1" :
                                                (toIndex(s->params[kRatio], 3) == 1 ? "4:1" : "2:1")));
            else if (index == kResponse) writeText(ptr, toIndex(s->params[kResponse], 2) == 0 ? "Fast" :
                                                  (toIndex(s->params[kResponse], 2) == 1 ? "Normal" : "Smooth"));
            return 1;
        case kEffSetSampleRate:
            if (opt >= 8000.f && opt <= 384000.f) s->sampleRate = opt;
            reset(s); return 1;
        case kEffSetBlockSize: return 1;
        case kEffMainsChanged: reset(s); return 1;
        case kEffGetEffectName: writeText(ptr, "bzAudioLimiter"); return 1;
        case kEffGetVendorString: writeText(ptr, "bzDrive"); return 1;
        case kEffGetProductString: writeText(ptr, "bzAudioLimiter VST"); return 1;
        case kEffGetVendorVersion: return 1;
        case kEffCanDo: return 0;
        case kEffGetTailSize: return kLookahead;
        case kEffGetVstVersion: return 2400;
        default: return 0;
    }
}
} // namespace

BZ_EXPORT AEffect* BZ_CALL VSTPluginMain(AudioMaster) {
    for (int i=0;i<kInstances;i++) {
        if (__sync_bool_compare_and_swap(&slots[i].occupied, 0, 1)) {
            Instance* s = &slots[i];
            reset(s);
            s->sampleRate = 48000.f;
            s->params[kEnabled] = 0.f; // safe bypass until explicitly configured
            s->params[kCeiling] = 38.f / 50.f; // -12 dBFS
            s->params[kThreshold] = 36.f / 60.f; // -24 dBFS
            s->params[kRatio] = 1.f;
            s->params[kResponse] = 0.f;
#if defined(_WIN32)
            s->telemetryHandle = nullptr;
            s->telemetry = openTelemetryPage(&s->telemetryHandle);
#endif
            AEffect* e = &s->effect;
            e->magic = kEffectMagic;
            e->dispatcher = &dispatch;
            e->process = &process;
            e->setParameter = &setParam;
            e->getParameter = &getParam;
            e->numPrograms = 1;
            e->numParams = kParams;
            e->numInputs = e->numOutputs = kChannels;
            e->flags = kCanReplacing;
            e->resvd1 = e->resvd2 = 0;
            e->initialDelay = kLookahead - 1;
            e->realQualities = e->offQualities = 0;
            e->ioRatio = 1.f;
            e->object = s;
            e->user = nullptr;
            e->uniqueID = 0x425a414c; // 'BZAL'
            e->version = 101;
            e->processReplacing = &process;
            e->processDoubleReplacing = nullptr;
            for (char& c : e->future) c = 0;
            return e;
        }
    }
    return nullptr;
}
