#pragma once
// Minimal VST 2.x binary interoperability declarations.
// This file defines only externally specified ABI types/layout and opcodes;
// it contains no Steinberg SDK implementation or copied SDK source.
#include <stdint.h>
#include <stddef.h>

#if defined(_WIN32)
#define BZ_EXPORT extern "C" __declspec(dllexport)
#define BZ_CALL __cdecl
#else
#define BZ_EXPORT extern "C" __attribute__((visibility("default")))
#define BZ_CALL
#endif

struct AEffect;
typedef intptr_t VstIntPtr;
typedef VstIntPtr(BZ_CALL *AudioMaster)(AEffect*, int32_t, int32_t, VstIntPtr, void*, float);
typedef VstIntPtr(BZ_CALL *Dispatcher)(AEffect*, int32_t, int32_t, VstIntPtr, void*, float);
typedef void(BZ_CALL *Process)(AEffect*, float**, float**, int32_t);
typedef void(BZ_CALL *SetParameter)(AEffect*, int32_t, float);
typedef float(BZ_CALL *GetParameter)(AEffect*, int32_t);
typedef void(BZ_CALL *DoubleProcess)(AEffect*, double**, double**, int32_t);

struct AEffect {
    int32_t magic;
    Dispatcher dispatcher;
    Process process;
    SetParameter setParameter;
    GetParameter getParameter;
    int32_t numPrograms;
    int32_t numParams;
    int32_t numInputs;
    int32_t numOutputs;
    int32_t flags;
    VstIntPtr resvd1;
    VstIntPtr resvd2;
    int32_t initialDelay;
    int32_t realQualities;
    int32_t offQualities;
    float ioRatio;
    void* object;
    void* user;
    int32_t uniqueID;
    int32_t version;
    Process processReplacing;
    DoubleProcess processDoubleReplacing;
    char future[56];
};

static constexpr int32_t kEffectMagic = 0x56737450; // 'VstP'
static constexpr int32_t kCanReplacing = (1 << 4);
static constexpr int32_t kEffOpen = 0;
static constexpr int32_t kEffClose = 1;
static constexpr int32_t kEffGetProgram = 3;
static constexpr int32_t kEffGetProgramName = 5;
static constexpr int32_t kEffGetParamLabel = 6;
static constexpr int32_t kEffGetParamDisplay = 7;
static constexpr int32_t kEffGetParamName = 8;
static constexpr int32_t kEffSetSampleRate = 10;
static constexpr int32_t kEffSetBlockSize = 11;
static constexpr int32_t kEffMainsChanged = 12;
static constexpr int32_t kEffGetEffectName = 45;
static constexpr int32_t kEffGetVendorString = 47;
static constexpr int32_t kEffGetProductString = 48;
static constexpr int32_t kEffGetVendorVersion = 49;
static constexpr int32_t kEffCanDo = 51;
static constexpr int32_t kEffGetTailSize = 52;
static constexpr int32_t kEffGetVstVersion = 58;

BZ_EXPORT AEffect* BZ_CALL VSTPluginMain(AudioMaster host);
