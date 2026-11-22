# Windows default render-endpoint peak meter (Core Audio).
# Read-only: does not capture samples, change volume or route audio.
# stdout: one JSON line per measurement; errors are sent on stderr.
$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.Runtime.InteropServices;
using System.IO.MemoryMappedFiles;

namespace BzAudioMeter {
    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumeratorClass { }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown),
     Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
    internal interface IMMDeviceEnumerator {
        [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
        [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
        [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
        [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr callback);
        [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr callback);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown),
     Guid("D666063F-1587-4E43-81F1-B948E807363F")]
    internal interface IMMDevice {
        [PreserveSig] int Activate([In] ref Guid iid, int classContext, IntPtr activationParams,
                                   [MarshalAs(UnmanagedType.IUnknown)] out object instance);
        [PreserveSig] int OpenPropertyStore(int access, out IntPtr propertyStore);
        [PreserveSig] int GetId(out IntPtr id);
        [PreserveSig] int GetState(out int state);
    }

    [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown),
     Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064")]
    internal interface IAudioMeterInformation {
        [PreserveSig] int GetPeakValue(out float peak);
        [PreserveSig] int GetMeteringChannelCount(out int count);
        [PreserveSig] int GetChannelsPeakValues(int channelCount, IntPtr peaks);
        [PreserveSig] int QueryHardwareSupport(out int mask);
    }

    public static class TelemetryReader {
        private static readonly string[] Names = {
            @"Global\bzAudioLimiterTelemetry_022", @"Local\bzAudioLimiterTelemetry_022"
        };
        // Returns null if the VST has not loaded, the OS denies the mapping,
        // or no coherent data is currently available.
        public static int[] Read() {
            foreach (string name in Names) {
                try {
                    using (MemoryMappedFile map = MemoryMappedFile.OpenExisting(name, MemoryMappedFileRights.Read))
                    using (MemoryMappedViewAccessor view = map.CreateViewAccessor(0, 20, MemoryMappedFileAccess.Read)) {
                        if (view.ReadInt32(0) != 0x425a4d31 || view.ReadInt32(4) != 1) continue;
                        int sequenceA = view.ReadInt32(8);
                        int gain = view.ReadInt32(12);
                        int enabled = view.ReadInt32(16);
                        if (sequenceA != view.ReadInt32(8) || gain < 0 || gain > 1000000 || (enabled != 0 && enabled != 1)) continue;
                        return new int[] { sequenceA, gain, enabled };
                    }
                } catch (System.IO.FileNotFoundException) { }
                  catch (System.UnauthorizedAccessException) { }
                  catch (System.IO.IOException) { }
            }
            return null;
        }
    }

    public static class PeakReader {
        private static IMMDeviceEnumerator enumerator;
        private static IMMDevice device;
        private static IAudioMeterInformation meter;

        public static void Reset() {
            if (meter != null) { Marshal.ReleaseComObject(meter); meter = null; }
            if (device != null) { Marshal.ReleaseComObject(device); device = null; }
        }

        public static float Read() {
            if (meter == null) {
                if (enumerator == null) enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorClass();
                IMMDevice next;
                int hr = enumerator.GetDefaultAudioEndpoint(0, 0, out next); // eRender, eConsole
                if (hr != 0 || next == null) Marshal.ThrowExceptionForHR(hr != 0 ? hr : unchecked((int)0x80070490));
                object obj;
                Guid iid = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");
                hr = next.Activate(ref iid, 23, IntPtr.Zero, out obj); // CLSCTX_ALL
                if (hr != 0 || obj == null) {
                    Marshal.ReleaseComObject(next);
                    Marshal.ThrowExceptionForHR(hr != 0 ? hr : unchecked((int)0x80004005));
                }
                device = next;
                meter = (IAudioMeterInformation)obj;
            }
            float peak;
            int result = meter.GetPeakValue(out peak);
            if (result != 0) { Reset(); Marshal.ThrowExceptionForHR(result); }
            if (float.IsNaN(peak) || float.IsInfinity(peak)) return 0f;
            return Math.Max(0f, Math.Min(1f, peak));
        }
    }
}
'@

Add-Type -TypeDefinition $source -ErrorAction Stop
$lastCheck = [DateTime]::UtcNow
while ($true) {
    # Reacquire endpoint periodically to follow Windows default-device changes.
    if (([DateTime]::UtcNow - $lastCheck).TotalSeconds -ge 3) {
        [BzAudioMeter.PeakReader]::Reset()
        $lastCheck = [DateTime]::UtcNow
    }
    # Telemetry is optional; its failure must never disable the endpoint meter.
    $telemetry = try { [BzAudioMeter.TelemetryReader]::Read() } catch { $null }
    $telemetryJson = if ($null -ne $telemetry) {
        ',"dspSequence":' + $telemetry[0].ToString() + ',"dspGainPpm":' + $telemetry[1].ToString() + ',"dspEnabled":' + $telemetry[2].ToString()
    } else { '' }
    try {
        $peak = [BzAudioMeter.PeakReader]::Read()
        $db = if ($peak -le 0.000001) { -60.0 } else { [Math]::Max(-60.0, 20.0 * [Math]::Log10($peak)) }
        [Console]::Out.WriteLine('{"peak":' + $peak.ToString('R', [Globalization.CultureInfo]::InvariantCulture) + ',"db":' + $db.ToString('F2', [Globalization.CultureInfo]::InvariantCulture) + $telemetryJson + '}')
    } catch {
        [Console]::Error.WriteLine('Audio meter: ' + $_.Exception.Message)
        [BzAudioMeter.PeakReader]::Reset()
        [Console]::Out.WriteLine('{"offline":true' + $telemetryJson + '}')
        Start-Sleep -Milliseconds 800
    }
    Start-Sleep -Milliseconds 90
}
