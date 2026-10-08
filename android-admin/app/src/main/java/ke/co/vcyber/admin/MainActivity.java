package ke.co.vcyber.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.util.Locale;

/** Same-origin admin client. No JavaScript bridge or embedded credentials. */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 42;
    private WebView web;
    private ProgressBar progress;
    private TextView failure;
    private ValueCallback<Uri[]> fileCallback;
    private String serverUrl;

    // The React dashboard needs JavaScript. Navigation remains restricted to the configured origin;
    // there is no native JavaScript bridge, mixed content or untrusted file access.
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle saved) {
        super.onCreate(saved);
        serverUrl = getPreferences(MODE_PRIVATE).getString("server", "https://vcyber.co.ke");
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        LinearLayout bar = new LinearLayout(this);
        for (String title : new String[]{"Dashboard", "Reload", "Server"}) {
            Button button = new Button(this);
            button.setText(title);
            bar.addView(button, new LinearLayout.LayoutParams(0, 52 * (int)getResources().getDisplayMetrics().density, 1));
            button.setOnClickListener(v -> {
                if (title.equals("Server")) configureServer();
                else if (title.equals("Dashboard")) loadAdmin();
                else { failure.setVisibility(TextView.GONE); web.reload(); }
            });
        }
        root.addView(bar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        root.addView(progress, new LinearLayout.LayoutParams(-1, 6));
        failure = new TextView(this);
        failure.setPadding(20, 16, 20, 16);
        failure.setTextColor(Color.rgb(150, 30, 30));
        failure.setVisibility(TextView.GONE);
        root.addView(failure);
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        root.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // Android document-picker content URIs.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (sameOrigin(url)) return false;
                String scheme = url.getScheme();
                if ("https".equals(scheme) || "tel".equals(scheme) || "mailto".equals(scheme)) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                    catch (ActivityNotFoundException e) { toast("No app can open this link."); }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) { CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showFailure("Cannot reach the website. Check your connection and Server address, then tap Reload.");
            }
            @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                showFailure("The server certificate could not be verified. Check the HTTPS configuration.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value == 100 ? ProgressBar.GONE : ProgressBar.VISIBLE);
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!sameOrigin(Uri.parse(view.getUrl()))) { callback.onReceiveValue(null); return true; }
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                picker.setType("*/*");
                picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(picker, PICK_FILE); }
                catch (ActivityNotFoundException e) { finishFile(null); toast("No document picker is installed."); }
                return true;
            }
        });
        web.setDownloadListener((url, agent, disposition, mime, length) -> {
            Uri uri = Uri.parse(url);
            if (!sameOrigin(uri)) { toast("This download is not from your admin server."); return; }
            try {
                DownloadManager.Request download = new DownloadManager.Request(uri);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) download.addRequestHeader("Cookie", cookies);
                download.addRequestHeader("User-Agent", agent);
                String name = URLUtil.guessFileName(url, disposition, mime).replaceAll("[^a-zA-Z0-9._ -]", "_");
                download.setTitle(name);
                download.setMimeType(mime);
                download.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                if (Build.VERSION.SDK_INT >= 29) download.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
                else download.setDestinationInExternalFilesDir(MainActivity.this, Environment.DIRECTORY_DOWNLOADS, name);
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(download);
                toast("Downloading " + name);
            } catch (RuntimeException e) { toast("Download failed. Please try again."); }
        });
        loadAdmin();
    }

    private boolean sameOrigin(Uri uri) {
        if (uri == null) return false;
        Uri base = Uri.parse(serverUrl);
        return base.getScheme().equalsIgnoreCase(String.valueOf(uri.getScheme()))
            && base.getHost().equalsIgnoreCase(String.valueOf(uri.getHost()))
            && port(base) == port(uri);
    }
    private int port(Uri uri) { return uri.getPort() >= 0 ? uri.getPort() : ("https".equals(uri.getScheme()) ? 443 : 80); }
    private void loadAdmin() { failure.setVisibility(TextView.GONE); web.loadUrl(serverUrl + "/admin"); }
    private void showFailure(String message) { failure.setText(message); failure.setVisibility(TextView.VISIBLE); }
    private void toast(String message) { Toast.makeText(this, message, Toast.LENGTH_LONG).show(); }
    private void configureServer() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(serverUrl);
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Admin server address")
            .setMessage(BuildConfig.DEBUG ? "Use your HTTPS website. For local emulator testing use http://10.0.2.2:3001. HTTP is allowed only in this development build." : "Enter the HTTPS address of your Victorious Cyber website.")
            .setView(input).setPositiveButton("Connect", null).setNegativeButton("Cancel", null).create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            Uri uri = Uri.parse(input.getText().toString().trim());
            String scheme = String.valueOf(uri.getScheme()).toLowerCase(Locale.ROOT);
            if (uri.getHost() == null || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                || !(scheme.equals("https") || (BuildConfig.DEBUG && scheme.equals("http")))
                || (uri.getPath() != null && !uri.getPath().isEmpty() && !uri.getPath().equals("/"))) {
                input.setError("Enter a server origin, such as https://vcyber.co.ke, without a path."); return;
            }
            finishFile(null);
            CookieManager.getInstance().removeAllCookies(removed -> {
                serverUrl = uri.buildUpon().path("").build().toString();
                getPreferences(MODE_PRIVATE).edit().putString("server", serverUrl).apply();
                web.clearHistory(); web.clearCache(true); loadAdmin();
            });
            dialog.dismiss();
        }));
        dialog.show();
    }
    private void finishFile(Uri[] files) { if (fileCallback != null) { fileCallback.onReceiveValue(files); fileCallback = null; } }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE) {
            Uri uri = result == RESULT_OK && data != null ? data.getData() : null;
            finishFile(uri != null && "content".equals(uri.getScheme()) ? new Uri[]{uri} : null);
        }
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { finishFile(null); web.destroy(); super.onDestroy(); }
}
