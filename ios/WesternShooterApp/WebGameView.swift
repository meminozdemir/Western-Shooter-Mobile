import SwiftUI
import WebKit

/// Wraps WKWebView in a SwiftUI-compatible UIViewRepresentable.
///
/// Key guarantees:
/// - Scrolling, bounce and zoom are fully disabled so the game canvas
///   behaves like a native fullscreen view, not a web page.
/// - The bundled game files are loaded from the app bundle (WebApp/index.html)
///   via a file:// URL, so no network access is required.
/// - External link navigation is blocked; only local file:// navigation is allowed.
struct WebGameView: UIViewRepresentable {

    // MARK: - UIViewRepresentable

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView(frame: .zero, configuration: makeWebViewConfig())

        // ── Disable scroll / bounce / zoom ──────────────────────────────────
        let sv = webView.scrollView
        sv.isScrollEnabled = false
        sv.bounces = false
        sv.bouncesZoom = false
        sv.showsHorizontalScrollIndicator = false
        sv.showsVerticalScrollIndicator = false
        sv.minimumZoomScale = 1.0
        sv.maximumZoomScale = 1.0
        sv.zoomScale = 1.0

        // ── Visual appearance ────────────────────────────────────────────────
        // Match the game's background so there is no white flash on load.
        let gameBG = UIColor(red: 26/255, green: 8/255, blue: 0/255, alpha: 1)
        webView.isOpaque = false
        webView.backgroundColor = gameBG
        webView.scrollView.backgroundColor = gameBG

        // ── Navigation delegate prevents the user leaving the game ──────────
        webView.navigationDelegate = context.coordinator

        // ── Load bundled game ────────────────────────────────────────────────
        if let indexURL = Bundle.main.url(
            forResource: "index",
            withExtension: "html",
            subdirectory: "WebApp"
        ) {
            // allowingReadAccessTo covers the entire WebApp folder so that
            // game.js, style.css and any image assets are all accessible.
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        // No dynamic updates needed — the game manages its own state.
    }

    // MARK: - Private helpers

    private func makeWebViewConfig() -> WKWebViewConfiguration {
        let config = WKWebViewConfiguration()

        // Allow audio/video to play inline without requiring a user gesture.
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        // Inject a script that enforces the viewport meta tag at document-end
        // so pinch-to-zoom is disabled even if the HTML omits the tag.
        let viewportJS = """
        (function() {
          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
          }
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        })();
        """
        let viewportScript = WKUserScript(
            source: viewportJS,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(viewportScript)

        return config
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, WKNavigationDelegate {
        /// Block any external link navigation so the player cannot accidentally
        /// leave the game (e.g. by tapping a link in an in-game error page).
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            if navigationAction.navigationType == .linkActivated,
               let url = navigationAction.request.url,
               url.scheme != "file" {
                decisionHandler(.cancel)
            } else {
                decisionHandler(.allow)
            }
        }
    }
}
