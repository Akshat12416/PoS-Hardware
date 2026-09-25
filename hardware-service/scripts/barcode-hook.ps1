# System-wide keyboard listener. Prints one token per key.
# Scanner bursts are decided by the Node process.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class ScanHook {
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private static IntPtr _hook = IntPtr.Zero;
    private static HookProc _proc;

    private delegate IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, HookProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll")]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern int GetMessage(ref MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    public static void Run() {
        _proc = HookCallback;
        _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
        if (_hook == IntPtr.Zero) {
            Console.Error.WriteLine("HOOK_FAILED");
            return;
        }

        Console.WriteLine("HOOK_READY");
        Console.Out.Flush();

        MSG msg = new MSG();
        while (GetMessage(ref msg, IntPtr.Zero, 0, 0) > 0) {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        UnhookWindowsHookEx(_hook);
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0 && (wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN)) {
            KBDLLHOOKSTRUCT data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            string text = KeyText(data.vkCode, data.scanCode);
            if (!string.IsNullOrEmpty(text)) {
                Console.WriteLine(text);
                Console.Out.Flush();
            }
        }
        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static string KeyText(uint vk, uint scan) {
        if (vk == 0x0D) return "ENTER";
        if (vk == 0x09) return "TAB";
        if (vk == 0xE7 && scan >= 32 && scan < 127) return ((char)scan).ToString();
        if (vk >= 0x30 && vk <= 0x39) return ((char)vk).ToString();
        if (vk >= 0x41 && vk <= 0x5A) return ((char)(vk + 32)).ToString();
        if (vk >= 0x60 && vk <= 0x69) return ((char)('0' + (vk - 0x60))).ToString();
        if (vk == 0x20) return " ";
        if (vk == 0xBD || vk == 0x6D) return "-";
        if (vk == 0xBE || vk == 0x6E) return ".";
        if (vk == 0xBF) return "/";
        return null;
    }
}
"@

[ScanHook]::Run()
