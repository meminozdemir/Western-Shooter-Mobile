import SwiftUI

@main
struct WesternShooterApp: App {
    // Connects the UIKit AppDelegate so we can lock orientation to landscape.
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
    }
}

// MARK: - AppDelegate (orientation lock)

final class AppDelegate: NSObject, UIApplicationDelegate {
    /// Restrict all screens to landscape orientations.
    func application(
        _ application: UIApplication,
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        return .landscape
    }
}
