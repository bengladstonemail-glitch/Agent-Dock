import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Download, 
  Check, 
  Copy, 
  Sparkles, 
  ExternalLink, 
  FileCode, 
  Terminal, 
  QrCode,
  ShieldCheck,
  CheckCheck
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AndroidApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  baseProjectDir?: string;
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({
  isOpen,
  onClose,
  baseProjectDir = '~/AgentDock',
}) => {
  const { isInstallable, isInstalled, isAndroid, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'install' | 'gradle' | 'capacitor'>('install');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const ANDROID_MANIFEST_XML = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.agentdock.gemini">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Agent Dock Gemini"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Agent Dock"
        android:usesCleartextTraffic="true">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|keyboardHidden|screenSize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

  const MAIN_ACTIVITY_KT = `package com.agentdock.gemini

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        webView.webViewClient = WebViewClient()
        // Replace with your PC LAN IP address (e.g. http://192.168.1.50:3000)
        webView.loadUrl("http://10.0.2.2:3000")
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}`;

  const BUILD_APK_BAT = `@echo off
echo ===================================================
echo 🤖 Building Agent Dock Android APK
echo ===================================================
call gradlew.bat assembleDebug
echo.
echo ✅ APK generated successfully:
echo app/build/outputs/apk/debug/app-debug.apk
pause`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="bg-[#181920] border border-[#2c2f3d] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#252733] flex items-center justify-between bg-[#14151a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#4285F4] via-[#9B72CB] to-[#D96570] flex items-center justify-center shadow-md">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Agent Dock Android App (APK / PWA)
              </h2>
              <p className="text-xs text-[#8b90a0]">
                Chat & Agent mode on your Android phone without terminals
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#252834] rounded-lg text-[#8b90a0] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-5 pt-3 border-b border-[#252733] flex items-center gap-2 bg-[#16171e]">
          <button
            onClick={() => setActiveTab('install')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'install'
                ? 'border-[#4285F4] text-white bg-[#1e202a]'
                : 'border-transparent text-[#8b90a0] hover:text-[#e3e4e8]'
            }`}
          >
            1. Install on Android (Instant WebAPK)
          </button>
          <button
            onClick={() => setActiveTab('gradle')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'gradle'
                ? 'border-[#9B72CB] text-white bg-[#1e202a]'
                : 'border-transparent text-[#8b90a0] hover:text-[#e3e4e8]'
            }`}
          >
            2. Android Studio / Gradle APK
          </button>
          <button
            onClick={() => setActiveTab('capacitor')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
              activeTab === 'capacitor'
                ? 'border-[#3fb950] text-white bg-[#1e202a]'
                : 'border-transparent text-[#8b90a0] hover:text-[#e3e4e8]'
            }`}
          >
            3. One-Command APK (Capacitor)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-sans select-text">
          {activeTab === 'install' && (
            <div className="space-y-4">
              {/* Direct Install Button */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#1d2638] to-[#261f33] border border-[#388bfd]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#4285F4]" />
                    <span>Install WebAPK on Android</span>
                  </h3>
                  <p className="text-xs text-[#a4a8b8] mt-0.5">
                    Android packages the app directly into your app drawer with a custom home icon.
                  </p>
                </div>

                <button
                  onClick={install}
                  className="px-4 py-2 bg-gradient-to-r from-[#4285F4] to-[#9B72CB] hover:opacity-90 text-white font-semibold rounded-xl text-xs transition-opacity shadow-lg shrink-0 flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Install App on Phone</span>
                </button>
              </div>

              {/* Instructions */}
              <div className="space-y-2.5">
                <h4 className="font-semibold text-white text-xs uppercase tracking-wider text-[#8b90a0]">
                  How to open on your Android phone:
                </h4>
                <ol className="space-y-2 list-decimal list-inside text-[#c9d1d9] leading-relaxed">
                  <li>
                    Ensure your phone and PC are connected to the same Wi-Fi network.
                  </li>
                  <li>
                    Open Chrome or Samsung Internet on your Android phone.
                  </li>
                  <li>
                    Enter your PC's IP address: <code className="px-1.5 py-0.5 bg-[#1f212a] text-[#58a6ff] rounded font-mono">http://&lt;YOUR-PC-IP&gt;:3000</code>.
                  </li>
                  <li>
                    Tap the browser menu <strong className="text-white">(⋮)</strong> and tap <strong className="text-[#3fb950]">Install app</strong> (or <strong className="text-[#3fb950]">Add to Home Screen</strong>).
                  </li>
                  <li>
                    Android will install <strong>Agent Dock Gemini</strong> directly into your phone's app launcher!
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'gradle' && (
            <div className="space-y-4">
              <p className="text-[#a4a8b8] leading-relaxed">
                Want a real standalone <code className="text-[#58a6ff]">.apk</code> file? You can build one in 2 minutes with Android Studio or Gradle:
              </p>

              {/* MainActivity.kt */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#8b90a0]">
                  <span>app/src/main/java/com/agentdock/gemini/MainActivity.kt</span>
                  <button
                    onClick={() => copyToClipboard(MAIN_ACTIVITY_KT, 'main')}
                    className="flex items-center gap-1 text-[#58a6ff] hover:underline"
                  >
                    {copiedCode === 'main' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'main' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#111216] border border-[#23252d] rounded-xl font-mono text-[11px] text-[#c9d1d9] overflow-x-auto max-h-40">
                  {MAIN_ACTIVITY_KT}
                </pre>
              </div>

              {/* AndroidManifest.xml */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#8b90a0]">
                  <span>app/src/main/AndroidManifest.xml</span>
                  <button
                    onClick={() => copyToClipboard(ANDROID_MANIFEST_XML, 'manifest')}
                    className="flex items-center gap-1 text-[#58a6ff] hover:underline"
                  >
                    {copiedCode === 'manifest' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode === 'manifest' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-[#111216] border border-[#23252d] rounded-xl font-mono text-[11px] text-[#c9d1d9] overflow-x-auto max-h-36">
                  {ANDROID_MANIFEST_XML}
                </pre>
              </div>

              {/* Build Command */}
              <div className="p-3 bg-[#161820] border border-[#2a2d3a] rounded-xl flex items-center justify-between font-mono text-xs">
                <code className="text-[#7ee787]">./gradlew assembleDebug</code>
                <button
                  onClick={() => copyToClipboard('./gradlew assembleDebug', 'cmd')}
                  className="px-2 py-1 bg-[#232633] text-white rounded hover:bg-[#2e3243]"
                >
                  {copiedCode === 'cmd' ? 'Copied' : 'Copy Command'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'capacitor' && (
            <div className="space-y-3">
              <p className="text-[#a4a8b8] leading-relaxed">
                You can convert this exact project into a native Android APK using Capacitor in 3 terminal commands on your PC:
              </p>

              <div className="p-3 bg-[#121316] border border-[#23252d] rounded-xl font-mono text-xs space-y-2 text-[#7ee787]">
                <p className="text-[#8b90a0]"># 1. Install Capacitor Android bridge</p>
                <p>npm install @capacitor/core @capacitor/android</p>
                <p className="text-[#8b90a0]"># 2. Add Android platform</p>
                <p>npx cap add android</p>
                <p className="text-[#8b90a0]"># 3. Build & open in Android Studio to export APK</p>
                <p>npm run build &amp;&amp; npx cap sync &amp;&amp; npx cap open android</p>
              </div>

              <div className="p-3 rounded-xl bg-[#17221c] border border-[#2ea043]/30 text-xs text-[#7ee787] flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-[#3fb950] shrink-0" />
                <span>
                  The Android app connects straight to your local PC Ollama and writes files to {baseProjectDir}!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#252733] bg-[#14151a] flex items-center justify-between text-xs">
          <span className="text-[#8b90a0] font-mono">
            Agent Dock target: {baseProjectDir}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252834] hover:bg-[#303444] text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
